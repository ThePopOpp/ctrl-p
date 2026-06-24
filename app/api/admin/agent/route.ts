import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getServerSupabaseConfig, jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { AGENT_TOOL_DEFINITIONS, executeTool, type ToolCallRecord, type ToolContext } from "@/lib/admin/agent-tools";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the ControlP.io AI Operations Agent — a full-capability business assistant for Ctrl+P, a premium print, signs, and vehicle wrap shop based in Chandler, Arizona.

You help owner Jeremy Waters (Super Admin) run the business efficiently. You can analyze data, communicate with customers, create content, and manage operations.

## Business Overview
- Name: Ctrl+P / ControlP.io
- Location: Chandler, AZ (Metro Phoenix area)
- Platform: my.controlp.io
- Support email: hello@controlp.io
- Primary support line: (480) 999-9906

## Products & Services
- Vinyl Banners (standard, mesh, indoor/outdoor, step-and-repeat)
- Business Cards (standard, premium, spot UV, thick, foil)
- Signs & Yard Signs (coroplast, foam board, A-frame, real estate)
- Vehicle Wraps (full, partial, spot graphics, fleet)
- Flags (feather, teardrop, pole banners)
- Retractable Banners & Trade Show Displays
- Wall Art (framed prints, canvas, foam board)
- Apparel (screen printing, DTG)
- Stickers & Labels

## Pricing Philosophy
- Premium quality at competitive prices
- Volume discounts via quantity tiers
- Rush orders available at premium pricing
- Free shipping on qualifying orders

## Communication Channels
You have access to 4 Twilio phone numbers:
- (480) 999-9906 — primary SMS & voice
- (480) 999-9926 — SMS & voice
- (602) 777-3303 — voice only
- (425) 600-1455 — voice only

Default email: hello@controlp.io (Hostinger SMTP)

## Your Capabilities
You have tools to:
1. READ business data — orders, customers, messages, products, production queue
2. SEND SMS via Twilio — order updates, proof reminders, follow-ups
3. SEND EMAIL via SMTP — quotes, invoices, custom comms
4. SAVE content drafts — blog posts, email templates, SMS campaigns, social posts

## Tone & Communication Style
- Friendly, professional, and responsive
- Use customer names when available
- Be direct and clear about timelines and requirements
- Lead with the most important information
- For customer-facing messages, be warm but concise
- SMS messages should be under 160 characters unless necessary

## Guardrails
- Always proofread before sending customer-facing communications
- Include order numbers and customer names in messages where possible
- Flag unusual situations that need human review
- For sensitive communications, confirm the message before sending

## Content Creation
When creating content:
- Blog posts: SEO-friendly, helpful, focused on the print/sign industry
- Email templates: Clear subject, personal greeting, specific CTA
- SMS campaigns: Concise, actionable, include a call-back number
- Social posts: Engaging, visual-focused, include relevant hashtags

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;

// ─── Model configs ────────────────────────────────────────────────────────────

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"];
const ANTHROPIC_MODELS = ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"];

function getProvider(model: string): "openai" | "anthropic" {
  if (ANTHROPIC_MODELS.includes(model)) return "anthropic";
  return "openai";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    model?: string;
    conversationId?: string;
  };

  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const model = String(body.model || "gpt-4o");
  const conversationId = body.conversationId;

  if (!message) return jsonError("message is required.");

  const config = getServerSupabaseConfig();
  if ("error" in config) return config.error;

  const toolCtx = {
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
    actorId: auth.actorId,
    conversationId,
  };

  const provider = getProvider(model);

  try {
    if (provider === "openai") {
      const result = await runOpenAI(message, history, model, toolCtx);
      return NextResponse.json(result);
    } else {
      const result = await runAnthropic(message, history, model);
      return NextResponse.json(result);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Agent request failed.";
    return jsonError(msg, 500);
  }
}

// ─── OpenAI with tool-calling loop ────────────────────────────────────────────

async function runOpenAI(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  model: string,
  ctx: ToolContext,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const client = new OpenAI({ apiKey });
  const toolCalls: ToolCallRecord[] = [];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content } as OpenAI.Chat.ChatCompletionMessageParam)),
    { role: "user", content: message },
  ];

  let iterations = 0;
  while (iterations < 8) {
    iterations++;
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: [...AGENT_TOOL_DEFINITIONS],
      tool_choice: "auto",
      max_tokens: 4096,
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    if (!assistantMsg.tool_calls?.length) {
      return {
        response: assistantMsg.content ?? "",
        toolCalls,
        model,
        usage: response.usage,
      };
    }

    messages.push(assistantMsg);

    for (const tc of assistantMsg.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty args */ }

      let result: unknown;
      let errorMsg: string | undefined;
      try {
        result = await executeTool(tc.function.name, args, ctx);
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Tool execution failed.";
        result = { error: errorMsg };
      }

      toolCalls.push({ id: tc.id, name: tc.function.name, args, result, error: errorMsg });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    response: "I reached the maximum number of steps. Please try a more specific question.",
    toolCalls,
    model,
  };
}

// ─── Anthropic (chat-only, no tool calling yet) ───────────────────────────────

async function runAnthropic(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  model: string,
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ],
  });

  const text = response.content.find((c) => c.type === "text")?.text ?? "";
  return { response: text, toolCalls: [], model, usage: response.usage };
}
