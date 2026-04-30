/**
 * Zod schemas for the /build submit + draft payloads.
 *
 * Two schemas per role:
 *   - submitFounderSchema / submitInvestorSchema — strict; required fields
 *     enforced. Used by submitApplicationAction.
 *   - draftFounderSchema  / draftInvestorSchema  — lenient; everything is
 *     optional. Used by saveDraftAction so the user can stash partial work.
 *
 * Field shapes are aligned with the existing public.startups and
 * public.investors columns. Extra fields the build mock collects (logo,
 * MRR, recent investments, etc.) are deferred to a future schema expansion.
 */

import { z } from "zod";
import { stageSchema } from "./onboarding";

const httpUrl = z
  .string()
  .trim()
  .url({ message: "Use a full URL starting with http or https." })
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must start with http or https.",
  });

const optionalHttpUrl = httpUrl.optional().or(z.literal("").transform(() => undefined));

const positiveBigInt = z
  .number({ message: "Use a number." })
  .int({ message: "Use a whole number." })
  .min(0, { message: "Cannot be negative." });

export const submitFounderSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Company name is too short.")
    .max(80, "Company name is too long."),
  oneLiner: z
    .string()
    .trim()
    .min(10, "One-liner must be at least 10 characters.")
    .max(240, "One-liner must be 240 characters or fewer."),
  industry: z.string().trim().min(2, "Pick an industry.").max(80, "Too long."),
  stage: stageSchema,
  raiseAmount: positiveBigInt.optional(),
  traction: z.string().trim().max(2000, "Keep traction under 2000 characters.").optional(),
  location: z.string().trim().max(120, "Location is too long.").optional(),
  deckUrl: optionalHttpUrl,
  website: optionalHttpUrl,
});
export type SubmitFounderInput = z.infer<typeof submitFounderSchema>;

export const draftFounderSchema = submitFounderSchema.partial();
export type DraftFounderInput = z.infer<typeof draftFounderSchema>;

const investorBaseSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(80, "Name is too long."),
  firm: z.string().trim().max(120, "Firm name is too long.").optional(),
  checkMin: positiveBigInt,
  checkMax: positiveBigInt,
  stages: z.array(stageSchema).min(1, "Pick at least one stage."),
  sectors: z
    .array(z.string().trim().min(2).max(40))
    .min(1, "Pick at least one sector.")
    .max(20, "Keep sectors under 20."),
  geographies: z
    .array(z.string().trim().min(2).max(80))
    .min(1, "Pick at least one geography.")
    .max(20, "Keep geographies under 20."),
  isActive: z.boolean().optional(),
  thesis: z.string().trim().max(2000, "Keep thesis under 2000 characters.").optional(),
});

export const submitInvestorSchema = investorBaseSchema.refine(
  (v) => v.checkMax >= v.checkMin,
  { message: "Max check must be at least the min check.", path: ["checkMax"] },
);
export type SubmitInvestorInput = z.infer<typeof submitInvestorSchema>;

// Drafts allowed to be incomplete and incoherent (no min/max cross-check).
export const draftInvestorSchema = investorBaseSchema.partial();
export type DraftInvestorInput = z.infer<typeof draftInvestorSchema>;
