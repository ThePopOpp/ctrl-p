// TwiML handler for Twilio Voice — outbound browser calls and inbound routing

function getOwnedNumbers(): string[] {
  // All Twilio numbers on the account — used for inbound routing and outbound caller ID validation
  const fromEnv = process.env.TWILIO_PHONE_NUMBERS || "";
  if (fromEnv) return fromEnv.split(",").map((n) => n.trim()).filter(Boolean);
  // Fallback: single-number legacy var
  const single = process.env.TWILIO_PHONE_NUMBER || "";
  return single ? [single] : [];
}

function getSmsNumbers(): string[] {
  const fromEnv = process.env.TWILIO_SMS_NUMBERS || "";
  if (fromEnv) return fromEnv.split(",").map((n) => n.trim()).filter(Boolean);
  // Default: first owned number
  const owned = getOwnedNumbers();
  return owned.length ? [owned[0]] : [];
}

function defaultCallerId(): string {
  return process.env.TWILIO_PHONE_NUMBER || getOwnedNumbers()[0] || "";
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);

  const to = params.get("To");
  const from = params.get("From");

  // The browser dialer can pass a preferred caller ID via the TwiML App custom param
  const requestedCallerId = params.get("callerId") || params.get("CallerID") || "";
  const ownedNumbers = getOwnedNumbers();

  // Validate requested caller ID is one of our numbers; fall back to default
  const callerId =
    requestedCallerId && ownedNumbers.includes(requestedCallerId)
      ? requestedCallerId
      : defaultCallerId();

  const twiml = buildTwiml(to, from, callerId, ownedNumbers);

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}

function buildTwiml(
  to: string | null,
  from: string | null,
  callerId: string,
  ownedNumbers: string[],
): string {
  const recordingCallback =
    (process.env.PUBLIC_APP_URL || "https://my.controlp.io") +
    "/api/webhooks/twilio/recording-status";

  // Outbound call from browser client — to is a real E.164 number
  const isOwnedNumber = to && ownedNumbers.includes(to);
  const isClientUri = to && to.startsWith("client:");

  if (to && !isOwnedNumber && !isClientUri) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" record="record-from-answer" recordingStatusCallback="${escapeXml(recordingCallback)}">
    <Number>${escapeXml(to)}</Number>
  </Dial>
</Response>`;
  }

  // Inbound call to any of our numbers — ring the browser client
  if (to && isOwnedNumber) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20">
    <Client>
      <Identity>ctrl-p-admin</Identity>
    </Client>
  </Dial>
  <Say>We're unavailable right now. Please leave a message after the tone.</Say>
  <Record maxLength="120" recordingStatusCallback="${escapeXml(recordingCallback)}" />
</Response>`;
  }

  // Fallback
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling Ctrl P. Goodbye.</Say>
</Response>`;
}
