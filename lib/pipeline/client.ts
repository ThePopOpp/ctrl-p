"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export class PipelineApiError extends Error {
  status: number;
  blocking: string[];
  overridable: boolean;

  constructor(message: string, status: number, blocking: string[] = [], overridable = false) {
    super(message);
    this.status = status;
    this.blocking = blocking;
    this.overridable = overridable;
  }
}

async function token() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new PipelineApiError("Sign in again to use the Pipeline.", 401);
  return session.access_token;
}

type RequestInit_ = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown };

async function send<T>(url: string, init: { method: string; headers: Record<string, string>; body?: BodyInit }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch (error) {
    if (error instanceof PipelineApiError) throw error;
    throw new PipelineApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string; blocking?: string[]; overridable?: boolean };
  if (!response.ok) {
    throw new PipelineApiError(payload.error || `Request failed (${response.status}).`, response.status, payload.blocking ?? [], Boolean(payload.overridable));
  }
  return payload as T;
}

/**
 * A signed-in admin request to any Ctrl+P API route (Pipeline or another
 * module). A failed write throws, so the UI can only report success for a
 * request the server actually accepted.
 */
export async function apiRequest<T>(url: string, init: RequestInit_ = {}): Promise<T> {
  return send<T>(url, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Every Pipeline read and write goes through here. */
export function pipelineRequest<T>(path: string, init: RequestInit_ = {}): Promise<T> {
  return apiRequest<T>(`/api/admin/pipeline${path}`, init);
}

/** Multipart upload to a Pipeline route (voice notes). */
export async function pipelineUpload<T>(path: string, form: FormData): Promise<T> {
  return send<T>(`/api/admin/pipeline${path}`, { method: "POST", headers: { authorization: `Bearer ${await token()}` }, body: form });
}

export const errorMessage = (error: unknown, fallback = "Something went wrong.") =>
  error instanceof Error ? error.message : fallback;
