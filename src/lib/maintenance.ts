import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { programById } from "@/lib/programs/registry";

export const MAINTENANCE_KINDS = ["expiry", "review"] as const;
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export type MaintenanceRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  uploaded_document_id: string | null;
  generated_document_id: string | null;
  document_name: string;
  kind: MaintenanceKind;
  due_date: string;
  note: string | null;
};

function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export type ReminderState = "overdue" | "due_soon" | "later";

export function reminderState(
  dueDate: string,
  today: string,
  soonDays = 60,
): ReminderState {
  if (dueDate < today) return "overdue";

  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  const days = Math.floor((due - start) / 86_400_000);
  return days <= soonDays ? "due_soon" : "later";
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function listMaintenanceDates(
  email: string,
): Promise<MaintenanceRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("document_maintenance")
    .select("*")
    .ilike("email", emailPattern(email))
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(`Could not list maintenance dates: ${error.message}`);
  }
  return (data ?? []) as MaintenanceRow[];
}

async function uploadedName(email: string, id: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("submission_documents")
    .select("file_name, submissions!inner(email)")
    .eq("id", id)
    .ilike("submissions.email", emailPattern(email))
    .maybeSingle();

  if (error || !data) return null;
  return String(data.file_name);
}

async function generatedName(email: string, id: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("generated_documents")
    .select("program_id")
    .eq("id", id)
    .ilike("email", emailPattern(email))
    .maybeSingle();

  if (error || !data) return null;
  const programId = String(data.program_id);
  return programById(programId)?.title ?? programId;
}

export async function saveMaintenanceDate({
  email,
  targetType,
  targetId,
  kind,
  dueDate,
  note,
}: {
  email: string;
  targetType: "uploaded" | "generated";
  targetId: string;
  kind: MaintenanceKind;
  dueDate: string;
  note: string | null;
}): Promise<boolean> {
  const name =
    targetType === "uploaded"
      ? await uploadedName(email, targetId)
      : await generatedName(email, targetId);
  if (!name) return false;

  const supabase = getSupabaseAdminClient();
  const target =
    targetType === "uploaded"
      ? { uploaded_document_id: targetId, generated_document_id: null }
      : { uploaded_document_id: null, generated_document_id: targetId };

  const targetColumn =
    targetType === "uploaded"
      ? "uploaded_document_id"
      : "generated_document_id";

  const values = {
    email,
    document_name: name,
    kind,
    due_date: dueDate,
    note,
    ...target,
  };

  // The uniqueness rules are partial indexes because exactly one target
  // column is populated. Postgres cannot infer those indexes from Supabase's
  // column-only onConflict option, so update first and insert when absent.
  const { data: updated, error: updateError } = await supabase
    .from("document_maintenance")
    .update(values)
    .eq(targetColumn, targetId)
    .eq("kind", kind)
    .ilike("email", emailPattern(email))
    .select("id");

  if (updateError) {
    throw new Error(`Could not save maintenance date: ${updateError.message}`);
  }
  if (updated && updated.length > 0) return true;

  const { error: insertError } = await supabase
    .from("document_maintenance")
    .insert({
      email,
      document_name: name,
      kind,
      due_date: dueDate,
      note,
      ...target,
    });

  if (insertError) {
    throw new Error(`Could not save maintenance date: ${insertError.message}`);
  }
  return true;
}

export async function deleteMaintenanceDate(
  email: string,
  id: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("document_maintenance")
    .delete()
    .eq("id", id)
    .ilike("email", emailPattern(email));

  if (error) throw new Error(`Could not remove maintenance date: ${error.message}`);
}
