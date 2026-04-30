import type {
  InvestorDepthView,
  StartupDepthView,
  ViewingTier,
} from "@/lib/profile/visibility";
import {
  EQUITY_PCT_BAND_LABELS,
  MARKET_SIZE_BAND_LABELS,
  VALUATION_BAND_LABELS,
  type DealCountBand,
  type DryPowderBand,
  type EmployeePoolPctBand,
  type FollowOnRateBand,
  type FoundersPctBand,
  type FundSizeBand,
  type InvestorAntiPatternKind,
  type InvestorCheckRole,
  type InvestorRoleEnum,
  type InvestorValueAddKind,
  type LastRoundAmountBand,
  type OutsideInvestorsPctBand,
  type OwnershipBand,
  type RoundInstrument,
  type RoundLeadStatus,
  type StartupStage,
  type TimeToTermSheetBand,
  type TractionKind,
  type TractionSourceKind,
  type UseOfFundsCategory,
} from "@/types/database";

/**
 * Read-only renderers for the profile-depth tables (0012–0016).
 *
 * These live outside the page file so the per-section logic — labels,
 * empty-state copy, locked-field hints — stays composable. They render
 * the projected views from `lib/profile/visibility.ts`; tier gating
 * already happened upstream, so there's no per-field branching here.
 *
 * The single concession to the locked tier is the `lockedHint` rendered
 * for fields that the projection nulled out (`evidence_url`, deck URL,
 * dry powder, private portfolio rows). Those nulls mean "exists but
 * not visible at this tier" — never "no data" — which is why we surface
 * a locked-state line rather than hiding the section.
 */

// ──────────────────────────────────────────────────────────────────────────
//  Shared layout primitives
// ──────────────────────────────────────────────────────────────────────────

export function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  /** Show a faint "—" with this label when children render nothing. */
  empty?: string;
}) {
  return (
    <section>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3">
        {children ?? (
          <p className="text-[13px] italic text-[var(--color-text-faint)]">
            {empty ?? "—"}
          </p>
        )}
      </div>
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  value,
  link,
  footnote,
}: {
  label: string;
  value: string;
  link?: string;
  footnote?: string;
}) {
  return (
    <div
      className="border bg-[var(--color-surface)] px-4 py-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-medium text-[var(--color-text-strong)]">
        {link ? (
          <a
            href={link.startsWith("http") ? link : `https://${link}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-[var(--color-brand-strong)]"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </p>
      {footnote ? (
        <p className="mt-1 text-[11px] italic text-[var(--color-text-faint)]">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

function LockedHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] italic text-[var(--color-text-faint)]">{children}</p>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Founder-side sections
// ──────────────────────────────────────────────────────────────────────────

export function StartupDepthSections({
  depth,
  tier,
}: {
  depth: StartupDepthView;
  tier: ViewingTier;
}) {
  return (
    <div className="space-y-8">
      <TeamSection team={depth.team} tier={tier} />
      <RoundSection round={depth.round} tier={tier} />
      <CapTableSection capTable={depth.capTable} tier={tier} />
      <UseOfFundsSection lines={depth.useOfFunds} tier={tier} />
      <TractionSection traction={depth.traction} tier={tier} />
      <MarketSection market={depth.market} tier={tier} />
      <CompetitiveSection competitors={depth.competitors} tier={tier} />
    </div>
  );
}

function TeamSection({
  team,
  tier,
}: {
  team: StartupDepthView["team"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Team">
        <LockedHint>
          Visible to verified investors. Sign up and complete review to see
          founders and key hires.
        </LockedHint>
      </Section>
    );
  }
  if (team.length === 0) {
    return <Section title="Team" empty="No team members listed yet." children={null} />;
  }
  return (
    <Section title="Team">
      <ul className="divide-y divide-[var(--color-border)]">
        {team.map((m) => (
          <li key={m.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {m.name}
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
                {m.is_founder ? "Founder" : m.is_full_time ? "Full-time" : "Advisor"}
              </span>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)]">{m.role}</p>
            {m.prior_company || m.prior_role ? (
              <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                Previously {m.prior_role ?? "at"}
                {m.prior_role && m.prior_company ? " · " : ""}
                {m.prior_company ?? ""}
              </p>
            ) : null}
            {m.bio ? (
              <p className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text)]">
                {m.bio}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11.5px]">
              {m.equity_pct_band ? (
                <span className="font-mono text-[var(--color-text-faint)]">
                  Equity: {EQUITY_PCT_BAND_LABELS[m.equity_pct_band]}
                </span>
              ) : null}
              {m.linkedin_url ? (
                <a
                  href={m.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 text-[var(--color-text-strong)] hover:text-[var(--color-brand-strong)]"
                >
                  LinkedIn
                </a>
              ) : null}
              {m.github_url ? (
                <a
                  href={m.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 text-[var(--color-text-strong)] hover:text-[var(--color-brand-strong)]"
                >
                  GitHub
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const ROUND_LEAD_STATUS_LABEL: Record<RoundLeadStatus, string> = {
  open: "Open",
  soliciting_lead: "Looking for a lead",
  lead_committed: "Lead committed",
  oversubscribed: "Oversubscribed",
};

const ROUND_INSTRUMENT_LABEL: Record<RoundInstrument, string> = {
  safe_post_money: "SAFE (post-money)",
  safe_pre_money: "SAFE (pre-money)",
  priced_round: "Priced equity",
  convertible_note: "Convertible note",
};

function RoundSection({
  round,
  tier,
}: {
  round: StartupDepthView["round"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Round">
        <LockedHint>
          Round structure (instrument, valuation band, lead status, close date)
          is visible to verified investors.
        </LockedHint>
      </Section>
    );
  }
  if (!round) {
    return <Section title="Round" empty="No round details published yet." children={null} />;
  }
  const committedPct =
    round.target_raise_usd && round.target_raise_usd > 0
      ? Math.min(
          100,
          Math.round((round.committed_amount_usd / round.target_raise_usd) * 100),
        )
      : null;

  return (
    <Section title="Round">
      <FieldGrid>
        <Field
          label="Instrument"
          value={
            round.instrument ? ROUND_INSTRUMENT_LABEL[round.instrument] : "—"
          }
        />
        <Field
          label="Lead status"
          value={ROUND_LEAD_STATUS_LABEL[round.lead_status]}
        />
        <Field
          label="Target raise"
          value={
            round.target_raise_usd
              ? `$${round.target_raise_usd.toLocaleString()}`
              : "—"
          }
        />
        <Field
          label="Valuation"
          value={
            round.valuation_band
              ? VALUATION_BAND_LABELS[round.valuation_band]
              : "—"
          }
          footnote="Founder-stated band. Not investment advice."
        />
        <Field
          label="Min check"
          value={
            round.min_check_usd
              ? `$${round.min_check_usd.toLocaleString()}`
              : "—"
          }
        />
        <Field
          label="Close by"
          value={round.close_by_date ?? "—"}
        />
        <Field
          label="Committed"
          value={
            committedPct !== null
              ? `${committedPct}% of target ($${round.committed_amount_usd.toLocaleString()})`
              : `$${round.committed_amount_usd.toLocaleString()}`
          }
        />
      </FieldGrid>
      {round.use_of_funds_summary ? (
        <p className="text-[13.5px] leading-[1.6] text-[var(--color-text)]">
          <span className="font-medium text-[var(--color-text-strong)]">
            Use of funds.
          </span>{" "}
          {round.use_of_funds_summary}
        </p>
      ) : null}
      {round.instrument_terms_summary ? (
        <p className="text-[13.5px] leading-[1.6] text-[var(--color-text)]">
          <span className="font-medium text-[var(--color-text-strong)]">Terms.</span>{" "}
          {round.instrument_terms_summary}
        </p>
      ) : null}
    </Section>
  );
}

const FOUNDERS_PCT_LABEL: Record<FoundersPctBand, string> = {
  under_50: "Under 50%",
  "50_70": "50–70%",
  "70_85": "70–85%",
  "85_95": "85–95%",
  over_95: "95%+",
};

const EMPLOYEE_POOL_LABEL: Record<EmployeePoolPctBand, string> = {
  none: "No pool yet",
  under_10: "Under 10%",
  "10_15": "10–15%",
  "15_20": "15–20%",
  over_20: "20%+",
};

const OUTSIDE_INVESTORS_LABEL: Record<OutsideInvestorsPctBand, string> = {
  none_yet: "None yet",
  under_15: "Under 15%",
  "15_25": "15–25%",
  "25_35": "25–35%",
  over_35: "35%+",
};

const LAST_ROUND_AMOUNT_LABEL: Record<LastRoundAmountBand, string> = {
  under_500k: "Under $500K",
  "500k_1m": "$500K–$1M",
  "1m_3m": "$1M–$3M",
  "3m_10m": "$3M–$10M",
  "10m_25m": "$10M–$25M",
  over_25m: "$25M+",
};

function CapTableSection({
  capTable,
  tier,
}: {
  capTable: StartupDepthView["capTable"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Cap table summary">
        <LockedHint>
          Founder / pool / outside-investor ownership bands are visible to
          verified investors.
        </LockedHint>
      </Section>
    );
  }
  if (!capTable) {
    return (
      <Section title="Cap table summary" empty="Not published yet." children={null} />
    );
  }
  return (
    <Section title="Cap table summary">
      <FieldGrid>
        <Field
          label="Founders"
          value={
            capTable.founders_pct_band
              ? FOUNDERS_PCT_LABEL[capTable.founders_pct_band]
              : "—"
          }
        />
        <Field
          label="Employee pool"
          value={
            capTable.employee_pool_pct_band
              ? EMPLOYEE_POOL_LABEL[capTable.employee_pool_pct_band]
              : "—"
          }
        />
        <Field
          label="Outside investors"
          value={
            capTable.outside_investors_pct_band
              ? OUTSIDE_INVESTORS_LABEL[capTable.outside_investors_pct_band]
              : "—"
          }
        />
        <Field
          label="Prior raises"
          value={String(capTable.prior_raises_count)}
        />
        <Field
          label="Last round"
          value={
            capTable.last_round_amount_band
              ? LAST_ROUND_AMOUNT_LABEL[capTable.last_round_amount_band]
              : "—"
          }
        />
        <Field
          label="Last round year"
          value={capTable.last_round_year ? String(capTable.last_round_year) : "—"}
        />
      </FieldGrid>
    </Section>
  );
}

const USE_OF_FUNDS_LABEL: Record<UseOfFundsCategory, string> = {
  engineering: "Engineering",
  sales_and_marketing: "Sales & marketing",
  operations: "Operations",
  runway_extension: "Runway extension",
  hiring: "Hiring",
  infrastructure: "Infrastructure",
  research_and_dev: "R&D",
  other: "Other",
};

function UseOfFundsSection({
  lines,
  tier,
}: {
  lines: StartupDepthView["useOfFunds"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Use of funds">
        <LockedHint>
          Per-category breakdown is visible to verified investors.
        </LockedHint>
      </Section>
    );
  }
  if (lines.length === 0) {
    return <Section title="Use of funds" empty="No breakdown yet." children={null} />;
  }
  return (
    <Section title="Use of funds">
      <ul className="space-y-2.5">
        {lines.map((line) => (
          <li
            key={line.id}
            className="border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {USE_OF_FUNDS_LABEL[line.category]}
              </p>
              <span className="font-mono text-[14px] tabular-nums font-bold text-[var(--color-brand-strong)]">
                {line.pct_of_raise}%
              </span>
            </div>
            {line.narrative ? (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
                {line.narrative}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const TRACTION_KIND_LABEL: Record<TractionKind, string> = {
  mrr: "MRR",
  arr: "ARR",
  gross_revenue: "Gross revenue",
  paying_customers: "Paying customers",
  design_partners: "Design partners",
  signed_lois: "Signed LOIs",
  waitlist_size: "Waitlist",
  dau: "DAU",
  mau: "MAU",
  retention_day_30: "D30 retention",
  retention_day_90: "D90 retention",
  nps: "NPS",
  gross_margin_pct: "Gross margin",
  cac_usd: "CAC",
  ltv_usd: "LTV",
  contracted_revenue: "Contracted revenue",
  gmv: "GMV",
};

const TRACTION_SOURCE_LABEL: Record<TractionSourceKind, string> = {
  stripe_dashboard: "Stripe dashboard",
  bank_statement: "Bank statement",
  crm_export: "CRM export",
  csv_upload: "CSV upload",
  self_attested: "Self-attested",
  other: "Other source",
};

function formatTractionValue(kind: TractionKind, raw: number | string): string {
  // value_numeric comes back from postgres as a string from numeric(20,2)
  // when it has decimals. Normalize defensively.
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(value)) return String(raw);
  if (
    kind === "retention_day_30" ||
    kind === "retention_day_90" ||
    kind === "gross_margin_pct"
  ) {
    return `${value}%`;
  }
  if (kind === "nps") {
    return String(Math.round(value));
  }
  if (
    kind === "mrr" ||
    kind === "arr" ||
    kind === "gross_revenue" ||
    kind === "cac_usd" ||
    kind === "ltv_usd" ||
    kind === "contracted_revenue" ||
    kind === "gmv"
  ) {
    return `$${value.toLocaleString()}`;
  }
  return Math.round(value).toLocaleString();
}

function TractionSection({
  traction,
  tier,
}: {
  traction: StartupDepthView["traction"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Traction">
        <LockedHint>
          Structured traction signals (revenue, retention, customers) are
          visible to verified investors.
        </LockedHint>
      </Section>
    );
  }
  if (traction.length === 0) {
    return (
      <Section title="Traction" empty="No structured traction signals published yet." children={null} />
    );
  }
  return (
    <Section title="Traction">
      <ul className="space-y-2.5">
        {traction.map((t) => (
          <li
            key={t.id}
            className="border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {TRACTION_KIND_LABEL[t.kind]}
              </p>
              <span className="font-mono text-[14px] tabular-nums font-bold text-[var(--color-text-strong)]">
                {formatTractionValue(t.kind, t.value_numeric)}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] uppercase tracking-[0.1em] text-[var(--color-text-faint)] font-mono">
              {TRACTION_SOURCE_LABEL[t.source_kind]}
              {t.self_reported ? " · self-reported" : ""}
            </p>
            {t.notes ? (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
                {t.notes}
              </p>
            ) : null}
            {t.evidence_url ? (
              <a
                href={t.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11.5px] underline underline-offset-4 text-[var(--color-text-strong)] hover:text-[var(--color-brand-strong)]"
              >
                Evidence →
              </a>
            ) : tier === "verified" ? (
              <p className="mt-1 text-[11px] italic text-[var(--color-text-faint)]">
                Evidence link visible after mutual match.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MarketSection({
  market,
  tier,
}: {
  market: StartupDepthView["market"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Market">
        <LockedHint>
          TAM / SAM / SOM bands and methodology are visible to verified
          investors.
        </LockedHint>
      </Section>
    );
  }
  if (!market) {
    return (
      <Section title="Market" empty="No market analysis published yet." children={null} />
    );
  }
  const sources = Array.isArray(market.source_links)
    ? (market.source_links as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  return (
    <Section title="Market">
      <FieldGrid>
        <Field
          label="TAM"
          value={market.tam_band ? MARKET_SIZE_BAND_LABELS[market.tam_band] : "—"}
        />
        <Field
          label="SAM"
          value={market.sam_band ? MARKET_SIZE_BAND_LABELS[market.sam_band] : "—"}
        />
        <Field
          label="SOM"
          value={market.som_band ? MARKET_SIZE_BAND_LABELS[market.som_band] : "—"}
        />
      </FieldGrid>
      {market.methodology_summary ? (
        <p className="text-[13.5px] leading-[1.6] text-[var(--color-text)]">
          <span className="font-medium text-[var(--color-text-strong)]">
            Methodology.
          </span>{" "}
          {market.methodology_summary}
        </p>
      ) : null}
      {sources.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-[12.5px]">
          {sources.map((url, idx) => (
            <li key={`${url}-${idx}`}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 text-[var(--color-text-strong)] hover:text-[var(--color-brand-strong)]"
              >
                Source {idx + 1}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function CompetitiveSection({
  competitors,
  tier,
}: {
  competitors: StartupDepthView["competitors"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Competitive landscape">
        <LockedHint>
          Competitor list and differentiation are visible to verified
          investors.
        </LockedHint>
      </Section>
    );
  }
  if (competitors.length === 0) {
    return (
      <Section title="Competitive landscape" empty="No competitors listed yet." children={null} />
    );
  }
  return (
    <Section title="Competitive landscape">
      <ul className="space-y-2.5">
        {competitors.map((c) => (
          <li
            key={c.id}
            className="border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {c.competitor_name}
              </p>
              {c.link_url ? (
                <a
                  href={c.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11.5px] underline underline-offset-4 text-[var(--color-text-muted)] hover:text-[var(--color-brand-strong)]"
                >
                  Link
                </a>
              ) : null}
            </div>
            {c.differentiation ? (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text)]">
                {c.differentiation}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Investor-side sections
// ──────────────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<StartupStage, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

const CHECK_ROLE_LABEL: Record<InvestorCheckRole, string> = {
  lead: "Lead",
  follow: "Follow",
};

const INVESTOR_ROLE_LABEL: Record<InvestorRoleEnum, string> = {
  lead: "Led",
  co_lead: "Co-led",
  follow: "Followed",
  participant: "Participated",
};

const OWNERSHIP_LABEL: Record<OwnershipBand, string> = {
  under_5pct: "Under 5%",
  "5_10": "5–10%",
  "10_20": "10–20%",
  over_20: "20%+",
};

const DEAL_COUNT_LABEL: Record<DealCountBand, string> = {
  under_10: "Under 10",
  "10_25": "10–25",
  "25_50": "25–50",
  "50_100": "50–100",
  over_100: "100+",
};

const FOLLOW_ON_LABEL: Record<FollowOnRateBand, string> = {
  under_25: "Under 25%",
  "25_50": "25–50%",
  "50_75": "50–75%",
  over_75: "75%+",
};

const FUND_SIZE_LABEL: Record<FundSizeBand, string> = {
  under_25m: "Under $25M",
  "25_100m": "$25–100M",
  "100_500m": "$100–500M",
  "500m_1b": "$500M–$1B",
  over_1b: "$1B+",
};

const DRY_POWDER_LABEL: Record<DryPowderBand, string> = {
  depleted: "Depleted",
  under_25m: "Under $25M",
  "25_100m": "$25–100M",
  "100_500m": "$100–500M",
  over_500m: "$500M+",
};

const TIME_TO_TS_LABEL: Record<TimeToTermSheetBand, string> = {
  one_week: "Within a week",
  two_weeks: "Within 2 weeks",
  one_month: "Within a month",
  two_months: "Within 2 months",
  quarter_plus: "A quarter or more",
};

const VALUE_ADD_LABEL: Record<InvestorValueAddKind, string> = {
  recruiting: "Recruiting",
  gtm_intros: "GTM intros",
  sales_intros: "Sales intros",
  customer_intros: "Customer intros",
  board_governance: "Board / governance",
  regulatory: "Regulatory",
  technical_dd: "Technical DD",
  fundraising_strategy: "Fundraising strategy",
  international_expansion: "International expansion",
};

const ANTI_PATTERN_LABEL: Record<InvestorAntiPatternKind, string> = {
  sector: "Sector",
  stage: "Stage",
  geography: "Geography",
  founder_profile: "Founder profile",
  check_size: "Check size",
  other: "Other",
};

export function InvestorDepthSections({
  depth,
  tier,
}: {
  depth: InvestorDepthView;
  tier: ViewingTier;
}) {
  return (
    <div className="space-y-8">
      <InvestorTeamSection team={depth.team} counts={depth.counts} tier={tier} />
      <CheckBandsSection checkBands={depth.checkBands} tier={tier} />
      <PortfolioSection
        portfolio={depth.portfolio}
        counts={depth.counts}
        tier={tier}
      />
      <TrackRecordSection trackRecord={depth.trackRecord} tier={tier} />
      <DecisionProcessSection
        decisionProcess={depth.decisionProcess}
        tier={tier}
      />
      <ValueAddSection valueAdd={depth.valueAdd} tier={tier} />
      <AntiPatternsSection antiPatterns={depth.antiPatterns} tier={tier} />
    </div>
  );
}

function InvestorTeamSection({
  team,
  counts,
  tier,
}: {
  team: InvestorDepthView["team"];
  counts: InvestorDepthView["counts"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Team">
        <LockedHint>
          {counts.team > 0
            ? `Profile lists ${counts.team} team member${counts.team === 1 ? "" : "s"}. Visible to verified founders.`
            : "Visible to verified founders."}
        </LockedHint>
      </Section>
    );
  }
  if (team.length === 0) {
    return <Section title="Team" empty="No team members listed yet." children={null} />;
  }
  return (
    <Section title="Team">
      <ul className="divide-y divide-[var(--color-border)]">
        {team.map((m) => (
          <li key={m.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {m.name}
              </p>
              {m.is_decision_maker ? (
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5"
                  style={{
                    background: "var(--color-brand-tint)",
                    color: "var(--color-brand-strong)",
                    border: "1px solid var(--color-brand)",
                  }}
                >
                  Decision maker
                </span>
              ) : null}
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)]">{m.role}</p>
            {m.bio ? (
              <p className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text)]">
                {m.bio}
              </p>
            ) : null}
            {m.linkedin_url ? (
              <a
                href={m.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11.5px] underline underline-offset-4 text-[var(--color-text-strong)] hover:text-[var(--color-brand-strong)]"
              >
                LinkedIn
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CheckBandsSection({
  checkBands,
  tier,
}: {
  checkBands: InvestorDepthView["checkBands"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Check sizes">
        <LockedHint>
          Per-stage lead vs follow check ranges are visible to verified
          founders.
        </LockedHint>
      </Section>
    );
  }
  if (checkBands.length === 0) {
    return (
      <Section title="Check sizes" empty="No per-stage check ranges published." children={null} />
    );
  }
  return (
    <Section title="Check sizes">
      <ul className="space-y-2">
        {checkBands.map((b) => (
          <li
            key={b.id}
            className="flex items-baseline justify-between gap-3 border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {STAGE_LABEL[b.stage]} · {CHECK_ROLE_LABEL[b.role]}
              </p>
              {b.ownership_target_band ? (
                <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                  Targets {OWNERSHIP_LABEL[b.ownership_target_band]} ownership
                </p>
              ) : null}
            </div>
            <p className="font-mono text-[14px] tabular-nums text-[var(--color-text-strong)]">
              ${b.check_min_usd.toLocaleString()}–${b.check_max_usd.toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PortfolioSection({
  portfolio,
  counts,
  tier,
}: {
  portfolio: InvestorDepthView["portfolio"];
  counts: InvestorDepthView["counts"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Portfolio">
        <LockedHint>
          {counts.portfolioPublic > 0
            ? `Profile lists ${counts.portfolioPublic} public portfolio entr${counts.portfolioPublic === 1 ? "y" : "ies"}. Visible to verified founders.`
            : "Visible to verified founders."}
        </LockedHint>
      </Section>
    );
  }
  if (portfolio.length === 0) {
    return (
      <Section title="Portfolio" empty="No public portfolio entries." children={null} />
    );
  }
  return (
    <Section title="Portfolio">
      <ul className="space-y-2">
        {portfolio.map((row) => (
          <li
            key={row.id}
            className="border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
                {row.company_name}
              </p>
              <span className="font-mono text-[11px] text-[var(--color-text-faint)]">
                {INVESTOR_ROLE_LABEL[row.role]}
                {row.year ? ` · ${row.year}` : ""}
              </span>
            </div>
            {row.sector || row.is_exited ? (
              <p className="mt-0.5 text-[11.5px] uppercase tracking-[0.1em] text-[var(--color-text-faint)] font-mono">
                {row.sector ?? ""}
                {row.is_exited && row.sector ? " · " : ""}
                {row.is_exited ? `Exited${row.exit_kind ? ` (${row.exit_kind})` : ""}` : ""}
              </p>
            ) : null}
            {row.notes ? (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
                {row.notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {tier === "verified" && counts.portfolioPrivate > 0 ? (
        <LockedHint>
          {counts.portfolioPrivate} private portfolio entr
          {counts.portfolioPrivate === 1 ? "y" : "ies"} visible after mutual
          match.
        </LockedHint>
      ) : null}
    </Section>
  );
}

function TrackRecordSection({
  trackRecord,
  tier,
}: {
  trackRecord: InvestorDepthView["trackRecord"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Track record">
        <LockedHint>
          Deal count, follow-on rate, and fund vintage are visible to verified
          founders.
        </LockedHint>
      </Section>
    );
  }
  if (!trackRecord) {
    return (
      <Section title="Track record" empty="No track record published yet." children={null} />
    );
  }
  return (
    <Section title="Track record">
      <FieldGrid>
        <Field
          label="Total deals"
          value={
            trackRecord.total_deals_band
              ? DEAL_COUNT_LABEL[trackRecord.total_deals_band]
              : "—"
          }
        />
        <Field
          label="First-money-in"
          value={
            trackRecord.first_money_in_count_band
              ? DEAL_COUNT_LABEL[trackRecord.first_money_in_count_band]
              : "—"
          }
        />
        <Field
          label="Follow-on rate"
          value={
            trackRecord.follow_on_rate_band
              ? FOLLOW_ON_LABEL[trackRecord.follow_on_rate_band]
              : "—"
          }
        />
        <Field
          label="Avg ownership"
          value={
            trackRecord.avg_ownership_band
              ? OWNERSHIP_LABEL[trackRecord.avg_ownership_band]
              : "—"
          }
        />
        <Field
          label="Fund size"
          value={
            trackRecord.fund_size_band
              ? FUND_SIZE_LABEL[trackRecord.fund_size_band]
              : "—"
          }
        />
        <Field
          label="Vintage"
          value={
            trackRecord.fund_vintage_year
              ? String(trackRecord.fund_vintage_year)
              : "—"
          }
        />
        <Field
          label="Dry powder"
          value={
            trackRecord.dry_powder_band
              ? DRY_POWDER_LABEL[trackRecord.dry_powder_band]
              : "—"
          }
          footnote={
            tier === "verified"
              ? "Dry-powder band visible after mutual match."
              : undefined
          }
        />
      </FieldGrid>
    </Section>
  );
}

function DecisionProcessSection({
  decisionProcess,
  tier,
}: {
  decisionProcess: InvestorDepthView["decisionProcess"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Decision process">
        <LockedHint>
          Time to term sheet, IC requirements, and process narrative are
          visible to verified founders.
        </LockedHint>
      </Section>
    );
  }
  if (!decisionProcess) {
    return (
      <Section title="Decision process" empty="Process not published yet." children={null} />
    );
  }
  const requirements: string[] = [];
  if (decisionProcess.ic_required) requirements.push("Investment committee");
  if (decisionProcess.partner_meeting_required) requirements.push("Partner meeting");
  if (decisionProcess.references_required) requirements.push("References");
  if (decisionProcess.data_room_required) requirements.push("Data room");
  return (
    <Section title="Decision process">
      <FieldGrid>
        <Field
          label="Time to term sheet"
          value={
            decisionProcess.time_to_term_sheet_band
              ? TIME_TO_TS_LABEL[decisionProcess.time_to_term_sheet_band]
              : "—"
          }
        />
        <Field
          label="Required steps"
          value={requirements.length ? requirements.join(" · ") : "Lightweight"}
        />
      </FieldGrid>
      {decisionProcess.process_narrative ? (
        <p className="text-[13.5px] leading-[1.6] text-[var(--color-text)]">
          {decisionProcess.process_narrative}
        </p>
      ) : null}
    </Section>
  );
}

function ValueAddSection({
  valueAdd,
  tier,
}: {
  valueAdd: InvestorDepthView["valueAdd"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Value add">
        <LockedHint>
          Beyond-the-check support is visible to verified founders.
        </LockedHint>
      </Section>
    );
  }
  if (valueAdd.length === 0) {
    return (
      <Section title="Value add" empty="No value-add tags listed." children={null} />
    );
  }
  return (
    <Section title="Value add">
      <ul className="space-y-2">
        {valueAdd.map((v) => (
          <li
            key={v.id}
            className="border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
              {VALUE_ADD_LABEL[v.kind]}
            </p>
            {v.narrative ? (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text)]">
                {v.narrative}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function AntiPatternsSection({
  antiPatterns,
  tier,
}: {
  antiPatterns: InvestorDepthView["antiPatterns"];
  tier: ViewingTier;
}) {
  if (tier === "public") {
    return (
      <Section title="Won't invest if">
        <LockedHint>
          Explicit anti-patterns are visible to verified founders.
        </LockedHint>
      </Section>
    );
  }
  if (antiPatterns.length === 0) {
    return (
      <Section title="Won't invest if" empty="No anti-patterns listed." children={null} />
    );
  }
  return (
    <Section title="Won't invest if">
      <ul className="space-y-2">
        {antiPatterns.map((p) => (
          <li
            key={p.id}
            className="border bg-[var(--color-surface)] px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <p className="text-[11.5px] uppercase tracking-[0.12em] font-mono text-[var(--color-text-faint)]">
              {ANTI_PATTERN_LABEL[p.kind]}
            </p>
            <p className="mt-1 text-[13px] leading-[1.55] text-[var(--color-text)]">
              {p.narrative}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
