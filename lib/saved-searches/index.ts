import { withUserRls } from "@/lib/db";
import { parseFeedFilters, type FeedFilters } from "@/lib/feed/filters";

/**
 * Read-only helpers for saved_searches. Mutations live in the route's
 * server actions so they can revalidate the right paths.
 */

export type SavedSearch = {
  id: string;
  name: string;
  filters: FeedFilters;
  notifyEmail: boolean;
  lastNotifiedAt: Date | null;
  createdAt: Date;
};

type Row = {
  id: string;
  name: string;
  filters: unknown;
  notify_email: boolean;
  last_notified_at: Date | string | null;
  created_at: Date | string;
};

function rowToModel(row: Row): SavedSearch {
  // We trust nothing — re-parse via parseFeedFilters which is tolerant.
  // This protects us from old shapes after we evolve filters later.
  const params = filtersJsonToRecord(row.filters);
  return {
    id: row.id,
    name: row.name,
    filters: parseFeedFilters(params),
    notifyEmail: row.notify_email,
    lastNotifiedAt: row.last_notified_at ? new Date(row.last_notified_at) : null,
    createdAt: new Date(row.created_at),
  };
}

function filtersJsonToRecord(filters: unknown): Record<string, string> {
  if (!filters || typeof filters !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters as Record<string, unknown>)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      const joined = v.filter(Boolean).map(String).join(",");
      if (joined) out[k] = joined;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

export async function fetchSavedSearches(userId: string): Promise<SavedSearch[]> {
  return withUserRls<SavedSearch[]>(userId, async (sql) => {
    const rows = await sql<Row[]>`
      select id, name, filters, notify_email, last_notified_at, created_at
      from public.saved_searches
      where user_id = ${userId}
      order by created_at desc
    `;
    return rows.map(rowToModel);
  });
}
