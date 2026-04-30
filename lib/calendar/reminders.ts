import { withUserRls } from "@/lib/db";

/**
 * Meeting reminder scanner. Designed to be called from a Railway
 * scheduled service (every 15 min). Not a route handler — import and
 * call `processReminders()` from a one-off script or cron entry point.
 *
 * Two windows:
 *   - 24h: fires when accepted_time is 23h–25h from now
 *   - 1h:  fires when accepted_time is 50min–70min from now
 *
 * Idempotent: checks intro_reminders_sent before enqueuing, inserts
 * the row atomically with the email_outbox write.
 */

type ReminderKind = "24h" | "1h";

const WINDOWS: { kind: ReminderKind; template: string; minMs: number; maxMs: number }[] = [
  {
    kind: "24h",
    template: "intro.reminder.24h",
    minMs: 23 * 60 * 60 * 1000,
    maxMs: 25 * 60 * 60 * 1000,
  },
  {
    kind: "1h",
    template: "intro.reminder.1h",
    minMs: 50 * 60 * 1000,
    maxMs: 70 * 60 * 1000,
  },
];

export async function processReminders(): Promise<number> {
  let total = 0;

  for (const w of WINDOWS) {
    const count = await processWindow(w);
    total += count;
  }

  if (total > 0) {
    console.log(`[reminders] enqueued ${total} reminders`);
  }
  return total;
}

async function processWindow(w: {
  kind: ReminderKind;
  template: string;
  minMs: number;
  maxMs: number;
}): Promise<number> {
  return withUserRls<number>(null, async (sql) => {
    type Row = {
      id: string;
      sender_user_id: string;
      recipient_user_id: string;
      accepted_time: Date | string;
      sender_name: string;
      recipient_name: string;
    };

    const now = Date.now();
    const windowStart = new Date(now + w.minMs);
    const windowEnd = new Date(now + w.maxMs);

    const rows = await sql<Row[]>`
      select ir.id, ir.sender_user_id, ir.recipient_user_id, ir.accepted_time,
             su.name as sender_name, ru.name as recipient_name
      from public.intro_requests ir
      join public.users su on su.id = ir.sender_user_id
      join public.users ru on ru.id = ir.recipient_user_id
      where ir.status = 'accepted'
        and ir.accepted_time is not null
        and ir.meeting_cancelled_at is null
        and ir.accepted_time between ${windowStart} and ${windowEnd}
        and not exists (
          select 1 from public.intro_reminders_sent rs
          where rs.intro_id = ir.id and rs.kind = ${w.kind}
        )
    `;

    let count = 0;
    for (const row of rows) {
      try {
        await sql.begin(async (tx) => {
          // Insert idempotency row first — if it conflicts, skip.
          await tx`
            insert into public.intro_reminders_sent (intro_id, kind)
            values (${row.id}, ${w.kind})
          `;

          // Enqueue reminders for both parties (honors should_send_email).
          for (const userId of [row.sender_user_id, row.recipient_user_id]) {
            const shouldSend = await tx<{ ok: boolean }[]>`
              select public.should_send_email(${userId}, ${w.template}) as ok
            `;
            if (shouldSend[0]?.ok) {
              await tx`
                insert into public.email_outbox (user_id, template, payload)
                values (
                  ${userId},
                  ${w.template},
                  ${JSON.stringify({
                    introId: row.id,
                    acceptedTime: row.accepted_time,
                    senderName: row.sender_name,
                    recipientName: row.recipient_name,
                  })}::jsonb
                )
              `;
            }
          }
        });
        count++;
      } catch (err) {
        // Conflict on idempotency row = already sent. Skip.
        const code = (err as { code?: string })?.code;
        if (code === "23505") continue;
        console.error(`[reminders] failed introId=${row.id} kind=${w.kind}`, err);
      }
    }

    return count;
  });
}
