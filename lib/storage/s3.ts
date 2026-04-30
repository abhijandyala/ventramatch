import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-only S3 helpers. Never import from a Client Component.
 *
 * Pattern (Sprint 9.5.B): server-mediated uploads. The browser POSTs the
 * file to /api/deck/upload, which validates auth + size + type, then
 * streams the bytes into S3 using putBytes(). Reads use presignedGetUrl()
 * with a short TTL — viewers never get a permanent public URL.
 *
 * Environment:
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET
 *
 * If S3_BUCKET is unset we throw a clear error rather than silently
 * succeeding — uploads MUST land somewhere.
 */

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const region = process.env.AWS_REGION ?? "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 credentials missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your env. See docs/workflow.md → File storage.",
    );
  }
  _client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error(
      "S3_BUCKET env var missing. Set it in .env.local (and Railway). See docs/workflow.md → File storage.",
    );
  }
  return bucket;
}

// ──────────────────────────────────────────────────────────────────────────
//  Key helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a deck object key. Format: decks/<userId>/<uuid>.pdf
 *
 * userId in the path means we can scope IAM policies to a single user's
 * tree if we ever need to (e.g. give a partner agency read access to
 * just their portfolio). The uuid prevents accidental collisions on
 * replace and makes the key unguessable.
 */
export function buildDeckKey(userId: string): string {
  if (!userId) throw new Error("buildDeckKey: userId required");
  return `decks/${userId}/${randomUUID()}.pdf`;
}

/**
 * Sanity check that a stored key is shaped like one we generated. Used by
 * the download route to refuse path-traversal attempts on the off chance
 * a bad row exists in the DB.
 */
export function isValidDeckKey(key: string | null | undefined): key is string {
  if (!key) return false;
  return /^decks\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(key);
}

/** File extensions accepted for avatar uploads. Mirrors the route validator. */
const AVATAR_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export type AvatarExt = (typeof AVATAR_EXTS)[number];

/**
 * Build an avatar object key. Format: avatars/<userId>/<uuid>.<ext>
 *
 * The uuid in the basename means the URL changes on each upload — useful
 * because we cache the presigned URL in users.avatar_url for 24h. A new
 * uuid invalidates the cached URL implicitly without any cache-buster
 * query string gymnastics.
 */
export function buildAvatarKey(userId: string, ext: AvatarExt): string {
  if (!userId) throw new Error("buildAvatarKey: userId required");
  if (!(AVATAR_EXTS as readonly string[]).includes(ext)) {
    throw new Error(`buildAvatarKey: invalid ext ${ext}`);
  }
  return `avatars/${userId}/${randomUUID()}.${ext}`;
}

export function isValidAvatarKey(
  key: string | null | undefined,
): key is string {
  if (!key) return false;
  return /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(key);
}

// ──────────────────────────────────────────────────────────────────────────
//  Operations
// ──────────────────────────────────────────────────────────────────────────

/**
 * Upload bytes to S3. Returns the key on success.
 *
 * The bucket should be private — we expose objects via signed URLs only.
 * `contentType` is stored as the object's Content-Type so presigned GETs
 * stream with the right MIME header (browsers honour this for inline PDF
 * preview).
 */
export async function putBytes(opts: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ key: string }> {
  const client = getClient();
  const cmd = new PutObjectCommand({
    Bucket: getBucket(),
    Key: opts.key,
    Body: opts.body,
    ContentType: opts.contentType,
    // No public-read ACL — bucket policy is private.
  });
  await client.send(cmd);
  console.log(
    `[s3:put] key=${opts.key} bytes=${opts.body.byteLength} ct=${opts.contentType}`,
  );
  return { key: opts.key };
}

/**
 * Generate a short-lived signed download URL. TTL defaults to 1 hour.
 *
 * Use cases:
 *   - /api/deck/[startupId] redirects the (authed) viewer to this URL.
 *   - Server-rendered profile pages can pass this to <iframe src=...>
 *     for inline deck preview when we add that.
 */
export async function presignedGetUrl(opts: {
  key: string;
  /** TTL in seconds. Default 3600 (1 hour). Capped at 7d (S3 max). */
  expiresIn?: number;
  /** Force a specific filename in the Content-Disposition header. */
  downloadAs?: string;
}): Promise<string> {
  const client = getClient();
  const expiresIn = Math.min(Math.max(opts.expiresIn ?? 3600, 60), 7 * 24 * 3600);
  const cmd = new GetObjectCommand({
    Bucket: getBucket(),
    Key: opts.key,
    ResponseContentDisposition: opts.downloadAs
      ? `inline; filename="${escapeFilename(opts.downloadAs)}"`
      : undefined,
  });
  const url = await getSignedUrl(client, cmd, { expiresIn });
  return url;
}

/**
 * Delete an object. Idempotent — a 404 from S3 is treated as success.
 * Used by the upload route when replacing an existing deck, and (later)
 * by the account-deletion cron.
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    console.log(`[s3:delete] key=${key}`);
  } catch (err) {
    // Treat NoSuchKey as a no-op. Anything else surfaces.
    const code = (err as { Code?: string; name?: string } | null)?.Code
      ?? (err as { name?: string } | null)?.name;
    if (code === "NoSuchKey" || code === "NotFound") return;
    throw err;
  }
}

/** True if the object exists. Used by smoke checks; cheap. */
export async function objectExists(key: string): Promise<boolean> {
  const client = getClient();
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } } | null)
      ?.$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw err;
  }
}

/** RFC 5987-safe filename for Content-Disposition. */
function escapeFilename(name: string): string {
  return name.replace(/[\\"\n\r]/g, "_").slice(0, 200);
}
