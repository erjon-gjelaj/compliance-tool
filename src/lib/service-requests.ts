import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  MAX_SERVICE_NOTE,
  type ServiceKind,
} from "@/lib/service-kinds";
import { recordEvent } from "@/lib/requests/store";

/**
 * Work someone has asked for that a person currently does by hand.
 *
 * This is what stands in for a checkout. The alternatives were a payment flow
 * that does not exist, or a button that says "coming soon" and does nothing —
 * the first is a lie and the second wastes the one moment someone actually
 * told us what they wanted. So the intent is recorded, the inbox is notified,
 * and the person is told plainly that a reply is coming from a human being.
 *
 * When billing does arrive, this table is the record of what people were
 * willing to ask for, which is better evidence for what to charge for than
 * anything guessed in advance.
 */

export type { ServiceKind } from "@/lib/service-kinds";

export type ServiceRequestRow = {
  id: string;
  created_at: string;
  email: string;
  company_id: string | null;
  submission_id: string | null;
  kind: ServiceKind;
  note: string | null;
  status: "new" | "in_progress" | "closed";
};

export async function recordServiceRequest({
  email,
  kind,
  note,
  companyId,
  submissionId,
}: {
  email: string;
  kind: ServiceKind;
  note: string | null;
  companyId?: string | null;
  submissionId?: string | null;
}): Promise<string> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      email,
      kind,
      note: note?.slice(0, MAX_SERVICE_NOTE) || null,
      company_id: companyId ?? null,
      submission_id: submissionId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not record that request: ${error.message}`);
  }

  /*
   * Opens the log. The request's state is computed from these events, so a
   * request with no 'submitted' event would render from the empty-log
   * fallback rather than from what actually happened - and its note would not
   * appear in the conversation at all.
   */
  await recordEvent({
    requestId: data.id as string,
    actor: "customer",
    kind: "submitted",
    body: note,
  });

  return data.id as string;
}
