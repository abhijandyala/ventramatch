import { withUserRls } from "@/lib/db";

export type AppNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function fetchUnreadCount(userId: string): Promise<number> {
  return withUserRls<number>(userId, async (sql) => {
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from public.notifications
      where user_id = ${userId} and read_at is null
    `;
    return rows[0]?.count ?? 0;
  });
}

export async function fetchRecent(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<AppNotification[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  return withUserRls<AppNotification[]>(userId, async (sql) => {
    const rows = await sql<{
      id: string;
      kind: string;
      payload: Record<string, unknown>;
      link: string | null;
      read_at: Date | null;
      created_at: Date | string;
    }[]>`
      select id, kind, payload, link, read_at, created_at
      from public.notifications
      where user_id = ${userId}
        ${opts.unreadOnly ? sql`and read_at is null` : sql``}
      order by created_at desc
      limit ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      payload: r.payload ?? {},
      link: r.link,
      readAt: r.read_at ? new Date(r.read_at) : null,
      createdAt: new Date(r.created_at),
    }));
  });
}
