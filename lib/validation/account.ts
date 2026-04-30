import { z } from "zod";

/**
 * Zod schemas for the /settings page server actions.
 */

export const updateAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be under 80 characters."),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const notificationPrefsSchema = z.object({
  matches: z.boolean(),
  intros: z.boolean(),
  reviewUpdates: z.boolean(),
  weeklyDigest: z.boolean(),
  productUpdates: z.boolean(),
});
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

/**
 * Setting / changing a password. `currentPassword` is omitted for OAuth-only
 * users adding a password for the first time; the action enforces this.
 */
export const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128, "Password is too long.")
    .refine(
      (v) => /[a-zA-Z]/.test(v) && /\d/.test(v),
      "Mix letters and at least one number.",
    ),
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const disconnectProviderSchema = z.object({
  provider: z.enum(["google", "linkedin", "github", "microsoft-entra-id"]),
});
export type DisconnectProviderInput = z.infer<typeof disconnectProviderSchema>;

export const requestDeletionSchema = z.object({
  /** Required to ensure the user typed their own email; UI guards against typos. */
  confirmation: z.string().min(1, "Type your email to confirm."),
});
export type RequestDeletionInput = z.infer<typeof requestDeletionSchema>;
