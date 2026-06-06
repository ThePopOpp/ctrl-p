// Google Calendar API helpers — no external SDK, raw fetch only

export type GoogleTokens = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string; // ISO timestamp
};

export type CalendarIntegration = {
  id: string;
  provider: string;
  account_email: string | null;
  calendar_id: string;
  calendar_name: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
};

export type FreeBusyWindow = { start: string; end: string };

function googleEnv() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://my.controlp.io";
  const redirectUri = `${appUrl}/api/admin/calendar/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function googleOAuthUrl(state?: string): string {
  const { clientId, redirectUri } = googleEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    ...(state ? { state } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = googleEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error || "Failed to exchange Google OAuth code.");
  }
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: expiresAt,
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error || "Failed to refresh Google token.");
  }
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  };
}

export async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json() as { email?: string };
  return data.email ?? null;
}

// Returns fresh access token, refreshing if needed (updates db row via callback)
export async function freshAccessToken(
  integration: CalendarIntegration,
  onRefreshed: (tokens: GoogleTokens) => Promise<void>
): Promise<string> {
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : new Date(0);
  const bufferMs = 2 * 60 * 1000; // refresh 2 min before expiry
  if (Date.now() < expiresAt.getTime() - bufferMs) {
    return integration.access_token;
  }
  if (!integration.refresh_token) throw new Error("No refresh token available — please reconnect Google Calendar.");
  const tokens = await refreshGoogleToken(integration.refresh_token);
  await onRefreshed(tokens);
  return tokens.access_token;
}

// Get busy windows from Google Calendar for a time range
export async function getGoogleFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<FreeBusyWindow[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json() as { calendars?: Record<string, { busy?: FreeBusyWindow[] }> };
  return data.calendars?.[calendarId]?.busy ?? [];
}

// Create a Google Calendar event, return the event ID
export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: string; // ISO
    end: string;   // ISO
    attendeeEmail?: string;
  }
): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start, timeZone: "America/Phoenix" },
        end: { dateTime: event.end, timeZone: "America/Phoenix" },
        ...(event.attendeeEmail ? { attendees: [{ email: event.attendeeEmail }] } : {}),
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { id?: string };
  return data.id ?? null;
}

// Update an existing Google Calendar event
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: { start?: string; end?: string; summary?: string; description?: string }
): Promise<boolean> {
  const body: Record<string, unknown> = {};
  if (patch.summary) body.summary = patch.summary;
  if (patch.description) body.description = patch.description;
  if (patch.start) body.start = { dateTime: patch.start, timeZone: "America/Phoenix" };
  if (patch.end) body.end = { dateTime: patch.end, timeZone: "America/Phoenix" };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return res.ok;
}

// Cancel a Google Calendar event (set status to cancelled)
export async function cancelGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  return res.ok;
}
