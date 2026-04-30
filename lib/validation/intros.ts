import { z } from "zod";

/**
 * Zod schemas for intro_requests.
 *
 * Constraints chosen to force a real ask (not a wall of text or a vague
 * "want to chat?"):
 *   • message: 5-800 chars — long enough to give context, short enough that
 *     people actually read it
 *   • 1-3 proposed times — gives the recipient real choice without being a
 *     scheduling spreadsheet
 *   • optional link — keep the surface narrow; deck/memo only, no DM media
 */

const futureIso = z
  .string()
  .datetime({ message: "Must be ISO 8601 timestamp." })
  .refine((s) => new Date(s).getTime() > Date.now(), {
    message: "Time must be in the future.",
  });

export const sendIntroSchema = z.object({
  matchId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(5, "Tell them why you'd like to talk (at least 5 chars).")
    .max(800, "Keep it under 800 chars — you can elaborate on the call."),
  proposedTimes: z
    .array(futureIso)
    .min(1, "Propose at least 1 time.")
    .max(3, "Propose at most 3 times."),
  linkUrl: z
    .string()
    .url("Link must be a valid URL.")
    .max(500, "URL is too long.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type SendIntroInput = z.infer<typeof sendIntroSchema>;

export const respondIntroSchema = z
  .object({
    introId: z.string().uuid(),
    action: z.enum(["accept", "decline"]),
    /** Required when action='accept' if sender provided proposed times. */
    acceptedTime: z.string().datetime().optional(),
    responseMessage: z
      .string()
      .trim()
      .max(500, "Keep your reply under 500 chars.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine(
    (v) => v.action !== "accept" || true, // acceptedTime is optional even on accept
    { message: "" },
  );

export type RespondIntroInput = z.infer<typeof respondIntroSchema>;

export const withdrawIntroSchema = z.object({
  introId: z.string().uuid(),
});

export type WithdrawIntroInput = z.infer<typeof withdrawIntroSchema>;
