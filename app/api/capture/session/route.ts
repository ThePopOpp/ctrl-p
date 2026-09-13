import { NextResponse } from "next/server";

import { createClient } from "@/lib/server";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "production_manager", "customer_support"];

// GET /api/capture/session
//
// The extension's sign-in bridge. It calls this with `credentials: "include"`
// and the controlp.io host permission, so the staff member's existing Supabase
// session cookie comes along and they are not signing in twice.
//
// Returns a short-lived access token the panel then uses as a Bearer token on
// the capture and card routes. Nothing here accepts a credential — it only
// reads a session that already exists in the browser.
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      return NextResponse.json({ authenticated: false, reason: "no_session" }, { status: 401, headers: cors() });
    }

    // getSession reads the cookie; getUser verifies it against the auth server.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ authenticated: false, reason: "invalid_session" }, { status: 401, headers: cors() });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, email, full_name, role, status")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || !ALLOWED_ROLES.includes(profile.role) || profile.status !== "active") {
      return NextResponse.json(
        { authenticated: false, reason: "not_staff" },
        { status: 403, headers: cors() },
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        accessToken: session.access_token,
        expiresAt: session.expires_at ?? null,
        user: { id: profile.id, email: profile.email, name: profile.full_name, role: profile.role },
      },
      { headers: cors() },
    );
  } catch {
    return NextResponse.json({ authenticated: false, reason: "error" }, { status: 500, headers: cors() });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

/**
 * Chrome extension pages have an `chrome-extension://` origin, which is opaque
 * to a plain same-origin policy. Credentialed CORS forbids a wildcard, so the
 * extension origin is echoed back and locked to this one route.
 */
function cors(): HeadersInit {
  return {
    "access-control-allow-origin": process.env.EXTENSION_ORIGIN ?? "chrome-extension://*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, OPTIONS",
    vary: "origin",
  };
}
