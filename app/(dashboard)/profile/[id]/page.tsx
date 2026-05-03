import { notFound } from "next/navigation";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "@/lib/recommendations/mock-profiles";
import type { RecommendationProfile } from "@/lib/recommendations/types";
import { ProfilePageClient } from "./profile-page-client";

const ALL_PROFILES: RecommendationProfile[] = [...MOCK_STARTUPS, ...MOCK_INVESTORS];

type Props = { params: Promise<{ id: string }> };

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = ALL_PROFILES.find((p) => p.id === id) ?? null;
  if (!profile) notFound();

  return <ProfilePageClient profile={profile} />;
}
