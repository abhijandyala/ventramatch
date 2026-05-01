"use server";

import { signIn, auth } from "@/auth";
import { withUserRls } from "@/lib/db";

type LinkedInAccount = {
  access_token: string | null;
  provider_account_id: string;
};

type LinkedInProfile = {
  name: string | null;
  picture: string | null;
  email: string | null;
};

export type LinkedInConnectionStatus = {
  connected: boolean;
  profile: LinkedInProfile | null;
};

export async function connectLinkedInAction() {
  await signIn("linkedin", { redirectTo: "/build?connected=linkedin&intent=fill" });
}

export async function getLinkedInStatusAction(): Promise<LinkedInConnectionStatus> {
  const session = await auth();
  if (!session?.user?.id) {
    return { connected: false, profile: null };
  }

  const account = await withUserRls<LinkedInAccount | null>(
    session.user.id,
    async (sql) => {
      const rows = await sql<LinkedInAccount[]>`
        select access_token, provider_account_id
        from public.accounts
        where user_id = ${session.user!.id}
          and provider = 'linkedin'
        limit 1
      `;
      return rows[0] ?? null;
    }
  );

  if (!account) {
    return { connected: false, profile: null };
  }

  // User has LinkedIn connected, fetch their basic profile from our stored user data
  // Default OIDC scopes only give us name, email, and picture
  const userData = await withUserRls<{ name: string | null; image: string | null; email: string | null } | null>(
    session.user.id,
    async (sql) => {
      const rows = await sql<{ name: string | null; image: string | null; email: string | null }[]>`
        select name, image, email
        from public.users
        where id = ${session.user!.id}
        limit 1
      `;
      return rows[0] ?? null;
    }
  );

  return {
    connected: true,
    profile: {
      name: userData?.name ?? null,
      picture: userData?.image ?? null,
      email: userData?.email ?? null,
    },
  };
}

export type ApplyLinkedInResult = {
  ok: boolean;
  error?: string;
  appliedFields?: string[];
};

export async function applyLinkedInDataAction(
  selectedFields: { name: boolean; picture: boolean; email: boolean }
): Promise<ApplyLinkedInResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not authenticated" };
  }

  // Get LinkedIn profile data from our stored user data
  const status = await getLinkedInStatusAction();
  if (!status.connected || !status.profile) {
    return { ok: false, error: "LinkedIn not connected" };
  }

  const appliedFields: string[] = [];

  // Apply selected fields (only if they have values and are selected)
  const updates: Record<string, string> = {};

  if (selectedFields.name && status.profile.name) {
    updates.name = status.profile.name;
    appliedFields.push("name");
  }

  if (selectedFields.picture && status.profile.picture) {
    updates.image = status.profile.picture;
    appliedFields.push("picture");
  }

  if (appliedFields.length === 0) {
    return { ok: true, appliedFields: [] };
  }

  // Update user record with LinkedIn data
  await withUserRls(session.user.id, async (sql) => {
    if (updates.name && updates.image) {
      await sql`
        update public.users
        set name = ${updates.name}, image = ${updates.image}
        where id = ${session.user!.id}
      `;
    } else if (updates.name) {
      await sql`
        update public.users
        set name = ${updates.name}
        where id = ${session.user!.id}
      `;
    } else if (updates.image) {
      await sql`
        update public.users
        set image = ${updates.image}
        where id = ${session.user!.id}
      `;
    }
  });

  return { ok: true, appliedFields };
}
