import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a print design layout assistant. Generate design layouts as structured JSON.

Return ONLY a valid JSON object — no markdown fences, no explanation. Use this exact structure:
{
  "name": "Short design name",
  "elements": [
    { "type": "text", "text": "...", "xr": 0.5, "yr": 0.35, "sizer": 0.065, "font": "Georgia, serif", "bold": true, "italic": false, "align": "center", "color": "#18181b", "letterSpacing": 0 },
    { "type": "rule", "xr": 0.5, "yr": 0.55, "wr": 0.4, "color": "#e4e4e7", "thick": 1 },
    { "type": "rect", "xr": 0.5, "yr": 0.2, "wr": 1.0, "hr": 0.25, "color": "#18181b" }
  ]
}

Coordinate rules (all values 0.0–1.0 relative to print area):
- xr: horizontal center (0=left, 0.5=center, 1=right)
- yr: vertical center (0=top, 0.5=middle, 1=bottom)
- sizer: font size as fraction of canvas width (0.025=small, 0.065=medium, 0.12=large)
- wr: element width as fraction of canvas width
- hr: element height as fraction of canvas height
- align: "center", "left", or "right"
- font: use only "Inter, sans-serif", "Georgia, serif", or "Arial, sans-serif"
- color: valid hex color string

Design rules:
- Elements ordered back-to-front (first = background, last = foreground text)
- 4–8 elements maximum, no more
- Leave breathing room — yr values between 0.12 and 0.88
- Text readable: sizer 0.025–0.12
- Use #a3e635 (lime green) sparingly as an accent color
- For dark backgrounds: add a rect (wr:1, hr:1) as the very first element
- Designs must look professional when printed on paper
- Never use letterSpacing values above 8`;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      prompt?: string;
      productType?: string;
      style?: string;
    };

    const { prompt, productType = 'Business Card', style = 'Minimal' } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Product type: ${productType}. Visual style: ${style}. Design request: ${prompt.trim()}`
      }],
    });

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';

    let design: unknown;
    try {
      design = JSON.parse(rawText);
    } catch {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ error: 'No valid JSON in response' }, { status: 500 });
      }
      try {
        design = JSON.parse(m[0]);
      } catch {
        return NextResponse.json({ error: 'Failed to parse design layout' }, { status: 500 });
      }
    }

    return NextResponse.json(design);
  } catch (err) {
    console.error('[ai-design]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
