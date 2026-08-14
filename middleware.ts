import { NextResponse, type NextRequest } from "next/server";

/**
 * Permanent redirect from the old app host (my.controlp.io) to the primary
 * domain (controlp.io), preserving the path and query. Everything else passes
 * through untouched.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (host === "my.controlp.io") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = "controlp.io";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
