"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

function generateCode(): string {
  return randomBytes(5).toString("hex"); // 10 hex chars
}

export async function createReferralCodeAction(): Promise<
  Result<{ code: string }>
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in." };

  const code = generateCode();
  try {
    await withUserRls(session.user.id, async (sql) => {
      await sql`
        insert into public.referral_codes (code, owner_user_id)
        values (${code}, ${session.user.id})
      `;
    });
    revalidatePath("/settings");
    return { ok: true, code };
  } catch {
    return { ok: false, error: "Could not create code." };
  }
}

export type ReferralStat = {
  code: string;
  kind: string;
  signups: number;
  verified: number;
  createdAt: Date;
};

export async function fetchReferralStats(
  userId: string,
): Promise<ReferralStat[]> {
  return withUserRls<ReferralStat[]>(userId, async (sql) => {
    type Row = {
      code: string;
      kind: string;
      created_at: Date | string;
      signups: number;
      verified: number;
    };
    const rows = await sql<Row[]>`
      select rc.code, rc.kind, rc.created_at,
             count(r.id)::int as signups,
             count(r.id) filter (where r.became_verified_at is not null)::int as verified
      from public.referral_codes rc
      left join public.referrals r on r.code = rc.code
      where rc.owner_user_id = ${userId}
      group by rc.code, rc.kind, rc.created_at
      order by rc.created_at desc
    `;
    return rows.map((r) => ({
      code: r.code,
      kind: r.kind,
      signups: r.signups,
      verified: r.verified,
      createdAt: new Date(r.created_at),
    }));
  });
}
