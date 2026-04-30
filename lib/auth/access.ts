import { auth } from "@/auth";
import type { AccountLabel, UserRole } from "@/types/database";

/**
 * Centralized authorization checks for write actions and feature surfaces.
 * Read at the start of every server action that mutates state or expresses
 * interest. Pure data — never throws; callers branch on the returned shape.
 *
 * The DB also has its own constraints (RLS, lifecycle CHECK) — these are
 * here so the UI can give a helpful error before we hit the DB.
 */

export type AccessReason =
  | "unauthenticated"
  | "unverified-email"
  | "not-onboarded"
  | "in-review"
  | "rejected"
  | "banned";

export type AccessResult =
  | {
      ok: true;
      userId: string;
      role: UserRole | null;
      accountLabel: AccountLabel;
      isEmailVerified: boolean;
      onboardingCompleted: boolean;
    }
  | {
      ok: false;
      reason: AccessReason;
      message: string;
    };

const REASONS: Record<AccessReason, string> = {
  "unauthenticated": "Sign in to continue.",
  "unverified-email": "Verify your email first — check your inbox for the link.",
  "not-onboarded": "Finish onboarding before using this feature.",
  "in-review": "Your profile is in review — you can't change matches until it's approved.",
  "rejected": "Your application was rejected. Edit your profile and resubmit.",
  "banned": "This account is suspended. Contact support if this is a mistake.",
};

/**
 * Returns ok=true only when the user is in a state where they can take
 * destructive / interactive actions (express interest, message, edit
 * profile after submit). Use `requireRead` for read-only access checks.
 */
export async function requireWrite(): Promise<AccessResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, reason: "unauthenticated", message: REASONS["unauthenticated"] };

  const u = session.user;
  if (!u.isEmailVerified) return { ok: false, reason: "unverified-email", message: REASONS["unverified-email"] };
  if (!u.onboardingCompleted) return { ok: false, reason: "not-onboarded", message: REASONS["not-onboarded"] };

  switch (u.accountLabel) {
    case "banned":
      return { ok: false, reason: "banned", message: REASONS["banned"] };
    case "rejected":
      return { ok: false, reason: "rejected", message: REASONS["rejected"] };
    case "in_review":
      return { ok: false, reason: "in-review", message: REASONS["in-review"] };
    case "unverified":
    case "verified":
    default:
      return {
        ok: true,
        userId: u.id,
        role: u.role,
        accountLabel: u.accountLabel ?? "unverified",
        isEmailVerified: u.isEmailVerified,
        onboardingCompleted: u.onboardingCompleted,
      };
  }
}

/**
 * Looser check: just confirms the user is signed in. Use for read endpoints
 * where everyone authenticated should see something (their own dashboard,
 * browsing the public feed, etc.).
 */
export async function requireRead(): Promise<AccessResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, reason: "unauthenticated", message: REASONS["unauthenticated"] };

  const u = session.user;
  return {
    ok: true,
    userId: u.id,
    role: u.role,
    accountLabel: u.accountLabel ?? "unverified",
    isEmailVerified: u.isEmailVerified,
    onboardingCompleted: u.onboardingCompleted,
  };
}

/**
 * Just the verified status — used to gate "discoverable in the feed". We
 * don't want unverified profiles surfacing to other users until a human
 * reviewer has cleared them.
 */
export function isDiscoverable(label: AccountLabel): boolean {
  return label === "verified";
}
