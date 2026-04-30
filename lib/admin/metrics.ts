import { withUserRls } from "@/lib/db";

export type DailyMetric = { day: string; value: number };

export type MetricsSummary = {
  signups7d: number;
  matches7d: number;
  introsSent7d: number;
  introsAccepted7d: number;
  funnel: {
    totalUsers: number;
    emailVerified: number;
    onboarded: number;
    profileVerified: number;
    banned: number;
  };
  dailySignups: DailyMetric[];
  dailyMatches: DailyMetric[];
  dailyIntros: DailyMetric[];
};

export async function fetchMetrics(): Promise<MetricsSummary> {
  return withUserRls<MetricsSummary>(null, async (sql) => {
    const [rates, funnel, signups, matches, intros] = await Promise.all([
      sql<{
        signups_7d: number;
        matches_7d: number;
        intros_sent_7d: number;
        intros_accepted_7d: number;
      }[]>`select * from public.admin_rates_7d`,

      sql<{
        total_users: number;
        email_verified: number;
        onboarded: number;
        profile_verified: number;
        banned: number;
      }[]>`select * from public.admin_verification_funnel`,

      sql<{ day: Date; signups: number }[]>`
        select * from public.admin_daily_signups limit 90
      `,
      sql<{ day: Date; matches: number }[]>`
        select * from public.admin_daily_matches limit 90
      `,
      sql<{ day: Date; intros_sent: number }[]>`
        select day, intros_sent from public.admin_daily_intros limit 90
      `,
    ]);

    const r = rates[0];
    const f = funnel[0];

    return {
      signups7d: r?.signups_7d ?? 0,
      matches7d: r?.matches_7d ?? 0,
      introsSent7d: r?.intros_sent_7d ?? 0,
      introsAccepted7d: r?.intros_accepted_7d ?? 0,
      funnel: {
        totalUsers: f?.total_users ?? 0,
        emailVerified: f?.email_verified ?? 0,
        onboarded: f?.onboarded ?? 0,
        profileVerified: f?.profile_verified ?? 0,
        banned: f?.banned ?? 0,
      },
      dailySignups: signups.map((r) => ({
        day: new Date(r.day).toISOString().slice(0, 10),
        value: r.signups,
      })),
      dailyMatches: matches.map((r) => ({
        day: new Date(r.day).toISOString().slice(0, 10),
        value: r.matches,
      })),
      dailyIntros: intros.map((r) => ({
        day: new Date(r.day).toISOString().slice(0, 10),
        value: r.intros_sent,
      })),
    };
  });
}
