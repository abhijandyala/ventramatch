import { withUserRls } from "@/lib/db";
import type {
  AccountLabel,
  Database,
  StartupStage,
} from "@/types/database";

/**
 * Profile visibility tiers — what fields are exposed to whom.
 *
 * THREE TIERS (extends the original Tier 1 / Tier 2 split with a
 * verified-viewer-pre-match tier so serious investors get a real
 * diligence kit before contact unlocks):
 *
 *   "public"   — any authenticated user, target verified. Discovery-card
 *                level: name, sector, stage, one-liner, raise BUCKET (not
 *                exact), thesis preview. Verification badges visible.
 *                None of the depth-table data renders.
 *
 *   "verified" — viewer's `account_label='verified'` AND target's
 *                `account_label='verified'`. Pre-match diligence:
 *                team, structured round details, cap-table summary,
 *                use-of-funds, traction signals (without raw evidence
 *                URLs), market analysis, competitive landscape on the
 *                startup side; team, per-stage check bands, public
 *                portfolio rows, track record (sans dry powder),
 *                decision process, value-add, anti-patterns on the
 *                investor side. Exact figures for the founder's
 *                stated ASK are visible because the ASK is the founder's
 *                disclosed intent (same convention as the existing
 *                `startups.raise_amount` column).
 *
 *   "match"    — viewer and target have a mutual match (or viewer IS the
 *                target). Everything in "verified" PLUS deck URL, raw
 *                traction `evidence_url`, dry-powder band, private
 *                portfolio rows. Contact email only flows through the
 *                intro-request workflow — it is never rendered as a
 *                Tier-2 field on the profile page.
 *
 * Pure projection — no I/O in the project* helpers. `resolveTier` is
 * the only async call and it does the contact-unlocked / account-label
 * checks against the DB.
 */
export type ViewingTier = "public" | "verified" | "match";

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

export type StartupPublic = {
  id: string;
  userId: string;
  name: string;
  oneLiner: string;
  industry: string;
  stage: StartupStage;
  /**
   * Raise amount bucketed for public display: small / med / large.
   * Exact dollar figure is Tier 2 only.
   */
  raiseBucket: "small" | "medium" | "large" | null;
  location: string | null;
  website: string | null;
  /** Tier 2 only: empty string for tier-1 readers. */
  deckUrl: "";
  /** Tier 2 only: empty for tier-1. */
  raiseAmount: null;
  traction: null;
};

export type StartupFull = Omit<StartupRow, "created_at" | "updated_at">;

export function projectStartupTier1(row: StartupRow): StartupPublic {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    oneLiner: row.one_liner,
    industry: row.industry,
    stage: row.stage,
    raiseBucket: bucketRaise(row.raise_amount),
    location: row.location,
    website: row.website,
    deckUrl: "",
    raiseAmount: null,
    traction: null,
  };
}

export function projectStartupTier2(row: StartupRow): StartupFull {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    one_liner: row.one_liner,
    industry: row.industry,
    stage: row.stage,
    raise_amount: row.raise_amount,
    traction: row.traction,
    location: row.location,
    // Sprint 9.5.B: when an in-bucket deck exists, route the viewer
    // through our authed download path so we keep the bucket private.
    // External-link decks (legacy / DocSend / Drive) pass through.
    deck_url: effectiveDeckUrl(row.id, row.deck_storage_key, row.deck_url),
    deck_storage_key: row.deck_storage_key,
    deck_filename: row.deck_filename,
    deck_uploaded_at: row.deck_uploaded_at,
    website: row.website,
    startup_sectors: row.startup_sectors,
  };
}

/**
 * Resolve the URL we should expose to a tier-2 viewer for the deck.
 *
 *   - If we have an uploaded file (deck_storage_key set) → return our
 *     authed download route. The route validates the viewer has match
 *     access and issues a 1-hour presigned S3 URL.
 *   - Else if there's an external link → return it untouched.
 *   - Else null.
 *
 * The path is deliberately RELATIVE so it works on any host without
 * needing the request URL.
 */
export function effectiveDeckUrl(
  startupId: string,
  deckStorageKey: string | null | undefined,
  deckUrl: string | null | undefined,
): string | null {
  if (deckStorageKey) return `/api/deck/${startupId}`;
  if (deckUrl) return deckUrl;
  return null;
}

function bucketRaise(amount: number | null): "small" | "medium" | "large" | null {
  if (amount == null || amount <= 0) return null;
  if (amount < 1_000_000) return "small";
  if (amount < 5_000_000) return "medium";
  return "large";
}

export type InvestorPublic = {
  id: string;
  userId: string;
  name: string;
  firm: string | null;
  /** Bucketed for public display. */
  checkBand: "angel" | "small" | "mid" | "large" | null;
  stages: StartupStage[];
  sectors: string[];
  geographies: string[];
  isActive: boolean;
  /** Truncated thesis preview — first 200 chars. */
  thesisPreview: string | null;
  /** Tier 2 only. */
  checkMin: 0;
  checkMax: 0;
  thesis: null;
};

export type InvestorFull = Omit<InvestorRow, "created_at" | "updated_at">;

export function projectInvestorTier1(row: InvestorRow): InvestorPublic {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    firm: row.firm,
    checkBand: bucketCheck(row.check_min, row.check_max),
    stages: row.stages,
    sectors: row.sectors,
    geographies: row.geographies,
    isActive: row.is_active,
    thesisPreview: row.thesis ? row.thesis.slice(0, 200) : null,
    checkMin: 0,
    checkMax: 0,
    thesis: null,
  };
}

export function projectInvestorTier2(row: InvestorRow): InvestorFull {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    firm: row.firm,
    check_min: row.check_min,
    check_max: row.check_max,
    stages: row.stages,
    sectors: row.sectors,
    geographies: row.geographies,
    is_active: row.is_active,
    thesis: row.thesis,
  };
}

function bucketCheck(min: number, max: number): "angel" | "small" | "mid" | "large" | null {
  if (!max) return null;
  const top = max;
  if (top < 50_000) return "angel";
  if (top < 250_000) return "small";
  if (top < 1_000_000) return "mid";
  return "large";
}

/**
 * Check whether viewer and target have a mutual match and contact is
 * unlocked. Used to gate Tier 2 access.
 */
export async function hasContactUnlocked(
  viewerUserId: string,
  targetUserId: string,
): Promise<boolean> {
  if (viewerUserId === targetUserId) return true;
  return withUserRls<boolean>(viewerUserId, async (sql) => {
    const rows = await sql<{ unlocked: boolean }[]>`
      select contact_unlocked as unlocked
      from public.matches
      where (founder_user_id = ${viewerUserId} and investor_user_id = ${targetUserId})
         or (founder_user_id = ${targetUserId} and investor_user_id = ${viewerUserId})
      limit 1
    `;
    return Boolean(rows[0]?.unlocked);
  });
}

/**
 * Resolve the viewing tier for a given (viewer, target) pair.
 *
 *   - `match`    if it's a self-view OR a mutual match exists with
 *                contact unlocked.
 *   - `verified` if both the viewer and the target have
 *                `account_label='verified'`. Verified viewers are
 *                trusted enough to see real diligence material before
 *                expressing interest.
 *   - `public`   otherwise.
 *
 * Pure data — no UI, no copy. `resolveTier` does the contact-unlocked
 * lookup itself; pass the `viewerLabel` from the session so we don't
 * round-trip the DB for that.
 */
export async function resolveTier(
  viewerUserId: string,
  targetUserId: string,
  viewerLabel: AccountLabel,
  targetLabel: AccountLabel,
): Promise<ViewingTier> {
  if (viewerUserId === targetUserId) return "match";
  if (await hasContactUnlocked(viewerUserId, targetUserId)) return "match";
  if (viewerLabel === "verified" && targetLabel === "verified") {
    return "verified";
  }
  return "public";
}

// ──────────────────────────────────────────────────────────────────────────
//  Depth-row projections
// ──────────────────────────────────────────────────────────────────────────
//
// Each project*Depth helper takes the raw rows from `lib/profile/depth.ts`
// plus the resolved `ViewingTier` and returns a tier-appropriate shape.
// The shape stays the same across tiers — gated fields are nulled out
// rather than removed — so downstream UI can branch on "is this null?"
// without needing to know which tier ran.

type StartupTeamMemberRow =
  Database["public"]["Tables"]["startup_team_members"]["Row"];
type StartupRoundDetailsRow =
  Database["public"]["Tables"]["startup_round_details"]["Row"];
type StartupCapTableSummaryRow =
  Database["public"]["Tables"]["startup_cap_table_summary"]["Row"];
type StartupUseOfFundsLineRow =
  Database["public"]["Tables"]["startup_use_of_funds_lines"]["Row"];
type StartupTractionSignalRow =
  Database["public"]["Tables"]["startup_traction_signals"]["Row"];
type StartupMarketAnalysisRow =
  Database["public"]["Tables"]["startup_market_analysis"]["Row"];
type StartupCompetitorRow =
  Database["public"]["Tables"]["startup_competitive_landscape"]["Row"];

type InvestorTeamMemberRow =
  Database["public"]["Tables"]["investor_team_members"]["Row"];
type InvestorCheckBandRow =
  Database["public"]["Tables"]["investor_check_bands"]["Row"];
type InvestorPortfolioRow =
  Database["public"]["Tables"]["investor_portfolio"]["Row"];
type InvestorTrackRecordRow =
  Database["public"]["Tables"]["investor_track_record"]["Row"];
type InvestorDecisionProcessRow =
  Database["public"]["Tables"]["investor_decision_process"]["Row"];
type InvestorValueAddRow =
  Database["public"]["Tables"]["investor_value_add"]["Row"];
type InvestorAntiPatternRow =
  Database["public"]["Tables"]["investor_anti_patterns"]["Row"];

type VerificationRow = Database["public"]["Tables"]["verifications"]["Row"];

export type StartupTeamMemberView = Pick<
  StartupTeamMemberRow,
  | "id"
  | "name"
  | "role"
  | "is_founder"
  | "is_full_time"
  | "bio"
  | "prior_company"
  | "prior_role"
  | "linkedin_url"
  | "github_url"
  | "equity_pct_band"
  | "linked_user_id"
  | "display_order"
>;

export type StartupRoundDetailsView = Pick<
  StartupRoundDetailsRow,
  | "instrument"
  | "valuation_band"
  | "target_raise_usd"
  | "min_check_usd"
  | "lead_status"
  | "close_by_date"
  | "committed_amount_usd"
  | "use_of_funds_summary"
  | "instrument_terms_summary"
>;

export type StartupCapTableSummaryView = Pick<
  StartupCapTableSummaryRow,
  | "founders_pct_band"
  | "employee_pool_pct_band"
  | "outside_investors_pct_band"
  | "prior_raises_count"
  | "last_round_amount_band"
  | "last_round_year"
>;

export type StartupUseOfFundsLineView = Pick<
  StartupUseOfFundsLineRow,
  "id" | "category" | "pct_of_raise" | "narrative" | "display_order"
>;

export type StartupTractionSignalView = Pick<
  StartupTractionSignalRow,
  | "id"
  | "kind"
  | "value_numeric"
  | "period_start"
  | "period_end"
  | "source_kind"
  | "self_reported"
  | "notes"
  | "display_order"
> & {
  /** Tier 2 only — null at "verified" tier. Carries through at "match". */
  evidence_url: string | null;
};

export type StartupMarketAnalysisView = Pick<
  StartupMarketAnalysisRow,
  "tam_band" | "sam_band" | "som_band" | "methodology_summary" | "source_links"
>;

export type StartupCompetitorView = Pick<
  StartupCompetitorRow,
  "id" | "competitor_name" | "differentiation" | "link_url" | "display_order"
>;

export type StartupDepthView = {
  team: StartupTeamMemberView[];
  round: StartupRoundDetailsView | null;
  capTable: StartupCapTableSummaryView | null;
  useOfFunds: StartupUseOfFundsLineView[];
  traction: StartupTractionSignalView[];
  market: StartupMarketAnalysisView | null;
  competitors: StartupCompetitorView[];
  /** Tier-2-only fields surface here so the UI can show a single locked card. */
  matchOnly: {
    deckUrl: string | null;
    rawTraction: string | null;
  };
};

export type InvestorTeamMemberView = Pick<
  InvestorTeamMemberRow,
  | "id"
  | "name"
  | "role"
  | "is_decision_maker"
  | "bio"
  | "linkedin_url"
  | "linked_user_id"
  | "display_order"
>;

export type InvestorCheckBandView = Pick<
  InvestorCheckBandRow,
  | "id"
  | "stage"
  | "role"
  | "check_min_usd"
  | "check_max_usd"
  | "ownership_target_band"
>;

export type InvestorPortfolioView = Pick<
  InvestorPortfolioRow,
  | "id"
  | "company_name"
  | "year"
  | "role"
  | "sector"
  | "is_exited"
  | "exit_kind"
  | "notes"
  | "display_order"
>;

/**
 * Track-record fields. `dry_powder_band` is omitted at the "verified" tier
 * (competitive intel) and surfaced at the "match" tier.
 */
export type InvestorTrackRecordView = Pick<
  InvestorTrackRecordRow,
  | "total_deals_band"
  | "first_money_in_count_band"
  | "follow_on_rate_band"
  | "avg_ownership_band"
  | "fund_size_band"
  | "fund_vintage_year"
> & {
  /** Tier 2 only. */
  dry_powder_band: InvestorTrackRecordRow["dry_powder_band"] | null;
};

export type InvestorDecisionProcessView = Pick<
  InvestorDecisionProcessRow,
  | "time_to_term_sheet_band"
  | "ic_required"
  | "references_required"
  | "data_room_required"
  | "partner_meeting_required"
  | "process_narrative"
>;

export type InvestorValueAddView = Pick<
  InvestorValueAddRow,
  "id" | "kind" | "narrative" | "display_order"
>;

export type InvestorAntiPatternView = Pick<
  InvestorAntiPatternRow,
  "id" | "kind" | "narrative" | "display_order"
>;

export type InvestorDepthView = {
  team: InvestorTeamMemberView[];
  checkBands: InvestorCheckBandView[];
  /** Public portfolio rows only at "verified"; all rows at "match". */
  portfolio: InvestorPortfolioView[];
  trackRecord: InvestorTrackRecordView | null;
  decisionProcess: InvestorDecisionProcessView | null;
  valueAdd: InvestorValueAddView[];
  antiPatterns: InvestorAntiPatternView[];
  /** Counts for tier-1 viewers — they see no rows but they DO see "this profile has X portfolio entries". */
  counts: {
    portfolioPublic: number;
    portfolioPrivate: number;
    team: number;
  };
};

export type VerificationBadge = Pick<
  VerificationRow,
  "id" | "kind" | "verified_at" | "verified_by"
>;

export type StartupDepthInput = {
  team: StartupTeamMemberRow[];
  round: StartupRoundDetailsRow | null;
  capTable: StartupCapTableSummaryRow | null;
  useOfFunds: StartupUseOfFundsLineRow[];
  traction: StartupTractionSignalRow[];
  market: StartupMarketAnalysisRow | null;
  competitors: StartupCompetitorRow[];
  /** Pulled from the parent `startups` row. */
  parent: {
    /** Used to build the authed deck route /api/deck/[startupId]. */
    id: string;
    deck_url: string | null;
    /** Sprint 9.5.B: if set, the deck lives in S3 and is exposed via authed route. */
    deck_storage_key: string | null;
    traction: string | null;
  };
};

export type InvestorDepthInput = {
  team: InvestorTeamMemberRow[];
  checkBands: InvestorCheckBandRow[];
  portfolio: InvestorPortfolioRow[];
  trackRecord: InvestorTrackRecordRow | null;
  decisionProcess: InvestorDecisionProcessRow | null;
  valueAdd: InvestorValueAddRow[];
  antiPatterns: InvestorAntiPatternRow[];
};

/**
 * Project the startup-depth bundle for the given tier.
 *
 *   - "public"   → empty bundle. Counts could be exposed here later if
 *                  product wants to show "team of 4, 5 traction signals"
 *                  on the discovery card; for now we keep it strictly empty
 *                  to match the existing Tier-1 surface.
 *   - "verified" → full structure minus deck, raw traction, and per-signal
 *                  evidence URLs.
 *   - "match"    → everything.
 */
export function projectStartupDepth(
  input: StartupDepthInput,
  tier: ViewingTier,
): StartupDepthView {
  if (tier === "public") {
    return emptyStartupDepth();
  }

  const includeMatchOnly = tier === "match";

  return {
    team: input.team.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      is_founder: row.is_founder,
      is_full_time: row.is_full_time,
      bio: row.bio,
      prior_company: row.prior_company,
      prior_role: row.prior_role,
      linkedin_url: row.linkedin_url,
      github_url: row.github_url,
      equity_pct_band: row.equity_pct_band,
      linked_user_id: row.linked_user_id,
      display_order: row.display_order,
    })),
    round: input.round
      ? {
          instrument: input.round.instrument,
          valuation_band: input.round.valuation_band,
          target_raise_usd: input.round.target_raise_usd,
          min_check_usd: input.round.min_check_usd,
          lead_status: input.round.lead_status,
          close_by_date: input.round.close_by_date,
          committed_amount_usd: input.round.committed_amount_usd,
          use_of_funds_summary: input.round.use_of_funds_summary,
          instrument_terms_summary: input.round.instrument_terms_summary,
        }
      : null,
    capTable: input.capTable
      ? {
          founders_pct_band: input.capTable.founders_pct_band,
          employee_pool_pct_band: input.capTable.employee_pool_pct_band,
          outside_investors_pct_band: input.capTable.outside_investors_pct_band,
          prior_raises_count: input.capTable.prior_raises_count,
          last_round_amount_band: input.capTable.last_round_amount_band,
          last_round_year: input.capTable.last_round_year,
        }
      : null,
    useOfFunds: input.useOfFunds.map((row) => ({
      id: row.id,
      category: row.category,
      pct_of_raise: row.pct_of_raise,
      narrative: row.narrative,
      display_order: row.display_order,
    })),
    traction: input.traction.map((row) => ({
      id: row.id,
      kind: row.kind,
      value_numeric: row.value_numeric,
      period_start: row.period_start,
      period_end: row.period_end,
      source_kind: row.source_kind,
      self_reported: row.self_reported,
      notes: row.notes,
      display_order: row.display_order,
      evidence_url: includeMatchOnly ? row.evidence_url : null,
    })),
    market: input.market
      ? {
          tam_band: input.market.tam_band,
          sam_band: input.market.sam_band,
          som_band: input.market.som_band,
          methodology_summary: input.market.methodology_summary,
          source_links: input.market.source_links,
        }
      : null,
    competitors: input.competitors.map((row) => ({
      id: row.id,
      competitor_name: row.competitor_name,
      differentiation: row.differentiation,
      link_url: row.link_url,
      display_order: row.display_order,
    })),
    matchOnly: {
      deckUrl: includeMatchOnly
        ? effectiveDeckUrl(
            input.parent.id,
            input.parent.deck_storage_key,
            input.parent.deck_url,
          )
        : null,
      rawTraction: includeMatchOnly ? input.parent.traction : null,
    },
  };
}

/**
 * Project the investor-depth bundle for the given tier.
 *
 *   - "public"   → empty bundle (counts surface so the discovery card can
 *                  show "12-row portfolio" without exposing rows).
 *   - "verified" → team, check bands, public portfolio rows only,
 *                  track record (sans dry powder), decision process,
 *                  value-add, anti-patterns.
 *   - "match"    → everything, including private portfolio + dry powder.
 */
export function projectInvestorDepth(
  input: InvestorDepthInput,
  tier: ViewingTier,
): InvestorDepthView {
  const portfolioPublicCount = input.portfolio.filter(
    (row) => row.is_public_listing,
  ).length;
  const portfolioPrivateCount = input.portfolio.length - portfolioPublicCount;

  if (tier === "public") {
    return {
      ...emptyInvestorDepth(),
      counts: {
        portfolioPublic: portfolioPublicCount,
        portfolioPrivate: portfolioPrivateCount,
        team: input.team.length,
      },
    };
  }

  const includeMatchOnly = tier === "match";
  const portfolioRows = includeMatchOnly
    ? input.portfolio
    : input.portfolio.filter((row) => row.is_public_listing);

  return {
    team: input.team.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      is_decision_maker: row.is_decision_maker,
      bio: row.bio,
      linkedin_url: row.linkedin_url,
      linked_user_id: row.linked_user_id,
      display_order: row.display_order,
    })),
    checkBands: input.checkBands.map((row) => ({
      id: row.id,
      stage: row.stage,
      role: row.role,
      check_min_usd: row.check_min_usd,
      check_max_usd: row.check_max_usd,
      ownership_target_band: row.ownership_target_band,
    })),
    portfolio: portfolioRows.map((row) => ({
      id: row.id,
      company_name: row.company_name,
      year: row.year,
      role: row.role,
      sector: row.sector,
      is_exited: row.is_exited,
      exit_kind: row.exit_kind,
      notes: row.notes,
      display_order: row.display_order,
    })),
    trackRecord: input.trackRecord
      ? {
          total_deals_band: input.trackRecord.total_deals_band,
          first_money_in_count_band:
            input.trackRecord.first_money_in_count_band,
          follow_on_rate_band: input.trackRecord.follow_on_rate_band,
          avg_ownership_band: input.trackRecord.avg_ownership_band,
          fund_size_band: input.trackRecord.fund_size_band,
          fund_vintage_year: input.trackRecord.fund_vintage_year,
          dry_powder_band: includeMatchOnly
            ? input.trackRecord.dry_powder_band
            : null,
        }
      : null,
    decisionProcess: input.decisionProcess
      ? {
          time_to_term_sheet_band: input.decisionProcess.time_to_term_sheet_band,
          ic_required: input.decisionProcess.ic_required,
          references_required: input.decisionProcess.references_required,
          data_room_required: input.decisionProcess.data_room_required,
          partner_meeting_required:
            input.decisionProcess.partner_meeting_required,
          process_narrative: input.decisionProcess.process_narrative,
        }
      : null,
    valueAdd: input.valueAdd.map((row) => ({
      id: row.id,
      kind: row.kind,
      narrative: row.narrative,
      display_order: row.display_order,
    })),
    antiPatterns: input.antiPatterns.map((row) => ({
      id: row.id,
      kind: row.kind,
      narrative: row.narrative,
      display_order: row.display_order,
    })),
    counts: {
      portfolioPublic: portfolioPublicCount,
      portfolioPrivate: portfolioPrivateCount,
      team: input.team.length,
    },
  };
}

/**
 * Project verifications. All tiers see confirmed verifications (badges
 * are a trust signal, not sensitive content). The caller supplies an
 * already-filtered list (see `fetchConfirmedVerifications`).
 */
export function projectVerifications(
  rows: VerificationRow[],
): VerificationBadge[] {
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    verified_at: row.verified_at,
    verified_by: row.verified_by,
  }));
}

function emptyStartupDepth(): StartupDepthView {
  return {
    team: [],
    round: null,
    capTable: null,
    useOfFunds: [],
    traction: [],
    market: null,
    competitors: [],
    matchOnly: { deckUrl: null, rawTraction: null },
  };
}

function emptyInvestorDepth(): Omit<InvestorDepthView, "counts"> {
  return {
    team: [],
    checkBands: [],
    portfolio: [],
    trackRecord: null,
    decisionProcess: null,
    valueAdd: [],
    antiPatterns: [],
  };
}
