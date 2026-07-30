import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { listDocuments, readDocument } from "@/lib/documents";
import { extractDocument } from "@/lib/extract";
import { getSubmission, updateSubmission } from "@/lib/submissions";
import { REQUIREMENTS_VERSION } from "@/lib/requirements";
import { sendAnalysisEmails, sendExplainerEmails } from "@/lib/notify";
import { buildAnalysis } from "@/lib/analysis/match";
import { validateAnalysis, type Analysis } from "@/lib/analysis/schema";
import type { ExtractedDocument } from "@/lib/analysis/documents";
import {
  classifyDocument,
  identifyProgramKey,
} from "@/lib/document-classification";
import { scoreProgramElements } from "@/lib/programs/element-scoring";
import { generateAnswerKey } from "@/lib/programs/answer-key";
import { parseAcord25 } from "@/lib/parsers/acord25";
import {
  calculateSafetyRates,
  parse300A,
} from "@/lib/parsers/statistics";
import { parseTrainingRoster } from "@/lib/parsers/training";

/**
 * The analysis pipeline: extract, diff, validate, send.
 *
 * There is no model anywhere in here. Text comes out of the documents with
 * libraries, and the review is a text search against lib/requirements —
 * so the same submission produces the same answer every time, every claim
 * points at a file and a phrase, and nothing can be invented.
 *
 * It runs after the response has gone out (see the `after` call in the intake
 * action) rather than inside the submission. Reading several PDFs and running
 * OCR over a photo takes longer than anyone will hold a form open for.
 *
 * Every exit path sends an email. The one thing this must never do is leave
 * someone who filled in four screens hearing nothing at all.
 */

type RunOutcome = "ok" | "fallback";

/** Pulls the text out of every uploaded document, recording how each went. */
async function extractAll(
  submissionId: string,
  companyId: string | null,
): Promise<ExtractedDocument[]> {
  const documents = await listDocuments(submissionId);
  if (documents.length === 0) return [];

  const supabase = getSupabaseAdminClient();
  const results: ExtractedDocument[] = [];

  for (const document of documents) {
    const bytes = await readDocument(document.storage_path);

    if (!bytes) {
      results.push({
        document,
        status: "error",
        text: "",
        detail: "could not be read back from storage",
      });
      continue;
    }

    const extraction = await extractDocument({
      bytes,
      mimeType: document.mime_type,
      fileName: document.file_name,
    });
    const classification = classifyDocument(extraction.text);
    const programKey =
      classification.type === "program"
        ? identifyProgramKey(extraction.text)
        : null;

    // Stored so a human can see what was actually searched. Reading the
    // extracted text is usually how you find out why a review looked odd.
    const { error } = await supabase
      .from("submission_documents")
      .update({
        extracted_text: extraction.text || null,
        text_status: extraction.status,
        extracted_at: new Date().toISOString(),
        page_count: extraction.pages || null,
        extraction_status:
          extraction.status === "ok" || extraction.status === "ocr"
            ? "ready"
            : extraction.status === "needs_review"
              ? "needs_review"
              : extraction.status === "unsupported"
                ? "unsupported"
                : "error",
        extraction_method: extraction.method,
        extraction_confidence: extraction.confidence,
        page_map: extraction.pageMap,
        doc_type: classification.type,
      })
      .eq("id", document.id);

    if (error) {
      console.error("Could not record extraction:", error.message);
    }

    if (programKey) {
      const assessment = scoreProgramElements({
        programKey,
        pageMap: extraction.pageMap,
      });
      const { data: assessmentRow, error: assessmentError } = await supabase
        .from("program_assessments")
        .upsert(
          {
            document_id: document.id,
            program_key: assessment.programKey,
            config_release: assessment.configRelease,
            evaluator_version: assessment.evaluatorVersion,
            element_results: assessment.results,
          },
          {
            onConflict:
              "document_id,program_key,config_release,evaluator_version",
          },
        )
        .select("id")
        .single();

      if (assessmentError || !assessmentRow) {
        console.error(
          "Could not record element assessment:",
          assessmentError?.message,
        );
      } else {
        const answerKey = generateAnswerKey({
          programKey,
          elementResults: assessment.results,
        });
        const { error: answerError } = await supabase.from("answer_keys").upsert(
          {
            assessment_id: assessmentRow.id,
            program_key: programKey,
            question_version: answerKey.questionVersion,
            verification_state: answerKey.verificationState,
            items: answerKey.items,
          },
          { onConflict: "assessment_id,question_version" },
        );
        if (answerError) {
          console.error("Could not record answer key:", answerError.message);
        }
      }
    }

    if (classification.type === "coi") {
      const coverages = parseAcord25(extraction.pageMap);
      if (coverages.length > 0) {
        const { error: coverageError } = await supabase
          .from("insurance_coverages")
          .upsert(
            coverages.map((coverage) => ({
              document_id: document.id,
              coverage_type: coverage.type,
              carrier: coverage.carrier,
              policy_number: coverage.policyNumber,
              eff_date: coverage.effDate,
              exp_date: coverage.expDate,
              each_occurrence: coverage.eachOccurrence,
              general_aggregate: coverage.generalAggregate,
              products_comp_op: coverage.productsCompOp,
              additional_insured: coverage.additionalInsured,
              waiver_of_subrogation: coverage.waiverOfSubrogation,
              primary_noncontributory: coverage.primaryNoncontributory,
              notice_of_cancellation_days: coverage.noticeOfCancellationDays,
              evidence: {
                page: coverage.page,
                snippet: coverage.snippet,
                confidence: extraction.confidence,
              },
            })),
            { onConflict: "document_id,coverage_type,policy_number" },
          );
        if (coverageError) {
          console.error("Could not record insurance coverage:", coverageError.message);
        }
      }
    }

    if (classification.type === "osha_300a" && companyId) {
      const parsed = parse300A(extraction.pageMap);
      if (
        parsed.year &&
        parsed.hoursWorked &&
        parsed.recordableIncidents !== null &&
        parsed.dartCases !== null &&
        parsed.lostTimeCases !== null
      ) {
        const rates = calculateSafetyRates({
          hoursWorked: parsed.hoursWorked,
          recordableIncidents: parsed.recordableIncidents,
          dartCases: parsed.dartCases,
          lostTimeCases: parsed.lostTimeCases,
        });
        const { error: statisticsError } = await supabase
          .from("safety_statistics")
          .upsert(
            {
              document_id: document.id,
              company_id: companyId,
              report_year: parsed.year,
              hours_worked: parsed.hoursWorked,
              recordable_incidents: parsed.recordableIncidents,
              dart_cases: parsed.dartCases,
              lost_time_cases: parsed.lostTimeCases,
              trir: rates.trir,
              dart: rates.dart,
              ltir: rates.ltir,
              evidence: parsed.evidence,
            },
            { onConflict: "company_id,report_year" },
          );
        if (statisticsError) {
          console.error("Could not record safety statistics:", statisticsError.message);
        }
      }
    }

    if (classification.type === "training_roster" && companyId) {
      const training = parseTrainingRoster(extraction.pageMap);
      if (training.length > 0) {
        const { error: trainingError } = await supabase
          .from("training_records")
          .insert(
            training.map((record) => ({
              document_id: document.id,
              company_id: companyId,
              program_key: record.programKey,
              training_date: record.date,
              instructor_name: record.instructorName,
              instructor_signature: record.instructorSignature,
              attendees: record.attendees,
              source: record.source,
              evidence: {
                page: record.page,
                confidence: record.confidence,
              },
            })),
          );
        if (trainingError) {
          console.error("Could not record training roster:", trainingError.message);
        }
      }
    }

    results.push({ document, ...extraction });
  }

  return results;
}

type LogInput = {
  submissionId: string;
  status: "ok" | "invalid_output" | "error";
  result?: Analysis;
  error?: string;
  documentsRead: number;
  documentsUnreadable: number;
  durationMs: number;
};

/**
 * Records the run, whatever happened.
 *
 * Written before the email is sent, not after, so an output that breaks the
 * sender is still on record. This is how anyone finds out what actually goes
 * out — read the first thirty closely. `reference_version` is on the row
 * because a review is only interpretable next to the edition of the
 * requirements list that produced it.
 */
async function logRun(input: LogInput): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from("analyses").insert({
      submission_id: input.submissionId,
      status: input.status,
      reference_version: REQUIREMENTS_VERSION,
      result: input.result ?? null,
      error: input.error ?? null,
      documents_read: input.documentsRead,
      documents_unreadable: input.documentsUnreadable,
      duration_ms: input.durationMs,
    });

    if (error) console.error("Could not log the analysis run:", error.message);
  } catch (cause) {
    // Never allowed to break the pipeline: losing the log is bad, losing the
    // person's email is worse.
    console.error("Could not log the analysis run:", cause);
  }
}

function countDocuments(documents: ExtractedDocument[]) {
  const read = documents.filter(
    (entry) =>
      entry.status === "ok" ||
      entry.status === "ocr" ||
      entry.status === "needs_review",
  ).length;

  return { read, unreadable: documents.length - read };
}

/** Runs the whole thing for one submission. Never throws. */
export async function runAnalysis(submissionId: string): Promise<RunOutcome> {
  const startedAt = Date.now();
  let documents: ExtractedDocument[] = [];

  try {
    const submission = await getSubmission(submissionId);

    if (!submission) {
      console.error(`No submission ${submissionId} to analyse.`);
      return "fallback";
    }

    await updateSubmission(submissionId, { analysis_status: "pending" });

    documents = await extractAll(submissionId, submission.company_id);
    const counts = countDocuments(documents);

    const analysis = buildAnalysis({ submission, documents });

    // Validated even though we built it ourselves. These are the promises the
    // email makes, and a change to the matcher that quietly breaks one should
    // fail here rather than in somebody's inbox.
    const validated = validateAnalysis(analysis);

    if (!validated.ok) {
      await logRun({
        submissionId,
        status: "invalid_output",
        error: validated.error,
        documentsRead: counts.read,
        documentsUnreadable: counts.unreadable,
        durationMs: Date.now() - startedAt,
      });

      console.error(
        `Analysis for ${submissionId} failed its own checks: ${validated.error}`,
      );

      await updateSubmission(submissionId, {
        analysis_status: "fallback",
        analysed_at: new Date().toISOString(),
      });
      await sendExplainerEmails(submission, documents);
      return "fallback";
    }

    await logRun({
      submissionId,
      status: "ok",
      result: validated.value,
      documentsRead: counts.read,
      documentsUnreadable: counts.unreadable,
      durationMs: Date.now() - startedAt,
    });

    await updateSubmission(submissionId, {
      analysis_status: "ok",
      analysed_at: new Date().toISOString(),
    });

    await sendAnalysisEmails(submission, validated.value, documents);
    return "ok";
  } catch (cause) {
    console.error(`Analysis for ${submissionId} failed outright:`, cause);

    const counts = countDocuments(documents);
    await logRun({
      submissionId,
      status: "error",
      error: cause instanceof Error ? cause.message : "unknown error",
      documentsRead: counts.read,
      documentsUnreadable: counts.unreadable,
      durationMs: Date.now() - startedAt,
    });

    // Last resort: still try to say something to them.
    try {
      const submission = await getSubmission(submissionId);
      if (submission) {
        await updateSubmission(submissionId, {
          analysis_status: "fallback",
          analysed_at: new Date().toISOString(),
        });
        await sendExplainerEmails(submission, documents);
      }
    } catch (sendFailure) {
      console.error("Could not send the fallback email either:", sendFailure);
    }

    return "fallback";
  }
}
