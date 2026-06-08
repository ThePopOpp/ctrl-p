// TwiML handler for Twilio Voice — outbound browser calls and inbound routing

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);

  const to = params.get("To");
  const from = params.get("From");
  const myPhone = process.env.TWILIO_PHONE_NUMBER || "";

  // Build TwiML response
  const twiml = buildTwiml(to, from, myPhone);

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}

function buildTwiml(to: string | null, from: string | null, myPhone: string): string {
  // Outbound call from browser client (to is a real phone number, not our Twilio number)
  if (to && to !== myPhone && !to.startsWith("client:")) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${myPhone}" record="record-from-answer" recordingStatusCallback="/api/webhooks/twilio/recording-status">
    <Number>${escapeXml(to)}</Number>
  </Dial>
</Response>`;
  }

  // Inbound call to our number — route to browser client
  if (to === myPhone || (to && to.startsWith(myPhone))) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20">
    <Client>
      <Identity>ctrl-p-admin</Identity>
    </Client>
  </Dial>
  <Say>We're unavailable right now. Please leave a message after the tone.</Say>
  <Record maxLength="120" recordingStatusCallback="/api/webhooks/twilio/recording-status" />
</Response>`;
  }

  // Fallback
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling Ctrl P. Goodbye.</Say>
</Response>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
