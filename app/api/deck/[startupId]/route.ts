import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { hasContactUnlocked } from "@/lib/profile/visibility";
import {
  isValidDeckKey,
  presignedGetUrl,
  objectExists,
} from "@/lib/storage/s3";

/**
 * GET /api/deck/[startupId]
 *
 * Returns a 302 redirect to a 1-hour presigned S3 download URL — OR a 404
 * if the viewer isn't allowed to see this deck.
 *
 * Allowed viewers:
 *   1. The owner (their own startup row).
 *   2. Anyone who has a mutual match with the owner (contact unlocked).
 *
 * NOT allowed (deliberately 404, not 403, to avoid signal leak):
 *   - Tier 1 viewers (verified or not) without a match.
 *   - Anonymous (no session) requests.
 *
 * Why redirect instead of streaming through the route:
 *   - S3's presigned GET is faster (CDN-fronted, no Railway hop).
 *   - Lighter on our compute. The redirect is microseconds.
 *   - Browsers handle Content-Disposition correctly out of the box.
 *
 * The 1-hour TTL is a tradeoff: long enough that opening the link a few
 * minutes later still works, short enough that a leaked URL goes stale fast.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ startupId: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { startupId } = await ctx.params;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  if (!viewerId) {
    // No session = not allowed. 404 looks the same to a probing client.
    return notFoundResponse();
  }

  // Look up the deck owner + key. RLS (under the viewer's userId) doesn't
  // restrict reads on startups (it's `using (true)`), so we get the row.
  type Row = {
    user_id: string;
    deck_storage_key: string | null;
    deck_filename: string | null;
    deck_url: string | null;
  };
  const row = await withUserRls<Row | null>(viewerId, async (sql) => {
    const rows = await sql<Row[]>`
      select user_id, deck_storage_key, deck_filename, deck_url
      from public.startups
      where id = ${startupId}
      limit 1
    `;
    return rows[0] ?? null;
  });

  if (!row) {
    return notFoundResponse();
  }

  const isOwner = row.user_id === viewerId;
  const unlocked = isOwner || (await hasContactUnlocked(viewerId, row.user_id));
  if (!unlocked) {
    console.log(
      `[deck:get] denied viewer=${viewerId} target=${row.user_id} startup=${startupId}`,
    );
    return notFoundResponse();
  }

  // Prefer the in-bucket deck. Fall back to the legacy external URL.
  if (row.deck_storage_key && isValidDeckKey(row.deck_storage_key)) {
    let url: string;
    try {
      url = await presignedGetUrl({
        key: row.deck_storage_key,
        expiresIn: 60 * 60,
        downloadAs: row.deck_filename ?? "deck.pdf",
      });
    } catch (err) {
      console.error("[deck:get] presign failed", err);
      return new NextResponse("Storage error.", { status: 500 });
    }
    console.log(
      `[deck:get] ok viewer=${viewerId} target=${row.user_id} key=${row.deck_storage_key}`,
    );
    return NextResponse.redirect(url, 302);
  }

  if (row.deck_url) {
    // External link (DocSend, Drive, Notion, etc.). Just bounce.
    console.log(
      `[deck:get] external viewer=${viewerId} target=${row.user_id} url=${row.deck_url}`,
    );
    return NextResponse.redirect(row.deck_url, 302);
  }

  // No deck of either kind.
  return notFoundResponse();
}

/**
 * Owner-only HEAD probe — returns 200 if the deck is present, 404 otherwise.
 * Useful for the uploader UI to verify a successful upload landed.
 */
export async function HEAD(req: NextRequest, ctx: RouteContext) {
  const { startupId } = await ctx.params;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  if (!viewerId) return new NextResponse(null, { status: 404 });

  type Row = { user_id: string; deck_storage_key: string | null };
  const row = await withUserRls<Row | null>(viewerId, async (sql) => {
    const rows = await sql<Row[]>`
      select user_id, deck_storage_key from public.startups
      where id = ${startupId} limit 1
    `;
    return rows[0] ?? null;
  });

  if (!row || row.user_id !== viewerId || !row.deck_storage_key) {
    return new NextResponse(null, { status: 404 });
  }
  if (!isValidDeckKey(row.deck_storage_key)) {
    return new NextResponse(null, { status: 404 });
  }

  const exists = await objectExists(row.deck_storage_key);
  return new NextResponse(null, { status: exists ? 200 : 404 });
}

function notFoundResponse(): NextResponse {
  return new NextResponse("Not found.", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
