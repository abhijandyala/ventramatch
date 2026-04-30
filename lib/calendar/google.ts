import { google, type calendar_v3 } from "googleapis";
import { withUserRls } from "@/lib/db";

/**
 * Google Calendar integration. Server-only.
 *
 * Two flows:
 *   1. OAuth connect: /api/calendar/google/connect redirects to Google
 *      consent → callback saves tokens → settings shows "Connected".
 *   2. Event CRUD: createEvent / updateEvent / deleteEvent use the stored
 *      tokens, auto-refreshing when expired.
 *
 * Env vars:
 *   AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET — reuses the existing Google OAuth
 *   app. Calendar scope is requested separately from sign-in scope.
 *   NEXT_PUBLIC_SITE_URL — for redirect URI construction.
 */

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const REDIRECT_PATH = "/api/calendar/google/callback";

function getOAuth2Client() {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured. Set AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET.");
  }
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return new google.auth.OAuth2(clientId, clientSecret, `${siteUrl}${REDIRECT_PATH}`);
}

/** Generate the consent URL. The user clicks this to connect their calendar. */
export function buildConsentUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: CALENDAR_SCOPES,
    prompt: "consent",
    state,
  });
}

/** Exchange the authorization code for tokens + save to DB. */
export async function exchangeCodeAndSave(
  userId: string,
  code: string,
): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  await withUserRls(null, async (sql) => {
    await sql`
      insert into public.calendar_connections
        (user_id, provider, access_token, refresh_token, token_expires_at)
      values (
        ${userId},
        'google'::public.calendar_provider,
        ${tokens.access_token!},
        ${tokens.refresh_token ?? null},
        ${tokens.expiry_date ? new Date(tokens.expiry_date) : null}
      )
      on conflict (user_id, provider) do update set
        access_token = excluded.access_token,
        refresh_token = coalesce(excluded.refresh_token, public.calendar_connections.refresh_token),
        token_expires_at = excluded.token_expires_at
    `;
  });
  console.log(`[calendar:google] connected userId=${userId}`);
}

/** Disconnect: delete the row. Token revocation is best-effort. */
export async function disconnect(userId: string): Promise<void> {
  const row = await getConnection(userId);
  if (!row) return;

  try {
    const client = getOAuth2Client();
    client.setCredentials({ access_token: row.access_token });
    await client.revokeToken(row.access_token);
  } catch {
    // Revocation fails silently if the token is already expired.
  }

  await withUserRls(null, async (sql) => {
    await sql`
      delete from public.calendar_connections
      where user_id = ${userId} and provider = 'google'
    `;
  });
  console.log(`[calendar:google] disconnected userId=${userId}`);
}

// ──────────────────────────────────────────────────────────────────────────
//  Token management
// ──────────────────────────────────────────────────────────────────────────

type Connection = {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: Date | null;
  calendar_id: string;
};

export async function getConnection(userId: string): Promise<Connection | null> {
  return withUserRls<Connection | null>(null, async (sql) => {
    const rows = await sql<Connection[]>`
      select access_token, refresh_token, token_expires_at, calendar_id
      from public.calendar_connections
      where user_id = ${userId} and provider = 'google'
      limit 1
    `;
    return rows[0] ?? null;
  });
}

export async function hasCalendar(userId: string): Promise<boolean> {
  return Boolean(await getConnection(userId));
}

async function getAuthedClient(userId: string) {
  const conn = await getConnection(userId);
  if (!conn) throw new Error("No Google Calendar connection for this user.");

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
  });

  // Auto-refresh if expired.
  const expiresAt = conn.token_expires_at?.getTime() ?? 0;
  if (Date.now() > expiresAt - 60_000 && conn.refresh_token) {
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      await withUserRls(null, async (sql) => {
        await sql`
          update public.calendar_connections
          set access_token = ${credentials.access_token!},
              token_expires_at = ${credentials.expiry_date ? new Date(credentials.expiry_date) : null}
          where user_id = ${userId} and provider = 'google'
        `;
      });
    } catch (err) {
      console.error("[calendar:google] refresh failed", err);
      throw new Error("Google Calendar token expired and refresh failed. Reconnect in Settings.");
    }
  }

  return google.calendar({ version: "v3", auth: client });
}

// ──────────────────────────────────────────────────────────────────────────
//  Event CRUD
// ──────────────────────────────────────────────────────────────────────────

export type CalendarEventInput = {
  summary: string;
  description: string;
  start: Date;
  /** Default 30 min. */
  durationMinutes?: number;
  attendeeEmails: string[];
};

export async function createEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<string> {
  const cal = await getAuthedClient(userId);
  const conn = await getConnection(userId);
  const calendarId = conn?.calendar_id ?? "primary";
  const endMs = input.start.getTime() + (input.durationMinutes ?? 30) * 60_000;

  const res = await cal.events.insert({
    calendarId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: new Date(endMs).toISOString() },
      attendees: input.attendeeEmails.map((email) => ({ email })),
    },
  });

  const eventId = res.data.id!;
  console.log(`[calendar:google] event created userId=${userId} eventId=${eventId}`);
  return eventId;
}

export async function updateEvent(
  userId: string,
  eventId: string,
  updates: Partial<CalendarEventInput>,
): Promise<void> {
  const cal = await getAuthedClient(userId);
  const conn = await getConnection(userId);
  const calendarId = conn?.calendar_id ?? "primary";

  const body: calendar_v3.Schema$Event = {};
  if (updates.summary) body.summary = updates.summary;
  if (updates.description) body.description = updates.description;
  if (updates.start) {
    const endMs = updates.start.getTime() + (updates.durationMinutes ?? 30) * 60_000;
    body.start = { dateTime: updates.start.toISOString() };
    body.end = { dateTime: new Date(endMs).toISOString() };
  }

  await cal.events.update({
    calendarId,
    eventId,
    requestBody: body,
  });
  console.log(`[calendar:google] event updated userId=${userId} eventId=${eventId}`);
}

export async function deleteEvent(
  userId: string,
  eventId: string,
): Promise<void> {
  const cal = await getAuthedClient(userId);
  const conn = await getConnection(userId);
  const calendarId = conn?.calendar_id ?? "primary";

  try {
    await cal.events.delete({ calendarId, eventId });
    console.log(`[calendar:google] event deleted userId=${userId} eventId=${eventId}`);
  } catch (err) {
    const status = (err as { code?: number })?.code;
    if (status === 404 || status === 410) return;
    throw err;
  }
}
