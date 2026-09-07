import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { renewalFor } from "@/lib/renewals";
import type { VersionRow } from "@/lib/programs/store";

/**
 * What an operator needs to know that nothing else tells them.
 *
 * Two jobs, and they share a page because they answer the same question —
 * "what happened that I have not been told about".
 *
 * ## 1. Analyses that went wrong
 *
 * The analysis runs inside `after()`, so it happens once the response has
 * already gone. A failure there is invisible: the contractor gets the generic
 * explainer instead of their review, nothing raises an alarm, and the first
 * anybody hears of it is when they ask. Every run is already logged to the
 * `analyses` table with its error — the row has existed since task 032 and
 * nothing has ever read it.
 *
 * This is deliberately not a third-party monitoring service. The data is
 * already in the database, and one query beats an account, a DSN and a
 * monthly bill for a product doing this volume.
 *
 * ## 2. The research harvest
 *
 * The intake asks what the hiring client actually asked for, and rejection
 * submissions carry the reviewer's own words pasted in. Both are the exact
 * evidence needed to move a requirement from `verified: false` to verified —
 * and both currently land in a column nobody reads. Collecting them in one
 * place means every submission adds to the reference data instead of
 * producing one email and being forgotten.
 */

export type FailedRun = {
  id: string;
  submission_id: string;
  created_at: string;
  status: string;
  error: string | null;
  documents_read: number;
  documents_unreadable: number;
  reference_version: string;
  trade: string | null;
  platform: string | null;
  email: string | null;
};

/**
 * Runs that did not produce a review, newest first.
 *
 * `invalid_output` is included alongside `error`. It means the review was
 * built and then failed its own validation, which is a different fault to a
 * crash and a more interesting one — it says the reference data or the schema
 * disagreed with what the matcher produced.
 */
export async function listFailedRuns(limit = 50): Promise<FailedRun[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("analyses")
    .select(
      "id, submission_id, created_at, status, error, documents_read, documents_unreadable, reference_version, submissions(trade, platform, email)",
    )
    .in("status", ["error", "invalid_output"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`Could not list failed runs: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => {
    // Supabase types an embedded row as an array or an object depending on
    // the relationship it infers; normalising here keeps the caller simple.
    const joined = row.submissions as
      | { trade: string; platform: string; email: string }
      | { trade: string; platform: string; email: string }[]
      | null;
    const submission = Array.isArray(joined) ? joined[0] : joined;

    return {
      id: row.id as string,
      submission_id: row.submission_id as string,
      created_at: row.created_at as string,
      status: row.status as string,
      error: (row.error as string | null) ?? null,
      documents_read: (row.documents_read as number) ?? 0,
      documents_unreadable: (row.documents_unreadable as number) ?? 0,
      reference_version: row.reference_version as string,
      trade: submission?.trade ?? null,
      platform: submission?.platform ?? null,
      email: submission?.email ?? null,
    };
  });
}

/** How runs have gone lately, so a spike is visible without reading rows. */
export type RunTally = { ok: number; fallback: number; total: number };

export async function tallyRuns(): Promise<RunTally> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.from("analyses").select("status").limit(1000);

  if (error) {
    console.warn(`Could not tally runs: ${error.message}`);
    return { ok: 0, fallback: 0, total: 0 };
  }

  const rows = data ?? [];
  const ok = rows.filter((row) => row.status === "ok").length;

  return { ok, fallback: rows.length - ok, total: rows.length };
}

export type HarvestEntry = {
  submission_id: string;
  created_at: string;
  trade: string;
  platform: string;
  hiring_client: string;
  /** What the reviewer sent back, in their words. Rejections only. */
  rejection_notes: string | null;
  /** What they ticked as already held, which is their own reading of the ask. */
  documents_held: string[] | null;
};

/**
 * Submissions carrying something that could verify a requirement.
 *
 * Filtered to rows that actually say something: a submission with no
 * rejection notes and no checklist answers is a lead, not evidence, and
 * listing it would bury the handful that are worth reading.
 */
export async function listHarvest(limit = 100): Promise<HarvestEntry[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, created_at, trade, platform, hiring_client, rejection_notes, documents_held",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`Could not list the harvest: ${error.message}`);
    return [];
  }

  return (data ?? [])
    .map((row) => ({
      submission_id: row.id as string,
      created_at: row.created_at as string,
      trade: (row.trade as string) ?? "",
      platform: (row.platform as string) ?? "",
      hiring_client: (row.hiring_client as string) ?? "",
      rejection_notes: (row.rejection_notes as string | null) ?? null,
      documents_held: (row.documents_held as string[] | null) ?? null,
    }))
    .filter(
      (entry) =>
        (entry.rejection_notes && entry.rejection_notes.trim().length > 0) ||
        (entry.documents_held && entry.documents_held.length > 0),
    );
}

/* ------------------------------------------------------------------ */

export type DueReview = {
  email: string;
  companyName: string | null;
  programId: string;
  documentId: string;
  version: number;
  effectiveDate: string;
  reviewDue: string;
  daysUntilDue: number;
  status: "due_soon" | "overdue";
};

/**
 * Programs whose own annual review has come round, across every company.
 *
 * This is the maintenance service made deliverable. The pricing page sells
 * "document updates, renewal reminders, reviews when a new client asks", and
 * that is described there as the part a person does — but a person cannot do
 * it without a list of who is due, and nothing in this product produced one.
 *
 * Deliberately not a scheduled email. There is no cron in this deployment and
 * no secret to protect one, and half a scheduler that silently stops firing
 * is worse than a page somebody opens: this list is wrong in a way that is
 * visible, which a missed send never is.
 *
 * Only documents whose live version carries a date it can be computed from
 * appear. See lib/renewals — nothing here is guessed.
 */
export async function listDueReviews(limit = 100): Promise<DueReview[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("generated_documents")
    .select("id, email, program_id, generated_document_versions(*), companies(name)")
    .limit(limit);

  if (error) {
    console.warn(`Could not list due reviews: ${error.message}`);
    return [];
  }

  const due: DueReview[] = [];

  for (const row of data ?? []) {
    const versions = [...((row.generated_document_versions ?? []) as VersionRow[])].sort(
      (a, b) => b.version - a.version,
    );
    const current = versions.find((entry) => !entry.superseded_at) ?? versions[0] ?? null;

    const renewal = renewalFor({
      id: row.id as string,
      program_id: row.program_id as string,
      current,
    });

    if (!renewal || renewal.status === "current") continue;

    // As in listFailedRuns: Supabase types an embedded row as an object or an
    // array depending on the relationship it infers.
    const joined = row.companies as { name: string } | { name: string }[] | null;
    const company = Array.isArray(joined) ? joined[0] : joined;

    due.push({
      email: row.email as string,
      companyName: company?.name ?? null,
      programId: renewal.programId,
      documentId: renewal.documentId,
      version: renewal.version,
      effectiveDate: renewal.effectiveDate,
      reviewDue: renewal.reviewDue,
      daysUntilDue: renewal.daysUntilDue,
      status: renewal.status,
    });
  }

  return due.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
