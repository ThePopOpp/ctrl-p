import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function env(key: string) {
  return process.env[key] ?? "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { first_name, last_name, email, phone, company, subject, message } = body;

    if (!first_name || !last_name || !email || !message) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceRoleKey) {
      const db = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      await db.from("contact_submissions").insert({
        first_name: String(first_name).trim(),
        last_name: String(last_name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        company: company ? String(company).trim() : null,
        subject: subject ? String(subject).trim() : null,
        message: String(message).trim(),
        created_at: new Date().toISOString(),
        status: "new",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
