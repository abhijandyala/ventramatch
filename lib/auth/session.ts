/**
 * Current-user session lookup. Stub implementation for the dashboard build.
 *
 * TODO(handoff): replace this whole file with a real cookie + database
 * session lookup once the auth/onboarding flow ships. Keep the
 * `SessionUser | null` return shape so the dashboards do not need to change.
 *
 * Toggle MOCK_ROLE to preview the other dashboard while building. The bouncer
 * in lib/dashboards/role-guard.ts will redirect to the matching home route
 * automatically.
 */

export type Role = "founder" | "investor";

export type SessionUser = {
  id: string;
  role: Role;
  displayName: string;
  initials: string;
};

const MOCK_ROLE: Role = "founder";

const MOCKS: Record<Role, SessionUser> = {
  founder: {
    id: "mock-founder-1",
    role: "founder",
    displayName: "Alex Rivera",
    initials: "AR",
  },
  investor: {
    id: "mock-investor-1",
    role: "investor",
    displayName: "Jules Lin",
    initials: "JL",
  },
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  return MOCKS[MOCK_ROLE];
}
