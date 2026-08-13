import { supabase } from "../supabase/client";
import type { CommunicationRecord, ManualCommunicationInput } from "../../types/communication";
import type { ImportedEmailRecord } from "../email/rfc822";

function missingModule(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || Boolean(error.message?.includes("communication_records"));
}

export async function getCommunicationRecords() {
  const { data, error } = await supabase
    .from("communication_records_with_user")
    .select("*")
    .order("effective_at", { ascending: false })
    .limit(500);

  if (error) {
    if (missingModule(error)) return { records: [] as CommunicationRecord[], configured: false };
    throw new Error(error.message);
  }

  return { records: (data ?? []) as CommunicationRecord[], configured: true };
}

export async function recordManualCommunication(input: ManualCommunicationInput) {
  const { error } = await supabase.rpc("record_manual_communication", {
    p_channel: input.channel,
    p_direction: input.direction,
    p_subject: input.subject.trim(),
    p_counterpart: input.counterpart.trim(),
    p_body: input.body.trim(),
    p_declared_at: new Date(input.declaredAt).toISOString(),
    p_customer_reference: input.customerReference?.trim() || null,
    p_document_reference: input.documentReference?.trim() || null,
  });

  if (error) throw new Error(error.message);
}

export async function importEmailCommunications(records: ImportedEmailRecord[]) {
  const { data, error } = await supabase.rpc("import_email_communications", { p_records: records });
  if (error) throw new Error(error.message);
  return data as { inserted: number; updated: number; duplicates: number };
}
