import { withUserRls } from "@/lib/db";

/**
 * Duplicate scanner. Finds pairs of users that share:
 *   - Same LinkedIn URL
 *   - Same email domain + similar name (first 5 chars lowercase match)
 *
 * Inserts into duplicate_candidates with (smaller_id, larger_id) ordering
 * so the unique constraint prevents re-flagging the same pair.
 *
 * Called from a cron endpoint once per day.
 */
export async function scanForDuplicates(): Promise<number> {
  return withUserRls<number>(null, async (sql) => {
    // LinkedIn URL matches (non-null, same URL, different users).
    const linkedinCount = await sql<{ count: number }[]>`
      with pairs as (
        select a.id as a_id, b.id as b_id
        from public.users a
        join public.users b on a.linkedin_url = b.linkedin_url
          and a.id < b.id
          and a.linkedin_url is not null
          and a.linkedin_url <> ''
      )
      insert into public.duplicate_candidates (user_a_id, user_b_id, reason, score)
      select a_id, b_id, 'Same LinkedIn URL', 0.9
      from pairs
      on conflict (user_a_id, user_b_id) do nothing
      returning 1 as inserted
    `;

    // Email domain + name prefix match.
    const emailCount = await sql<{ count: number }[]>`
      with pairs as (
        select a.id as a_id, b.id as b_id
        from public.users a
        join public.users b
          on split_part(a.email, '@', 2) = split_part(b.email, '@', 2)
          and lower(left(a.name, 5)) = lower(left(b.name, 5))
          and a.id < b.id
          and a.name is not null and b.name is not null
          and length(a.name) >= 3 and length(b.name) >= 3
          and split_part(a.email, '@', 2) not in (
            'gmail.com','outlook.com','yahoo.com','hotmail.com',
            'icloud.com','protonmail.com','proton.me'
          )
      )
      insert into public.duplicate_candidates (user_a_id, user_b_id, reason, score)
      select a_id, b_id, 'Same email domain + similar name', 0.6
      from pairs
      on conflict (user_a_id, user_b_id) do nothing
      returning 1 as inserted
    `;

    const total = (linkedinCount.length ?? 0) + (emailCount.length ?? 0);
    console.log(`[duplicates] scan found ${total} new candidates`);
    return total;
  });
}

export type DuplicateCandidate = {
  id: string;
  userA: { id: string; name: string | null; email: string };
  userB: { id: string; name: string | null; email: string };
  reason: string;
  score: number;
  status: string;
  createdAt: Date;
};

export async function fetchPendingDuplicates(): Promise<DuplicateCandidate[]> {
  return withUserRls<DuplicateCandidate[]>(null, async (sql) => {
    type Row = {
      id: string;
      user_a_id: string;
      user_b_id: string;
      reason: string;
      score: number;
      status: string;
      created_at: Date | string;
      a_name: string | null;
      a_email: string;
      b_name: string | null;
      b_email: string;
    };
    const rows = await sql<Row[]>`
      select dc.id, dc.user_a_id, dc.user_b_id, dc.reason, dc.score,
             dc.status, dc.created_at,
             a.name as a_name, a.email as a_email,
             b.name as b_name, b.email as b_email
      from public.duplicate_candidates dc
      join public.users a on a.id = dc.user_a_id
      join public.users b on b.id = dc.user_b_id
      where dc.status = 'pending'
      order by dc.score desc, dc.created_at desc
      limit 100
    `;
    return rows.map((r) => ({
      id: r.id,
      userA: { id: r.user_a_id, name: r.a_name, email: r.a_email },
      userB: { id: r.user_b_id, name: r.b_name, email: r.b_email },
      reason: r.reason,
      score: r.score,
      status: r.status,
      createdAt: new Date(r.created_at),
    }));
  });
}

export async function dismissDuplicate(
  candidateId: string,
  reviewerId: string,
): Promise<void> {
  await withUserRls(null, async (sql) => {
    await sql`
      update public.duplicate_candidates
      set status = 'dismissed', reviewed_by = ${reviewerId}, reviewed_at = now()
      where id = ${candidateId}
    `;
  });
}
