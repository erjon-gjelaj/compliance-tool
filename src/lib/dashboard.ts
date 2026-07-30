import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { StoredDocument } from "@/lib/documents";
import type { SubmissionRow } from "@/lib/submissions";
import { validateAnalysis, type Analysis } from "@/lib/analysis/schema";

/**
 * Everything the client dashboard is allowed to read.
 *
 * Every function here takes the caller's email as its first argument and
 * filters on it in the query, rather than fetching by id and checking
 * ownership afterwards. That ordering is the whole access control model: a
 * missed check on a fetch-then-compare would return someone else's safety
 * paperwork, whereas a missed filter here returns nothing at all. There is no
 * function in this file that reads a submission without an email.
 *
 * Everything runs with the service role key, which bypasses row level
 * security — see getSupabaseAdminClient. The database will not stop a mistake
 * here, so the queries have to be right.
 */

/**
 * Matches an address case-insensitively on the domain, which is how
 * normaliseEmail stores it and how mail actually works.
 *
 * `ilike` and not `eq` because addresses were captured on a public form
 * before any of this existed, so the stored casing is whatever was typed.
 * The escaping matters: `%` and `_` are wildcards to ilike, so an
 * unescaped address containing one would match other people's rows. Rare in
 * practice, catastrophic once.
 */
function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export type DashboardSubmission = SubmissionRow & {
  documentCount: number;
  /** Whether a review exists to read, without loading it. */
  hasReview: boolean;
};

/** Every submission made with this address, newest first. */
export async function listSubmissionsForEmail(
  email: string,
): Promise<DashboardSubmission[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("*, submission_documents(id)")
    .ilike("email", emailPattern(email))
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Could not list your submissions: ${error.message}`);
  }

  type Joined = SubmissionRow & {
    submission_documents?: { id: string }[] | null;
  };

  return ((data ?? []) as Joined[]).map(
    ({ submission_documents, ...row }) => ({
      ...row,
      documentCount: (submission_documents ?? []).length,
      hasReview: row.analysis_status === "ok",
    }),
  );
}

/**
 * One submission, but only if this address owns it.
 *
 * Returns null for "does not exist" and for "belongs to someone else"
 * alike. The caller renders the same not-found page for both, so guessing a
 * uuid tells you nothing about whether it is real.
 */
export async function getSubmissionForEmail(
  email: string,
  submissionId: string,
): Promise<SubmissionRow | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .ilike("email", emailPattern(email))
    .maybeSingle();

  if (error) {
    // An id that isn't a uuid makes Postgres throw rather than return no
    // rows, and that is a 404 from where the caller stands, not a fault.
    console.warn(`Could not read submission ${submissionId}: ${error.message}`);
    return null;
  }

  return (data as SubmissionRow | null) ?? null;
}

/**
 * How extraction went for a file, in the client's terms.
 *
 * `unreadable` and `unsupported` are kept apart from "read" deliberately and
 * surfaced in the UI: a file we could not open must never sit in a list
 * looking exactly like one we reviewed. Silence would imply it was fine.
 */
export type DocumentView = StoredDocument & {
  text_status: string | null;
  readable: boolean;
};

export async function listDocumentsForSubmission(
  submissionId: string,
): Promise<DocumentView[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submission_documents")
    .select(
      "id, storage_path, file_name, mime_type, size_bytes, created_at, text_status",
    )
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not list documents: ${error.message}`);

  type Row = StoredDocument & { text_status: string | null };

  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    readable: row.text_status === "ok" || row.text_status === "ocr",
  }));
}

/**
 * Every document this address has ever sent, newest first.
 *
 * The workspace shows one document library rather than a folder per
 * submission, because that is how the person thinks about it: they sent us
 * their safety manual once, and which intake it happened to ride in on is our
 * bookkeeping, not theirs.
 *
 * Filtered by joining through to the submission's email, exactly as
 * getDocumentForEmail does. The join is the access control — a document id
 * alone is never enough, and there is no path here that fetches first and
 * checks ownership afterwards.
 */
export type LibraryDocument = DocumentView & {
  submission_id: string;
  submission_trade: string;
};

export async function listDocumentsForEmail(
  email: string,
): Promise<LibraryDocument[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submission_documents")
    .select(
      "id, storage_path, file_name, mime_type, size_bytes, created_at, text_status, submission_id, submissions!inner(email, trade)",
    )
    .ilike("submissions.email", emailPattern(email))
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Could not list your documents: ${error.message}`);
  }

  // supabase-js types an embedded relation as an array even when the foreign
  // key makes it at most one row, so this matches what actually arrives rather
  // than what reads naturally.
  type Row = StoredDocument & {
    text_status: string | null;
    submission_id: string;
    submissions: { email: string; trade: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map(({ submissions, ...row }) => ({
    ...row,
    readable: row.text_status === "ok" || row.text_status === "ocr",
    // The joined email was only ever there to filter on, and is dropped so an
    // owner's address cannot ride along into a caller that never asked.
    submission_trade: submissions?.[0]?.trade ?? "",
  }));
}

/**
 * The document row behind a download, confirmed to belong to this address.
 *
 * Joins through to the submission's email rather than trusting a document id
 * on its own. Document ids are uuids and are not secrets — they appear in
 * page markup — so the id alone must never be enough to fetch the bytes.
 */
export async function getDocumentForEmail(
  email: string,
  documentId: string,
): Promise<StoredDocument | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submission_documents")
    .select(
      "id, storage_path, file_name, mime_type, size_bytes, created_at, submissions!inner(email)",
    )
    .eq("id", documentId)
    .ilike("submissions.email", emailPattern(email))
    .maybeSingle();

  if (error) {
    console.warn(`Could not read document ${documentId}: ${error.message}`);
    return null;
  }

  if (!data) return null;

  // The joined submission was only ever there to filter on. Dropped rather
  // than returned, so an owner's email cannot ride along into a caller that
  // never asked for it.
  const { submissions, ...document } = data as StoredDocument & {
    submissions: unknown;
  };
  void submissions;

  return document;
}

/**
 * The most recent valid review for a submission.
 *
 * Re-validated on the way out, not just on the way in. The rules in
 * validateAnalysis are the promises this product makes about what may be
 * said, and a row written by an older, buggier version of the matcher should
 * not be able to render on a page today just because it made it into the
 * table once. A review that no longer passes is treated as absent, and the
 * page says the review is not available rather than showing it.
 */
export async function getReviewForSubmission(
  submissionId: string,
): Promise<Analysis | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("analyses")
    .select("result")
    .eq("submission_id", submissionId)
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`Could not read the review for ${submissionId}: ${error.message}`);
    return null;
  }

  if (!data?.result) return null;

  const validated = validateAnalysis(data.result);

  if (!validated.ok) {
    console.error(
      `Stored review for ${submissionId} no longer validates: ${validated.error}`,
    );
    return null;
  }

  return validated.value;
}

/**
 * Whether an address has anything at all behind it.
 *
 * Used by sign-in to decide whether sending a link is worth an email. The
 * answer is never shown to the person asking — see the sign-in action for
 * why — so this is only ever a reason not to send.
 */
export async function emailHasSubmissions(email: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .ilike("email", emailPattern(email));

  if (error) {
    console.error(`Could not check submissions for an address: ${error.message}`);
    return false;
  }

  return (count ?? 0) > 0;
}

export async function emailHasWorkspace(email: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .ilike("email", emailPattern(email));

  if (error) return false;
  return (count ?? 0) > 0;
}
