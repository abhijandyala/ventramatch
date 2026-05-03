import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchMutualMatches, type MutualMatch } from "@/lib/feed/query";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import type { AccountLabel } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  mockMutualMatchesForFounder,
  mockMutualMatchesForInvestor,
} from "@/lib/recommendations/mock-feed-adapter";
import { MatchCardDeck, type MatchCard } from "@/components/matches/match-card-deck";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

export default async function MatchesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const userId = session.user.id;
  const role = session.user.role as "founder" | "investor" | null;
  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;
  const viewerRole = role ?? "founder";

  const realMatches = await fetchMutualMatches(userId);

  let cards: MatchCard[];

  if (realMatches.length > 0) {
    cards = realMatches.map(realToCard);
  } else {
    const mocks = viewerRole === "founder"
      ? mockMutualMatchesForFounder()
      : mockMutualMatchesForInvestor();

    cards = mocks.map((m) => ({
      id: m.matchId,
      userId: m.targetUserId,
      name: m.targetName,
      firm: m.targetFirm,
      oneLiner: m.targetOneLiner,
      chips: buildMockChips(m.targetIndustry, m.targetStage, m.targetSectors),
      score: m.matchScore,
      breakdown: m.matchBreakdown,
      avatarSrc: m.avatarSrc,
      otherRole: viewerRole === "founder" ? "investor" as const : "founder" as const,
    }));
  }

  console.log(`[matches] userId=${userId} real=${realMatches.length} cards=${cards.length}`);

  return (
    <main className="flex flex-col">
      <AccountStatusBanner label={accountLabel} />
      <MatchCardDeck cards={cards} />
      <p className="py-3 text-center text-[11px] text-[var(--color-text-faint)] border-t border-[var(--color-border)]">
        VentraMatch surfaces mutual interest. It does not recommend investments or promise funding.
      </p>
    </main>
  );
}

function realToCard(m: MutualMatch): MatchCard {
  const chips: string[] = [];
  if (m.industry) chips.push(m.industry);
  if (m.stage) {
    const label = STAGE_LABEL[m.stage] ?? m.stage;
    chips.push(label);
  }
  return {
    id: m.matchId,
    userId: m.otherUserId,
    name: m.startupName ?? m.investorName ?? m.otherName ?? "User",
    firm: m.firm ?? null,
    oneLiner: null,
    chips,
    score: 0,
    avatarSrc: m.otherAvatarSrc ?? null,
    otherRole: m.otherRole,
  };
}

function buildMockChips(
  industry: string | null,
  stage: string | null,
  sectors: string[],
): string[] {
  const chips: string[] = [];
  if (industry) chips.push(industry);
  if (stage) {
    const label = STAGE_LABEL[stage] ?? stage;
    if (!chips.includes(label)) chips.push(label);
  }
  for (const s of sectors) {
    if (!chips.includes(s)) chips.push(s);
  }
  return chips;
}
