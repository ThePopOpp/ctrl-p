import { NextResponse } from "next/server";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const environment = serverEnv("SQUARE_ENVIRONMENT").toLowerCase() === "production" ? "production" : "sandbox";
  const applicationId = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_APPLICATION_ID")
    : serverEnv("SQUARE_SANDBOX_APPLICATION_ID");
  const locationId = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_LOCATION_ID") || serverEnv("SQUARE_LOCATION_ID")
    : serverEnv("SQUARE_SANDBOX_LOCATION_ID") || serverEnv("SQUARE_LOCATION_ID");
  const currency = (serverEnv("SQUARE_CURRENCY") || "USD").toUpperCase();
  const scriptUrl = environment === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";

  if (!applicationId || !locationId) {
    return jsonError("Square Web Payments SDK is not configured for the selected environment.", 501);
  }

  return NextResponse.json({ applicationId, currency, environment, locationId, scriptUrl });
}
