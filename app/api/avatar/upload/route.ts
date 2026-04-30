import { NextResponse, type NextRequest } from "next/server";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import {
  buildAvatarKey,
  deleteObject,
  isValidAvatarKey,
  presignedGetUrl,
  putBytes,
  type AvatarExt,
} from "@/lib/storage/s3";

/**
 * POST /api/avatar/upload  (multipart/form-data, field: "file")
 *
 * Auth-gated. Accepts a small JPEG/PNG/WebP, stores it in S3 under
 * avatars/<userId>/<uuid>.<ext>, and updates public.users with the new
 * key + a freshly-presigned 24h URL.
 *
 * Validation strategy:
 *   - Content-Type must be one of image/jpeg, image/png, image/webp
 *   - Size ≤ 2 MB (the client crops + downscales to 512×512 before upload,
 *     so legitimate uploads land well under 200 KB; the 2 MB ceiling is
 *     tolerance for unusual cases, not a target).
 *   - Magic-byte check on the first 4–8 bytes for each format so a
 *     renamed PDF/exe doesn't slip through.
 *
 * Returns: { ok: true, url, updatedAt }.
 *
 * The session JWT is refreshed via unstable_update so the user's avatar
 * appears in the nav dropdown immediately without a re-sign-in.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

const ACCEPTED: Record<string, AvatarExt> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in to upload." },
      { status: 401 },
    );
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Couldn't read upload payload." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file attached. Add a 'file' field." },
      { status: 400 },
    );
  }

  const declaredType = (file.type || "").toLowerCase();
  const ext = ACCEPTED[declaredType];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "Only JPEG, PNG, or WebP avatars are accepted." },
      { status: 415 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json({ ok: false, error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is ${MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  if (!magicBytesMatchType(buf, declaredType)) {
    return NextResponse.json(
      {
        ok: false,
        error: "File doesn't look like a real image of the declared type.",
      },
      { status: 415 },
    );
  }

  const key = buildAvatarKey(userId, ext);
  const contentType = declaredType === "image/jpg" ? "image/jpeg" : declaredType;

  // Step 1: upload to S3 first. If this fails, no DB swap.
  try {
    await putBytes({ key, body: buf, contentType });
  } catch (err) {
    console.error("[avatar:upload] S3 put failed", err);
    return NextResponse.json(
      { ok: false, error: "Storage error. Try again in a minute." },
      { status: 500 },
    );
  }

  // Step 2: presign a 24h URL. We cache it in users.avatar_url so list
  // pages don't re-presign per row.
  let presignedUrl: string;
  try {
    presignedUrl = await presignedGetUrl({ key, expiresIn: 24 * 60 * 60 });
  } catch (err) {
    console.error("[avatar:upload] presign failed", err);
    // Non-fatal: store the key, leave url null; resolveAvatarUrl will
    // re-presign at read time.
    presignedUrl = "";
  }

  // Step 3: swap DB row + capture previous key for cleanup.
  let previousKey: string | null = null;
  let updatedAt: Date;
  try {
    const result = await withUserRls<{ previous: string | null; updated_at: string }>(
      userId,
      async (sql) => {
        const rows = await sql<{ avatar_storage_key: string | null }[]>`
          select avatar_storage_key from public.users
          where id = ${userId} limit 1
        `;
        const previous = rows[0]?.avatar_storage_key ?? null;
        const updated = await sql<{ avatar_updated_at: string }[]>`
          update public.users
          set avatar_storage_key = ${key},
              avatar_url = ${presignedUrl || null},
              avatar_updated_at = now()
          where id = ${userId}
          returning avatar_updated_at
        `;
        return {
          previous,
          updated_at: updated[0]?.avatar_updated_at ?? new Date().toISOString(),
        };
      },
    );
    previousKey = result.previous;
    updatedAt = new Date(result.updated_at);
  } catch (err) {
    console.error("[avatar:upload] DB update failed", err);
    await deleteObject(key).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "Could not save your avatar. Try again." },
      { status: 500 },
    );
  }

  // Step 4: async cleanup of old object.
  if (previousKey && isValidAvatarKey(previousKey)) {
    void deleteObject(previousKey).catch((err) => {
      console.error("[avatar:upload] cleanup of old key failed", { previousKey, err });
    });
  }

  // Step 5: refresh the session JWT so the dropdown avatar updates without
  // a sign-in cycle. Best-effort — non-fatal if the SDK changes.
  try {
    await unstable_update({ user: { image: presignedUrl || undefined } });
  } catch (err) {
    console.warn("[avatar:upload] session JWT refresh failed", err);
  }

  console.log(
    `[avatar:upload] ok userId=${userId} key=${key} bytes=${buf.length} ct=${contentType}`,
  );

  return NextResponse.json({
    ok: true,
    url: presignedUrl || null,
    updatedAt: updatedAt.toISOString(),
  });
}

/**
 * DELETE /api/avatar/upload
 * Owner-only. Clears the three avatar columns and deletes the S3 object.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in." }, { status: 401 });
  }
  const userId = session.user.id;

  let previousKey: string | null = null;
  try {
    previousKey = await withUserRls<string | null>(userId, async (sql) => {
      const rows = await sql<{ avatar_storage_key: string | null }[]>`
        select avatar_storage_key from public.users where id = ${userId} limit 1
      `;
      const k = rows[0]?.avatar_storage_key ?? null;
      if (!k) return null;
      await sql`
        update public.users
        set avatar_storage_key = null,
            avatar_url = null,
            avatar_updated_at = null
        where id = ${userId}
      `;
      return k;
    });
  } catch (err) {
    console.error("[avatar:delete] DB clear failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not remove your avatar." },
      { status: 500 },
    );
  }

  if (previousKey && isValidAvatarKey(previousKey)) {
    void deleteObject(previousKey).catch((err) => {
      console.error("[avatar:delete] S3 cleanup failed", { previousKey, err });
    });
  }

  // Refresh JWT so dropdown reverts to OAuth image / initials.
  try {
    await unstable_update({ user: { image: null } });
  } catch {
    // Non-fatal.
  }

  console.log(`[avatar:delete] ok userId=${userId} previousKey=${previousKey ?? "(none)"}`);
  return NextResponse.json({ ok: true });
}

/**
 * Magic-byte sanity check against the declared MIME type.
 *   - JPEG: starts with FF D8 FF
 *   - PNG:  starts with 89 50 4E 47 0D 0A 1A 0A
 *   - WebP: 'RIFF' (52 49 46 46) at 0..3, 'WEBP' (57 45 42 50) at 8..11
 */
function magicBytesMatchType(buf: Buffer, type: string): boolean {
  if (type === "image/jpeg" || type === "image/jpg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
    );
  }
  if (type === "image/webp") {
    return (
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    );
  }
  return false;
}
