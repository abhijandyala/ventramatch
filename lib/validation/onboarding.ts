import { z } from "zod";

export const roleSchema = z.enum(["founder", "investor"]);
export type Role = z.infer<typeof roleSchema>;

export const stageSchema = z.enum([
  "idea",
  "pre_seed",
  "seed",
  "series_a",
  "series_b_plus",
]);
export type Stage = z.infer<typeof stageSchema>;

export const leadFollowSchema = z.enum(["lead", "follow", "either"]);
export type LeadFollow = z.infer<typeof leadFollowSchema>;

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

export const LEAD_FOLLOW_LABELS: Record<LeadFollow, string> = {
  lead: "Lead",
  follow: "Follow",
  either: "Either",
};

export const investorTypeSchema = z.enum(["firm", "angel"]);
export type InvestorType = z.infer<typeof investorTypeSchema>;

export const profileInfoSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("founder"),
    companyName: z.string().trim().min(1, "Enter your startup name.").max(120, "Too long."),
    description: z.string().trim().min(1, "Add a short description.").max(300, "Keep it under 300 characters."),
  }),
  z.object({
    role: z.literal("investor"),
    investorType: investorTypeSchema,
    firmName: z.string().trim().max(120, "Too long.").optional(),
    description: z.string().trim().min(1, "Add a short description.").max(300, "Keep it under 300 characters."),
  }),
]);
export type ProfileInfoInput = z.infer<typeof profileInfoSchema>;

export const goalsSchema = z.object({
  goals: z
    .string()
    .trim()
    .min(1, "Tell us what you're looking for.")
    .max(500, "Keep it under 500 characters."),
});
export type GoalsInput = z.infer<typeof goalsSchema>;

export const onboardingSchema = z.object({
  role: roleSchema,
  profile: profileInfoSchema,
  goals: goalsSchema,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Keep old schemas exported for backward compat with DB action (will update)
export const founderInfoSchema = z.object({
  industry: z.string().trim().min(2, "Pick an industry.").max(80, "Too long."),
  stage: stageSchema,
  amountRaising: z.string().trim().min(1, "Tell us how much you're raising.").max(80, "Too long."),
  location: z.string().trim().min(2, "Add a location.").max(120, "Too long."),
});
export type FounderInfoInput = z.infer<typeof founderInfoSchema>;

export const investorInfoSchema = z.object({
  checkSize: z.string().trim().min(1, "Add your typical check size.").max(80, "Too long."),
  preferredStage: stageSchema,
  sectors: z.array(z.string().trim().min(2).max(40)).min(1, "Pick at least one sector.").max(12, "Keep it to 12 or fewer."),
  geography: z.string().trim().min(2, "Add your geography.").max(120, "Too long."),
  leadFollow: leadFollowSchema,
});
export type InvestorInfoInput = z.infer<typeof investorInfoSchema>;
