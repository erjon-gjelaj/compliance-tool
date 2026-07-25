import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  OTHER_TRADE,
  type IntakeValues,
  type StepOneValue,
  type StepThreeValue,
  type StepTwoValue,
} from "@/lib/intake";

/**
 * Database access for Scope B intakes.
 *
 * Everything here runs with the service role key, which bypasses row level
 * security — see getSupabaseAdminClient for why that is the only way into
 * this table. `import "server-only"` makes importing this from a client
 * component a build error rather than a leak.
 */

export type SubmissionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "partial" | "complete";
  last_step: number;
  trade: string;
  hiring_client: string;
  platform: string;
  deadline: string | null;
  deadline_unknown: boolean;
  contact_name: string;
  email: string;
  headcount_band: string | null;
  states: string[] | null;
  emr: string | null;
  trir: string | null;
  previously_registered: string | null;
  documents_held: string[] | null;
  documents_unsure: boolean;
  documents_consent_at: string | null;
};

/** Creates the row for step 1 and returns its id. */
export async function createSubmission(value: StepOneValue): Promise<string> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .insert({ ...value, status: "partial", last_step: 1 })
    .select("id")
    .single();

  if (error) throw new Error(`Could not create submission: ${error.message}`);

  return data.id as string;
}

/**
 * Applies a later step to an existing row.
 *
 * The id comes from the browser, so it is not trusted as proof of anything —
 * it is a bearer capability over one row and nothing else. That is acceptable
 * here because the row holds what that same person just typed, there is
 * nothing to read back out through this path, and the ids are random v4
 * uuids. It is worth being clear that it is a capability rather than
 * authentication, because it is the reason nothing sensitive may be added to
 * this table later without revisiting it.
 */
export async function updateSubmission(
  id: string,
  patch: Partial<SubmissionRow>,
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("submissions")
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`Could not update submission: ${error.message}`);
}

export async function saveStepTwo(id: string, value: StepTwoValue) {
  await updateSubmission(id, { ...value, last_step: 2 });
}

export async function saveStepThree(id: string, value: StepThreeValue) {
  await updateSubmission(id, { ...value, last_step: 3 });
}

/**
 * Marks the intake finished, after step 4.
 *
 * Consent is stored as the moment it was given rather than as a flag, so the
 * record says when they agreed and not merely that they did. It is only
 * recorded when documents were actually accepted — reaching this step and
 * sending nothing is a normal, complete submission with nothing to consent
 * to.
 */
export async function completeWithDocuments(
  id: string,
  { consented }: { consented: boolean },
) {
  await updateSubmission(id, {
    last_step: 4,
    status: "complete",
    ...(consented ? { documents_consent_at: new Date().toISOString() } : {}),
  });
}

/** Records how far someone got when they skipped a step rather than filling it. */
export async function recordProgress(id: string, step: number) {
  await updateSubmission(id, { last_step: step });
}

export async function getSubmission(
  id: string,
): Promise<SubmissionRow | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not read submission: ${error.message}`);

  return (data as SubmissionRow | null) ?? null;
}

/**
 * Turns a stored row back into form values, so stepping backwards shows what
 * was already answered instead of an empty form.
 *
 * The trade split is the fiddly part: a written-in trade is stored as one
 * value, "Other: Rigging", and has to come apart again to repopulate the
 * select plus its text field.
 */
export function rowToValues(row: SubmissionRow): IntakeValues {
  const isOther = row.trade.startsWith(`${OTHER_TRADE}: `);

  return {
    trade: isOther ? OTHER_TRADE : row.trade,
    trade_other: isOther ? row.trade.slice(OTHER_TRADE.length + 2) : "",
    hiring_client: row.hiring_client,
    platform: row.platform,
    deadline: row.deadline ?? "",
    deadline_unknown: row.deadline_unknown ? "on" : "",
    contact_name: row.contact_name,
    email: row.email,
    headcount_band: row.headcount_band ?? "",
    states: row.states ?? [],
    emr: row.emr ?? "",
    trir: row.trir ?? "",
    previously_registered: row.previously_registered ?? "",
    documents_held: row.documents_held ?? [],
    documents_unsure: row.documents_unsure ? "on" : "",
  };
}
