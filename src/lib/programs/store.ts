import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { getCompanyForEmail } from "@/lib/companies";
import { PROGRAMS, programById } from "@/lib/programs/registry";
import { assembleProgram } from "@/lib/programs/assemble";
import { renderDocx, type DocumentMeta } from "@/lib/programs/render-docx";
import { renderPdf } from "@/lib/programs/render-pdf";
import type { Answers, CompanyContext } from "@/lib/programs/types";

/**
 * Producing, storing and reading generated programs.
 *
 * The order in `generateVersion` is deliberate and is the part worth
 * reviewing: assemble and validate, then render both files, then upload both,
 * and only then write the VERSION row. A version therefore always has two
 * real files behind it.
 *
 * The DOCUMENT row is the exception, and it is written first, because the
 * version rows need something to hang off. So the guarantee above is narrower
 * than it reads: a failure between the two writes leaves a document row with
 * no version — a library entry with nothing in it. That is not hypothetical.
 * The pdfkit fault in 063 put every generation on that path for days, and
 * because two screens read the row without checking for a version, the result
 * was not an error but a document that claimed to be ready and 404'd when
 * opened.
 *
 * `listDocumentsForEmail` drops those rows, which is what makes the narrow
 * guarantee safe to rely on: nothing outside this file ever sees a document
 * without a version. If that filter is removed, the claim in the paragraph
 * above quietly becomes false again.
 */

const BUCKET = "generated-documents";

function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export type DocumentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  company_id: string | null;
  program_id: string;
  submission_id: string | null;
  request_id: string | null;
  platform: string | null;
  hiring_client: string | null;
};

export type VersionRow = {
  id: string;
  document_id: string;
  created_at: string;
  version: number;
  template_version: string;
  answers: Answers;
  docx_path: string;
  pdf_path: string;
  effective_date: string;
  superseded_at: string | null;
  revision_reason: string | null;
};

export type DocumentWithVersions = DocumentRow & {
  versions: VersionRow[];
  /**
   * The one the customer should be using. Never null.
   *
   * It was `VersionRow | null`, and every screen that showed a document had
   * to remember that a document might not have one. Two of them forgot in the
   * same way — `entry.current?.version ?? 1` — which printed "Version 1,
   * ready to download" for a document with no files at all.
   *
   * A document row is created before its first version is rendered, so the
   * window where one exists with nothing in it is real: any failure between
   * those two writes leaves one behind, and the pdfkit bug in 063 left them
   * behind for every generation over several days. Rather than ask each
   * caller to handle that, `listDocumentsForEmail` drops them, which makes
   * the null unrepresentable here and the mistake impossible to repeat.
   */
  current: VersionRow;
};

/** Builds the context a template needs from the stored profile. */
export async function companyContextFor(
  email: string,
): Promise<CompanyContext | null> {
  const company = await getCompanyForEmail(email);
  if (!company?.name?.trim()) return null;

  return {
    companyName: company.name,
    trade: company.trade,
    headcountBand: company.headcount_band,
    operatingStates: company.operating_states,
    platforms: company.platforms,
    hiringClients: company.hiring_clients,
    operations: company.operations,
    // Logos are not stored yet — the profile takes a website, not a file.
    // Null here is the ordinary case and the cover handles it.
    logoUrl: null,
  };
}

export type JoinedDocumentRow = DocumentRow & {
  generated_document_versions: VersionRow[] | null;
};

/**
 * Turns the joined rows into documents, dropping the ones with no version.
 *
 * Separated from the query so it can be tested without a database. The rule
 * it enforces is small and the consequence of getting it wrong is not, so it
 * is worth pinning: see documents.test.mts.
 */
export function toDocuments(
  rows: JoinedDocumentRow[],
): DocumentWithVersions[] {
  const documents: DocumentWithVersions[] = [];

  for (const { generated_document_versions, ...row } of rows) {
    const versions = [...(generated_document_versions ?? [])].sort(
      (a, b) => b.version - a.version,
    );

    /*
     * Prefer the version nobody has superseded. Falling back to the newest
     * covers the case where every version has been marked superseded, which
     * should not happen but must not blank the page if it does.
     */
    const current = versions.find((entry) => !entry.superseded_at) ?? versions[0];

    // No version means nothing was ever produced under this row. See above.
    if (!current) continue;

    documents.push({ ...row, versions, current });
  }

  return documents;
}

/**
 * The documents this address holds, each with a version behind it.
 *
 * A `generated_documents` row is written before the files are rendered, so
 * one that never got a version is not a document — it is the scar of a
 * generation that failed partway. Those are dropped here, in the one place
 * every screen reads through, rather than filtered per page.
 *
 * That single decision is load-bearing in three places. The archive stops
 * advertising a download that does not exist. The programs page stops
 * counting the failed attempt as "held", which had made the program look
 * finished and removed the offer to try again — leaving the customer with no
 * route to the document at all. And the detail page's ownership check gets
 * back to meaning what it says.
 *
 * Dropping rather than surfacing them is deliberate. An empty row records
 * that our rendering broke, not anything the customer did or needs to act on,
 * and the honest repair is to generate the program — which is exactly what
 * they can now do again.
 */
export async function listDocumentsForEmail(
  email: string,
): Promise<DocumentWithVersions[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("generated_documents")
    .select("*, generated_document_versions(*)")
    .ilike("email", emailPattern(email))
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(`Could not list generated documents: ${error.message}`);
    return [];
  }

  return toDocuments((data ?? []) as JoinedDocumentRow[]);
}

export async function getDocumentForEmail(
  email: string,
  documentId: string,
): Promise<DocumentWithVersions | null> {
  const all = await listDocumentsForEmail(email);
  return all.find((entry) => entry.id === documentId) ?? null;
}

export type GenerateOutcome =
  | { ok: true; documentId: string; version: number }
  | { ok: false; reason: string };

/**
 * Produces a new version of a program.
 *
 * Used for both a first issue and a revision — they differ only in whether a
 * document row already exists and whether a reason was given. Keeping them one
 * function means a revision cannot drift into rendering differently from an
 * original, which would be a hard bug to see and an easy one to ship.
 */
export async function generateVersion({
  email,
  programId,
  answers,
  submissionId,
  requestId,
  revisionReason,
}: {
  email: string;
  programId: string;
  answers: Answers;
  submissionId?: string | null;
  requestId?: string | null;
  revisionReason?: string | null;
}): Promise<GenerateOutcome> {
  const template = programById(programId);
  if (!template) return { ok: false, reason: "We don't have that program." };

  const context = await companyContextFor(email);
  if (!context) {
    return {
      ok: false,
      reason: "Add your company name before generating a document.",
    };
  }

  const assembled = assembleProgram({ template, answers, context });

  if (!assembled.ok) {
    console.error(
      `Refused to generate ${programId} for ${email}:`,
      assembled.problems,
    );
    return {
      ok: false,
      reason:
        "Something in your answers doesn't add up yet. Go back through the questions and we'll try again.",
    };
  }

  const supabase = getSupabaseAdminClient();
  const company = await getCompanyForEmail(email);

  // The document row, created on first issue and reused after.
  const { data: existing } = await supabase
    .from("generated_documents")
    .select("*")
    .ilike("email", emailPattern(email))
    .eq("program_id", programId)
    .maybeSingle();

  let documentId = (existing as DocumentRow | null)?.id ?? null;

  if (!documentId) {
    const { data, error } = await supabase
      .from("generated_documents")
      .insert({
        email,
        company_id: company?.id ?? null,
        program_id: programId,
        submission_id: submissionId ?? null,
        request_id: requestId ?? null,
        platform: company?.platforms ?? null,
        hiring_client: company?.hiring_clients?.[0] ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Could not create the document row:", error);
      return { ok: false, reason: "We couldn't save that. Try again shortly." };
    }

    documentId = data.id as string;
  }

  const { data: versions } = await supabase
    .from("generated_document_versions")
    .select("version")
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(1);

  const previous = (versions ?? [])[0]?.version ?? 0;
  const version = previous + 1;

  const now = new Date();
  const effectiveDate = now.toISOString().slice(0, 10);

  const meta: DocumentMeta = {
    companyName: context.companyName,
    title: template.title,
    version,
    effectiveDate: now.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    // A first issue has no revision date. Printing one would suggest the
    // document had been revised when it has only just been written.
    revisionDate:
      version > 1
        ? now.toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null,
  };

  let docx: Buffer;
  let pdf: Buffer;

  try {
    [docx, pdf] = await Promise.all([
      renderDocx(meta, assembled.sections),
      renderPdf(meta, assembled.sections),
    ]);
  } catch (cause) {
    console.error("Rendering failed:", cause);
    return { ok: false, reason: "We couldn't produce the files. Try again shortly." };
  }

  const base = `${documentId}/v${version}`;
  const docxPath = `${base}.docx`;
  const pdfPath = `${base}.pdf`;

  const uploads = await Promise.all([
    supabase.storage.from(BUCKET).upload(docxPath, docx, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    }),
    supabase.storage.from(BUCKET).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    }),
  ]);

  const failed = uploads.find((entry) => entry.error);
  if (failed?.error) {
    console.error("Could not store the generated files:", failed.error);
    return { ok: false, reason: "We couldn't store the files. Try again shortly." };
  }

  // Only now does the version become real. Everything above can fail without
  // leaving a row that promises a download it cannot serve.
  const { error: insertError } = await supabase
    .from("generated_document_versions")
    .insert({
      document_id: documentId,
      version,
      template_version: template.templateVersion,
      answers,
      docx_path: docxPath,
      pdf_path: pdfPath,
      effective_date: effectiveDate,
      revision_reason: revisionReason ?? null,
    });

  if (insertError) {
    console.error("Could not record the version:", insertError);
    return { ok: false, reason: "We couldn't save that. Try again shortly." };
  }

  // Older versions are marked superseded only after the new one is safely
  // recorded, so a failure never leaves a document with nothing current.
  if (previous > 0) {
    await supabase
      .from("generated_document_versions")
      .update({ superseded_at: new Date().toISOString() })
      .eq("document_id", documentId)
      .lt("version", version)
      .is("superseded_at", null);
  }

  return { ok: true, documentId, version };
}

/**
 * A signed URL for one file, after ownership has been confirmed.
 *
 * Ownership is checked by loading the document through the email-filtered
 * reader rather than by trusting the version id, which appears in page markup
 * and is not a secret.
 */
export async function signedUrlForVersion({
  email,
  versionId,
  format,
}: {
  email: string;
  versionId: string;
  format: "pdf" | "docx";
}): Promise<string | null> {
  const documents = await listDocumentsForEmail(email);

  const owned = documents
    .flatMap((entry) => entry.versions)
    .find((entry) => entry.id === versionId);

  if (!owned) return null;

  const path = format === "pdf" ? owned.pdf_path : owned.docx_path;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300);

  if (error || !data) {
    console.warn(`Could not sign ${path}: ${error?.message}`);
    return null;
  }

  return data.signedUrl;
}

export { PROGRAMS };
