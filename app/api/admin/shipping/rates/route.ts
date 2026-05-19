import { NextResponse } from "next/server";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

function numberValue(value: unknown) {
  return Number(value || 0);
}

function hasCarrierConfig(carrier: string) {
  if (carrier === "ups") return Boolean(serverEnv("UPS_CLIENT_ID") && serverEnv("UPS_CLIENT_SECRET") && serverEnv("UPS_ACCOUNT_NUMBER"));
  if (carrier === "usps") return Boolean(serverEnv("USPS_CLIENT_ID") && serverEnv("USPS_CLIENT_SECRET"));
  return false;
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    carrier?: string;
    service?: string;
    weightLbs?: number;
    lengthIn?: number;
    widthIn?: number;
    heightIn?: number;
    postalCodeFrom?: string;
    postalCodeTo?: string;
  } | null;

  if (!body) return jsonError("Rate request is required.");
  const carrier = String(body.carrier || "ups").toLowerCase();
  if (!["ups", "usps"].includes(carrier)) return jsonError("Carrier must be UPS or USPS.");

  const weight = Math.max(1, numberValue(body.weightLbs));
  const volume = Math.max(1, numberValue(body.lengthIn) * numberValue(body.widthIn) * numberValue(body.heightIn));
  const dimensionalWeight = volume / 139;
  const billableWeight = Math.max(weight, dimensionalWeight);
  const configured = hasCarrierConfig(carrier);

  // First pass: return a deterministic estimate until live carrier rating endpoints are approved and mapped.
  const base = carrier === "ups" ? 9.95 : 7.85;
  const amount = Number((base + billableWeight * (carrier === "ups" ? 1.15 : 0.88)).toFixed(2));

  return NextResponse.json({
    rate: {
      carrier,
      service: body.service || (carrier === "ups" ? "UPS Ground" : "USPS Ground Advantage"),
      amount,
      currency: "USD",
      estimatedDays: carrier === "ups" ? 3 : 4,
      configured,
      note: configured
        ? "Carrier credentials are present. Live rating can be wired as the next integration step."
        : "Estimated fallback rate. Add carrier API credentials to enable live UPS/USPS rates.",
    },
  });
}
