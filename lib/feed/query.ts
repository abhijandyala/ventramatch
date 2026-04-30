import { withUserRls } from "@/lib/db";
import { scoreMatch, type MatchResult, type MatchDepthContext } from "@/lib/matching/score";
import {
  projectStartupTier1,
  projectInvestorTier1,
  type StartupPublic,
  type InvestorPublic,
} from "@/lib/profile/visibility";
import type { FeedFilters } from "@/lib/feed/filters";
import { resolveAvatarUrl } from "@/lib/profile/avatar";
import type {
  Database,
  InteractionAction,
  StartupStage,
} from "@/types/database";

type TractionSignalRow =
  Database["public"]["Tables"]["startup_traction_signals"]["Row"];
type CheckBandRow =
  Database["public"]["Tables"]["investor_check_bands"]["Row"];

/**
 * Discovery feed queries. Centralised so the dashboard's "Recommended for
 * you" rail and the full /feed page hit the same data.
 *
 * Visibility rules (Sprint 4 → Sprint 5 wiring):
 *   - Only show counterparties whose `account_label = 'verified'` (a human
 *     reviewer has signed off; auto-review alone is not enough).
 *   - Hide anyone the viewer has already passed on (interactions.action='pass').
 *   - Hide anyone with whom the viewer already has a mutual match (live
 *     in /matches instead).
 *   - Always project to Tier 1 — Tier 2 fields (deck URL, contact, exact
 *     check size) only render on /p/[userId] after a mutual match is unlocked.
 *
 * Ranking: scoreMatch from lib/matching/score.ts.
 */

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

export type FeedStartupCard = {
  card: StartupPublic;
  match: MatchResult;
  /** Viewer's previous interaction (if any) — drives the button state. */
  viewerAction: InteractionAction | null;
};

export type FeedInvestorCard = {
  card: InvestorPublic;
  match: MatchResult;
  viewerAction: InteractionAction | null;
};

// ──────────────────────────────────────────────────────────────────────────
//  Investor side: fetch startups
// ──────────────────────────────────────────────────────────────────────────

export async function fetchFeedForInvestor(
  investorUserId: string,
  opts: { limit?: number; minScore?: number; filters?: FeedFilters } = {},
): Promise<FeedStartupCard[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const minScore = opts.minScore ?? 0;
  const filters = opts.filters;
  const q = filters?.q?.trim() || null;
  const industries = filters?.industries ?? [];
  const stages = filters?.stages ?? [];
  const geographies = filters?.geographies ?? [];
  const amountMin = filters?.amountMin ?? null;
  const amountMax = filters?.amountMax ?? null;
  const sort = filters?.sort ?? "score";

  // When filters narrow results, fetch a wider window so app-side scoring
  // still has enough rows to rank from.
  const prefetch = Math.min(1000, limit * 4);

  return withUserRls<FeedStartupCard[]>(investorUserId, async (sql) => {
    const investorRows = await sql<InvestorRow[]>`
      select * from public.investors where user_id = ${investorUserId} limit 1
    `;
    const investor = investorRows[0];
    if (!investor) {
      console.log(`[feed:investor] no investor row for ${investorUserId} — empty feed`);
      return [];
    }

    // Filters are inlined as `(${noFilter} OR <condition>)` so we don't
    // have to dynamically build the SQL string.
    type Row = StartupRow & { viewer_action: InteractionAction | null };
    const startupRows = await sql<Row[]>`
      select s.*,
             (
               select i.action
               from public.interactions i
               where i.actor_user_id = ${investorUserId}
                 and i.target_user_id = s.user_id
               order by i.created_at desc
               limit 1
             ) as viewer_action
      from public.startups s
      join public.users u on u.id = s.user_id
      left join public.matches m
        on (m.founder_user_id = s.user_id and m.investor_user_id = ${investorUserId})
      where u.account_label = 'verified'
        and u.account_paused_at is null
        and u.deletion_requested_at is null
        and s.user_id <> ${investorUserId}
        and m.id is null
        and not exists (
          select 1 from public.interactions ix
          where ix.actor_user_id = ${investorUserId}
            and ix.target_user_id = s.user_id
            and ix.action = 'pass'
        )
        and not exists (
          select 1 from public.blocks bl
          where (bl.blocker_user_id = ${investorUserId} and bl.blocked_user_id = s.user_id)
             or (bl.blocker_user_id = s.user_id and bl.blocked_user_id = ${investorUserId})
        )
        and (${industries.length === 0} or s.startup_sectors && ${industries}::text[])
        and (${stages.length === 0} or s.stage::text = any(${stages.map((s) => String(s))}))
        and (${geographies.length === 0} or exists (
          select 1 from unnest(${geographies}::text[]) as geo(g)
          where s.location ilike '%' || geo.g || '%'
        ))
        and (${amountMin === null} or s.raise_amount >= ${amountMin ?? 0})
        and (${amountMax === null} or s.raise_amount <= ${amountMax ?? 0})
        and (${q === null} or s.search_vector @@ plainto_tsquery('english', ${q ?? ""}))
      order by ${
        sort === "recent"
          ? sql`s.created_at desc`
          : q
            ? sql`ts_rank(s.search_vector, plainto_tsquery('english', ${q})) desc, s.created_at desc`
            : sql`s.created_at desc`
      }
      limit ${prefetch}
    `;

    // Load depth signals for all fetched startups in one query so we can
    // pass structured traction + round context to scoreMatch. We do this
    // outside the main query so the feed SQL stays readable.
    const startupIds = startupRows.map((r) => r.id);
    const [tractionRows, roundRows] = startupIds.length > 0
      ? await Promise.all([
          sql<(TractionSignalRow & { startup_id: string })[]>`
            select startup_id, kind, value_numeric, source_kind, self_reported
            from public.startup_traction_signals
            where startup_id = any(${startupIds})
          `,
          sql<{ startup_id: string; lead_status: string }[]>`
            select startup_id, lead_status
            from public.startup_round_details
            where startup_id = any(${startupIds})
          `,
        ])
      : [[], []];

    const tractionByStartup = new Map<string, TractionSignalRow[]>();
    for (const t of tractionRows) {
      const arr = tractionByStartup.get(t.startup_id) ?? [];
      arr.push(t as TractionSignalRow);
      tractionByStartup.set(t.startup_id, arr);
    }
    const leadStatusByStartup = new Map<string, string>();
    for (const r of roundRows) {
      leadStatusByStartup.set(r.startup_id, r.lead_status);
    }

    const scored = startupRows
      .map((row) => {
        const depthCtx: MatchDepthContext = {
          tractionSignals: tractionByStartup.get(row.id),
          wantsLead:
            leadStatusByStartup.get(row.id) === "open" ||
            leadStatusByStartup.get(row.id) === "soliciting_lead",
        };
        const match = scoreMatch(row, investor, depthCtx);
        return {
          card: projectStartupTier1(row),
          match,
          viewerAction: row.viewer_action,
        };
      })
      .filter((x) => x.match.score >= minScore);

    // For "score" sort we still rank app-side by match score; "recent" / FTS
    // ranking is preserved as the SQL gave us.
    if (sort === "score") {
      scored.sort((a, b) => b.match.score - a.match.score);
    }
    const out = scored.slice(0, limit);

    console.log(
      `[feed:investor] userId=${investorUserId} returned=${out.length} q=${q ?? ""} industries=${industries.length} stages=${stages.length} geos=${geographies.length}`,
    );
    return out;
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  Founder side: fetch investors
// ──────────────────────────────────────────────────────────────────────────

export async function fetchFeedForFounder(
  founderUserId: string,
  opts: { limit?: number; minScore?: number; filters?: FeedFilters } = {},
): Promise<FeedInvestorCard[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const minScore = opts.minScore ?? 0;
  const filters = opts.filters;
  const q = filters?.q?.trim() || null;
  // From a founder's perspective these arrays describe the investor side.
  const sectors = filters?.industries ?? [];
  const stages = filters?.stages ?? [];
  const geographies = filters?.geographies ?? [];
  // Founders filter by investor check size; min and max overlap if either is
  // set. Semantics: "show investors whose check size could plausibly include
  // amounts in [amountMin, amountMax]" — i.e. their range overlaps ours.
  const amountMin = filters?.amountMin ?? null;
  const amountMax = filters?.amountMax ?? null;
  const sort = filters?.sort ?? "score";
  const prefetch = Math.min(1000, limit * 4);

  return withUserRls<FeedInvestorCard[]>(founderUserId, async (sql) => {
    const startupRows = await sql<StartupRow[]>`
      select * from public.startups where user_id = ${founderUserId} limit 1
    `;
    const startup = startupRows[0];
    if (!startup) {
      console.log(`[feed:founder] no startup row for ${founderUserId} — empty feed`);
      return [];
    }

    type Row = InvestorRow & { viewer_action: InteractionAction | null };
    const investorRows = await sql<Row[]>`
      select i.*,
             (
               select x.action
               from public.interactions x
               where x.actor_user_id = ${founderUserId}
                 and x.target_user_id = i.user_id
               order by x.created_at desc
               limit 1
             ) as viewer_action
      from public.investors i
      join public.users u on u.id = i.user_id
      left join public.matches m
        on (m.investor_user_id = i.user_id and m.founder_user_id = ${founderUserId})
      where u.account_label = 'verified'
        and u.account_paused_at is null
        and u.deletion_requested_at is null
        and i.user_id <> ${founderUserId}
        and i.is_active = true
        and m.id is null
        and not exists (
          select 1 from public.interactions ix
          where ix.actor_user_id = ${founderUserId}
            and ix.target_user_id = i.user_id
            and ix.action = 'pass'
        )
        and not exists (
          select 1 from public.blocks bl
          where (bl.blocker_user_id = ${founderUserId} and bl.blocked_user_id = i.user_id)
             or (bl.blocker_user_id = i.user_id and bl.blocked_user_id = ${founderUserId})
        )
        -- Sector intersect: investor.sectors && [filter sectors]
        and (${sectors.length === 0} or i.sectors && ${sectors}::text[])
        -- Stage intersect: investor.stages && [filter stages]
        and (${stages.length === 0} or i.stages::text[] && ${stages.map((s) => String(s))}::text[])
        and (${geographies.length === 0} or i.geographies && ${geographies}::text[])
        -- Range overlap: investor's [check_min, check_max] intersects [amountMin, amountMax]
        and (${amountMin === null} or i.check_max >= ${amountMin ?? 0})
        and (${amountMax === null} or i.check_min <= ${amountMax ?? 0})
        and (${q === null} or i.search_vector @@ plainto_tsquery('english', ${q ?? ""}))
      order by ${
        sort === "recent"
          ? sql`i.created_at desc`
          : q
            ? sql`ts_rank(i.search_vector, plainto_tsquery('english', ${q})) desc, i.created_at desc`
            : sql`i.created_at desc`
      }
      limit ${prefetch}
    `;

    // Load per-stage check bands for all fetched investors so scoreMatch
    // can use the richer mandate data when available.
    const investorIds = investorRows.map((r) => r.id);
    const checkBandRows: CheckBandRow[] = investorIds.length > 0
      ? await sql<CheckBandRow[]>`
          select * from public.investor_check_bands
          where investor_id = any(${investorIds})
        `
      : [];

    const checkBandsByInvestor = new Map<string, CheckBandRow[]>();
    for (const b of checkBandRows) {
      const arr = checkBandsByInvestor.get(b.investor_id) ?? [];
      arr.push(b);
      checkBandsByInvestor.set(b.investor_id, arr);
    }

    // Also pull the founder startup's own traction signals for the depth context.
    const [founderTractionRows, founderRoundRows] = await Promise.all([
      sql<TractionSignalRow[]>`
        select kind, value_numeric, source_kind, self_reported
        from public.startup_traction_signals
        where startup_id = ${startup.id}
      `,
      sql<{ lead_status: string }[]>`
        select lead_status from public.startup_round_details
        where startup_id = ${startup.id}
        limit 1
      `,
    ]);

    const founderLeadStatus = founderRoundRows[0]?.lead_status;

    const scored = investorRows
      .map((row) => {
        const depthCtx: MatchDepthContext = {
          tractionSignals: founderTractionRows,
          checkBands: checkBandsByInvestor.get(row.id),
          wantsLead:
            founderLeadStatus === "open" ||
            founderLeadStatus === "soliciting_lead",
        };
        const match = scoreMatch(startup, row, depthCtx);
        return {
          card: projectInvestorTier1(row),
          match,
          viewerAction: row.viewer_action,
        };
      })
      .filter((x) => x.match.score >= minScore);

    if (sort === "score") {
      scored.sort((a, b) => b.match.score - a.match.score);
    }
    const out = scored.slice(0, limit);

    console.log(
      `[feed:founder] userId=${founderUserId} returned=${out.length} q=${q ?? ""} sectors=${sectors.length} stages=${stages.length} geos=${geographies.length}`,
    );
    return out;
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  Counters for the dashboard
// ──────────────────────────────────────────────────────────────────────────

export type ProfileStats = {
  saves: number;
  likes: number;
  passes: number;
  matches: number;
};

export type RecentViewer = {
  viewerId: string;
  /** ISO timestamp of the most recent view by this viewer. */
  lastViewedAt: Date;
  /** Tally of total views by this viewer (within the lookback window). */
  count: number;
  /** Display info — null if the viewer has been deleted or paused-and-blank. */
  name: string | null;
  role: "founder" | "investor" | null;
  startupName: string | null;
  firm: string | null;
  /**
   * Verified viewers see counterpart names; unverified viewers are
   * anonymised by the UI. We always carry the data here and let the
   * presenter decide.
   */
  verified: boolean;
  /** Sprint 9.5.C: resolved avatar URL or null (initials fallback). */
  avatarSrc: string | null;
};

/**
 * Who viewed me — most recent unique viewers in a 30-day lookback window.
 *
 * Aggregated by viewer so a single user who refreshed your profile 5 times
 * shows up as one row with `count: 5`.
 */
export async function fetchRecentViewers(
  userId: string,
  opts: { limit?: number; lookbackDays?: number } = {},
): Promise<RecentViewer[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 8, 50));
  const lookback = Math.max(1, Math.min(opts.lookbackDays ?? 30, 90));

  return withUserRls<RecentViewer[]>(userId, async (sql) => {
    type Row = {
      viewer_user_id: string;
      last_viewed_at: Date | string;
      count: number;
      name: string | null;
      role: "founder" | "investor" | null;
      account_label: string;
      startup_name: string | null;
      firm: string | null;
      // Avatar fields, joined from public.users
      image: string | null;
      avatar_storage_key: string | null;
      avatar_url: string | null;
      avatar_updated_at: Date | string | null;
    };
    const rows = await sql<Row[]>`
      with windowed as (
        select viewer_user_id, max(viewed_at) as last_viewed_at, count(*)::int as count
        from public.profile_views
        where target_user_id = ${userId}
          and viewed_at > now() - (${lookback} || ' days')::interval
        group by viewer_user_id
        order by last_viewed_at desc
        limit ${limit}
      )
      select w.viewer_user_id, w.last_viewed_at, w.count,
             u.name, u.role, u.account_label,
             u.image, u.avatar_storage_key, u.avatar_url, u.avatar_updated_at,
             s.name as startup_name,
             inv.firm
      from windowed w
      join public.users u on u.id = w.viewer_user_id
      left join public.startups s on s.user_id = w.viewer_user_id
      left join public.investors inv on inv.user_id = w.viewer_user_id
      where u.account_paused_at is null
        and u.deletion_requested_at is null
        and not exists (
          select 1 from public.blocks bl
          where (bl.blocker_user_id = ${userId} and bl.blocked_user_id = w.viewer_user_id)
             or (bl.blocker_user_id = w.viewer_user_id and bl.blocked_user_id = ${userId})
        )
      order by w.last_viewed_at desc
    `;
    // Resolve avatar URLs in parallel (presigning is local HMAC, no network).
    return Promise.all(
      rows.map(async (r) => ({
        viewerId: r.viewer_user_id,
        lastViewedAt: new Date(r.last_viewed_at),
        count: r.count,
        name: r.name,
        role: r.role,
        startupName: r.startup_name,
        firm: r.firm,
        verified: r.account_label === "verified",
        avatarSrc: await resolveAvatarUrl({
          storageKey: r.avatar_storage_key,
          cachedUrl: r.avatar_url,
          cachedAt: r.avatar_updated_at,
          oauthImage: r.image,
        }),
      })),
    );
  });
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  return withUserRls<ProfileStats>(userId, async (sql) => {
    const [interactionRows, matchRows] = await Promise.all([
      sql<{ action: InteractionAction; count: number }[]>`
        select action, count(*)::int as count
        from public.interactions
        where target_user_id = ${userId}
        group by action
      `,
      sql<{ count: number }[]>`
        select count(*)::int as count
        from public.matches
        where founder_user_id = ${userId} or investor_user_id = ${userId}
      `,
    ]);

    const stats: ProfileStats = { saves: 0, likes: 0, passes: 0, matches: matchRows[0]?.count ?? 0 };
    for (const row of interactionRows) {
      if (row.action === "save") stats.saves = row.count;
      if (row.action === "like") stats.likes = row.count;
      if (row.action === "pass") stats.passes = row.count;
    }
    return stats;
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  Mutual matches list (for /matches)
// ──────────────────────────────────────────────────────────────────────────

export type MutualMatch = {
  matchId: string;
  matchedAt: Date;
  contactUnlocked: boolean;
  /** The OTHER user's role + identity. */
  otherUserId: string;
  otherRole: "founder" | "investor";
  /** Display name of the other party (their users.name). */
  otherName: string | null;
  /** Sprint 9.5.C: resolved avatar URL of the other party. */
  otherAvatarSrc: string | null;
  startupName?: string;
  investorName?: string;
  industry?: string;
  stage?: StartupStage;
  firm?: string | null;
};

export async function fetchMutualMatches(userId: string): Promise<MutualMatch[]> {
  return withUserRls<MutualMatch[]>(userId, async (sql) => {
    type Row = {
      id: string;
      matched_at: Date | string;
      contact_unlocked: boolean;
      founder_user_id: string;
      investor_user_id: string;
      startup_name: string | null;
      industry: string | null;
      stage: StartupStage | null;
      investor_name: string | null;
      firm: string | null;
      // Avatar fields for the OTHER party (computed via case in select).
      other_name: string | null;
      other_image: string | null;
      other_avatar_storage_key: string | null;
      other_avatar_url: string | null;
      other_avatar_updated_at: Date | string | null;
    };
    const rows = await sql<Row[]>`
      select m.id, m.matched_at, m.contact_unlocked,
             m.founder_user_id, m.investor_user_id,
             s.name as startup_name, s.industry, s.stage,
             i.name as investor_name, i.firm,
             other_u.name as other_name,
             other_u.image as other_image,
             other_u.avatar_storage_key as other_avatar_storage_key,
             other_u.avatar_url as other_avatar_url,
             other_u.avatar_updated_at as other_avatar_updated_at
      from public.matches m
      left join public.startups s on s.user_id = m.founder_user_id
      left join public.investors i on i.user_id = m.investor_user_id
      join public.users other_u
        on other_u.id = case
                          when m.founder_user_id = ${userId} then m.investor_user_id
                          else m.founder_user_id
                        end
      where (m.founder_user_id = ${userId} or m.investor_user_id = ${userId})
        -- Hide matches with blocked users (either direction). The match
        -- row stays in the table for audit; we just stop surfacing it.
        and not exists (
          select 1 from public.blocks bl
          where (
            (bl.blocker_user_id = ${userId} and bl.blocked_user_id in (m.founder_user_id, m.investor_user_id))
            or (bl.blocked_user_id = ${userId} and bl.blocker_user_id in (m.founder_user_id, m.investor_user_id))
          )
        )
      order by m.matched_at desc
    `;
    return Promise.all(
      rows.map(async (r) => {
        const isFounder = r.founder_user_id === userId;
        return {
          matchId: r.id,
          matchedAt: new Date(r.matched_at),
          contactUnlocked: r.contact_unlocked,
          otherUserId: isFounder ? r.investor_user_id : r.founder_user_id,
          otherRole: isFounder ? "investor" : "founder",
          otherName: r.other_name,
          otherAvatarSrc: await resolveAvatarUrl({
            storageKey: r.other_avatar_storage_key,
            cachedUrl: r.other_avatar_url,
            cachedAt: r.other_avatar_updated_at,
            oauthImage: r.other_image,
          }),
          startupName: !isFounder ? r.startup_name ?? undefined : undefined,
          investorName: isFounder ? r.investor_name ?? undefined : undefined,
          industry: r.industry ?? undefined,
          stage: r.stage ?? undefined,
          firm: r.firm,
        };
      }),
    );
  });
}
