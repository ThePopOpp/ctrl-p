// Twilio Voice FALLBACK handler — used only if the primary voice webhook
// errors or times out. Plays a graceful message and records a voicemail so no
// call is lost. Twilio may call this with POST (default) or GET.

function fallbackTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, we're having trouble connecting your call right now. Please leave a message after the tone and our team will get right back to you.</Say>
  <Record maxLength="120" />
  <Say>We didn't receive a message. Goodbye.</Say>
</Response>`;
}

function respond(): Response {
  return new Response(fallbackTwiml(), { headers: { "Content-Type": "application/xml" } });
}

export async function POST(): Promise<Response> {
  return respond();
}

export async function GET(): Promise<Response> {
  return respond();
}
