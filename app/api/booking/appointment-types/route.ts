import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET() {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const types = await db
    .from("booking_appointment_types")
    .select("id, name, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_in_advance, location_type, meeting_url, color, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (types.error) return jsonError(types.error.message, 400);

  const typeIds = (types.data ?? []).map((type) => type.id);
  const questions = typeIds.length
    ? await db
      .from("booking_question_fields")
      .select("id, appointment_type_id, label, field_key, field_type, placeholder, help_text, is_required, options, display_order")
      .in("appointment_type_id", typeIds)
      .order("display_order", { ascending: true })
    : { data: [], error: null };

  if (questions.error) return jsonError(questions.error.message, 400);

  return NextResponse.json({
    appointmentTypes: (types.data ?? []).map((type) => ({
      ...type,
      questions: (questions.data ?? []).filter((field) => field.appointment_type_id === type.id),
    })),
  });
}
