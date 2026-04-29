import type { StartupStage } from "@/types/database";

export interface StartupFounder {
  name: string | null;
  linkedinUrl: string | null;
  email: string | null;
  bio: string | null;
}

export interface StartupTeamMember {
  name: string;
  role: string;
  linkedinUrl?: string | null;
}

export interface StartupTraction {
  revenue: number | null;
  mrr: number | null;
  users: number | null;
  growth: string | null;
  proofUrl: string | null;
  metricsDescription: string | null;
}

export interface StartupPlatformBehavior {
  profileViews: number;
  investorLikes: number;
  investorSaves: number;
  responseRatePercent: number;
  spamReports: number;
  lastActiveAt: string | null;
}

export interface StartupLinks {
  website: string | null;
  demoUrl: string | null;
  productUrl: string | null;
  githubUrl: string | null;
  deckUrl: string | null;
}

export interface Startup {
  id: string;
  userId: string;
  name: string | null;
  oneLiner: string | null;
  pitch: string | null;
  industry: string | null;
  industries: string[];
  stage: StartupStage | null;
  raiseAmount: number | null;
  location: string | null;
  problemStatement: string | null;
  solution: string | null;

  founder: StartupFounder;
  team: StartupTeamMember[];
  traction: StartupTraction;
  links: StartupLinks;
  platformBehavior: StartupPlatformBehavior;

  endorsements: number;
  publicPresenceScore: number;

  createdAt: string;
  updatedAt: string;
}
