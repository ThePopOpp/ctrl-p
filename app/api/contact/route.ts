import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function env(key: string) {
  return process.env[key] ?? "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { first_name, last_name, email, phone, company, subject, message } = body;

    if (!first_name || !email || !message) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email))) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceRoleKey) {
      const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

      const cleanFirst = String(first_name).trim();
      const cleanLast = last_name ? String(last_name).trim() : null;
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanPhone = phone ? String(phone).trim() : null;
      const cleanCompany = company ? String(company).trim() : null;
      const cleanSubject = subject ? String(subject).trim() : null;
      const cleanMessage = String(message).trim();
      const now = new Date().toISOString();

      const fullName = [cleanFirst, cleanLast].filter(Boolean).join(" ");
      const messageSubject = cleanSubject || `Contact form — ${fullName}`;

      await Promise.all([
        db.from("contact_submissions").insert({
          first_name: cleanFirst,
          last_name: cleanLast,
          email: cleanEmail,
          phone: cleanPhone,
          company: cleanCompany,
          subject: cleanSubject,
          message: cleanMessage,
          created_at: now,
          status: "new",
        }),
        db.from("messages").insert({
          subject: messageSubject,
          body: [
            `From: ${fullName}`,
            cleanEmail,
            cleanPhone ? `Phone: ${cleanPhone}` : null,
            cleanCompany ? `Company: ${cleanCompany}` : null,
            cleanSubject ? `Re: ${cleanSubject}` : null,
            "",
            cleanMessage,
          ].filter(v => v !== null).join("\n"),
          channel: "contact_form",
          direction: "inbound",
          read_at: null,
          created_at: now,
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
