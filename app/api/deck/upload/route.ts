import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import {
  buildDeckKey,
  deleteObject,
  isValidDeckKey,
  putBytes,
} from "@/lib/storage/s3";

/**
 * POST /api/deck/upload  (multipart/form-data, field: "file")
 *
 * Auth-gated. Streams the user's pitch deck PDF into our S3 bucket and
 * updates public.startups with the new key + filename. If a previous deck
 * existed, its S3 object is deleted so we don't accumulate orphans.
 *
 * Constraints (server-side; client UI also enforces but never trust the client):
 *   - Content-Type must be application/pdf
 *   - Size ≤ 25 MiB
 *   - Only the founder's own startup row is updated (RLS)
 *
 * Returns: { ok: true, filename, uploadedAt }
 *
 * Why server-mediated and not direct-to-S3 with presigned PUT: simpler
 * for v1 (single endpoint, single auth check, single validation pass).
 * Sprint 11+ can swap to presigned PUTs if upload bandwidth on Railway
 * becomes a bottleneck.
 */

export const runtime = "nodejs"; // S3 SDK + Buffer require Node runtime
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in to upload." }, { status: 401 });
  }
  const userId = session.user.id;

  // Read the multipart form. Next/Edge runtimes parse it for us; the
  // FormData entry for 'file' is a File (Web).
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
      { ok: false, error: "No file attached. Add a 'file' field to the form." },
      { status: 400 },
    );
  }

  // Validate type. We accept application/pdf and the common octet-stream
  // mislabel from Safari uploads — but check the magic bytes below to
  // guard against bait files.
  const declaredType = file.type || "application/octet-stream";
  if (declaredType !== "application/pdf" && declaredType !== "application/octet-stream") {
    return NextResponse.json(
      { ok: false, error: "Only PDF files are accepted." },
      { status: 415 },
    );
  }

  // Validate size BEFORE buffering to memory.
  if (file.size <= 0) {
    return NextResponse.json({ ok: false, error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is 25 MB.`,
      },
      { status: 413 },
    );
  }

  // Read into a Buffer. ≤25 MB is safe to hold in memory on Railway pods.
  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // Magic-byte check: PDF starts with "%PDF-" (ASCII 0x25 50 44 46 2D).
  // Cheap defense against renamed images / executables.
  const isPdf =
    buf.length >= 5 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
  if (!isPdf) {
    return NextResponse.json(
      { ok: false, error: "File doesn't look like a real PDF." },
      { status: 415 },
    );
  }

  const filename = sanitiseFilename(file.name || "deck.pdf");
  const key = buildDeckKey(userId);

  // 1) Upload to S3 first. If this fails, no DB change → we won't end up
  //    with a key in the DB that doesn't exist in S3.
  try {
    await putBytes({ key, body: buf, contentType: "application/pdf" });
  } catch (err) {
    console.error("[deck:upload] S3 put failed", err);
    return NextResponse.json(
      { ok: false, error: "Storage error. Try again in a minute." },
      { status: 500 },
    );
  }

  // 2) Swap the DB row to point at the new key. Capture the previous key
  //    so we can delete it from S3 below.
  let previousKey: string | null = null;
  let updatedAt: Date | null = null;
  try {
    const result = await withUserRls<{ previous: string | null; updated_at: string | null }>(
      userId,
      async (sql) => {
        const rows = await sql<{ deck_storage_key: string | null }[]>`
          select deck_storage_key from public.startups
          where user_id = ${userId} limit 1
        `;
        const previous = rows[0]?.deck_storage_key ?? null;

        // upsert-ish: if no startup row exists, the founder hasn't even
        // saved a draft yet — refuse to upload to avoid an orphan deck.
        if (rows.length === 0) {
          return { previous: null, updated_at: null };
        }

        const updated = await sql<{ deck_uploaded_at: string }[]>`
          update public.startups
          set deck_storage_key = ${key},
              deck_filename = ${filename},
              deck_uploaded_at = now()
          where user_id = ${userId}
          returning deck_uploaded_at
        `;
        return { previous, updated_at: updated[0]?.deck_uploaded_at ?? null };
      },
    );
    if (result.updated_at === null) {
      // Roll back the S3 upload — no startup row to attach to.
      await deleteObject(key).catch(() => undefined);
      return NextResponse.json(
        {
          ok: false,
          error: "Save your basic profile in the wizard first, then upload your deck.",
        },
        { status: 409 },
      );
    }
    previousKey = result.previous;
    updatedAt = new Date(result.updated_at);
  } catch (err) {
    console.error("[deck:upload] DB update failed", err);
    // Best-effort cleanup of the orphaned S3 object.
    await deleteObject(key).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "Could not save your deck. Try again." },
      { status: 500 },
    );
  }

  // 3) Async cleanup of the old key (if any). Don't block the response on it.
  if (previousKey && isValidDeckKey(previousKey)) {
    void deleteObject(previousKey).catch((err) => {
      console.error("[deck:upload] cleanup of old key failed", { previousKey, err });
    });
  }

  console.log(
    `[deck:upload] ok userId=${userId} key=${key} filename=${filename} bytes=${buf.length}`,
  );

  return NextResponse.json({
    ok: true,
    filename,
    uploadedAt: updatedAt?.toISOString() ?? null,
  });
}

/**
 * DELETE /api/deck/upload
 *
 * Owner-only. Clears deck_storage_key + deck_filename + deck_uploaded_at
 * on the founder's row and best-effort deletes the S3 object. Leaves
 * deck_url untouched (the external-link fallback may still be valid).
 *
 * Returns: { ok: true }
 */
export async function DELETE(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in." }, { status: 401 });
  }
  const userId = session.user.id;

  let previousKey: string | null = null;
  try {
    previousKey = await withUserRls<string | null>(userId, async (sql) => {
      const rows = await sql<{ deck_storage_key: string | null }[]>`
        select deck_storage_key from public.startups where user_id = ${userId} limit 1
      `;
      const k = rows[0]?.deck_storage_key ?? null;
      if (!k) return null;
      await sql`
        update public.startups
        set deck_storage_key = null,
            deck_filename = null,
            deck_uploaded_at = null
        where user_id = ${userId}
      `;
      return k;
    });
  } catch (err) {
    console.error("[deck:delete] DB clear failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not remove your deck." },
      { status: 500 },
    );
  }

  if (previousKey && isValidDeckKey(previousKey)) {
    void deleteObject(previousKey).catch((err) => {
      console.error("[deck:delete] S3 cleanup failed", { previousKey, err });
    });
  }

  console.log(`[deck:delete] ok userId=${userId} previousKey=${previousKey ?? "(none)"}`);
  return NextResponse.json({ ok: true });
}

/**
 * Strip directory components, control chars, and clamp length. Preserves
 * the .pdf suffix. Used purely for display — the S3 key uses uuid, not
 * the original filename.
 */
function sanitiseFilename(name: string): string {
  let cleaned = name
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f<>:"|?*]/g, "_")
    .trim();
  if (!cleaned) cleaned = "deck.pdf";
  if (cleaned.length > 200) cleaned = cleaned.slice(0, 196) + ".pdf";
  if (!cleaned.toLowerCase().endsWith(".pdf")) cleaned = cleaned + ".pdf";
  return cleaned;
}
