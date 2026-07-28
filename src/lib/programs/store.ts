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
 * and only then write the row. A version row therefore always has two real
 * files behind it. Writing the row first would leave a document in someone's
 * library that cannot be downloaded, which is worse than a failure they can
 * retry.
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
  /** The one the customer should be using. */
  current: VersionRow | null;
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

  type Joined = DocumentRow & {
    generated_document_versions: VersionRow[] | null;
  };

  return ((data ?? []) as Joined[]).map(
    ({ generated_document_versions, ...row }) => {
      const versions = [...(generated_document_versions ?? [])].sort(
        (a, b) => b.version - a.version,
      );

      return {
        ...row,
        versions,
        current: versions.find((entry) => !entry.superseded_at) ?? versions[0] ?? null,
      };
    },
  );
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
