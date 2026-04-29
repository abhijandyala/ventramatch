import type { StartupStage } from "@/types/database";

export interface InvestorTractionRequirement {
  minRevenue: number | null;
  minUsers: number | null;
  requiresProof: boolean;
}

export interface Investor {
  id: string;
  userId: string;
  name: string;
  firm: string | null;
  isActive: boolean;

  stages: StartupStage[];
  sectors: string[];
  geographies: string[];

  checkMin: number;
  checkMax: number;

  tractionRequirement: InvestorTractionRequirement;
  thesis: string | null;

  createdAt: string;
  updatedAt: string;
}
