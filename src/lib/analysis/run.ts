import "server-only";

import { ANALYSIS_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { listDocuments, readDocument } from "@/lib/documents";
import { extractDocument, ocrBudget } from "@/lib/extract";
import { getSubmission, updateSubmission } from "@/lib/submissions";
import { requirementsFor } from "@/lib/requirements";
import { sendAnalysisEmails, sendExplainerEmails } from "@/lib/notify";
import {
  ANALYSIS_JSON_SCHEMA,
  validateAnalysis,
  type Analysis,
} from "@/lib/analysis/schema";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  type PromptDocument,
} from "@/lib/analysis/prompt";

/**
 * The analysis pipeline: extract, ask, validate, send.
 *
 * Runs after the response has gone out (see the `after` call in the intake
 * action) rather than inside the submission. Reading several PDFs and making
 * a model call takes far longer than anyone will hold a form open for, and
 * the person tapping "Send my gap check" must not be the one waiting for it.
 *
 * Every exit path sends an email. The one thing this must never do is leave
 * someone who filled in four screens hearing nothing at all — so a missing
 * API key, a model error, and output that fails validation all fall through
 * to the same honest explainer.
 */

type RunOutcome = "ok" | "fallback";

/** Pulls the text out of every uploaded document, recording how each went. */
async function extractAll(submissionId: string): Promise<PromptDocument[]> {
  const documents = await listDocuments(submissionId);
  if (documents.length === 0) return [];

  const supabase = getSupabaseAdminClient();
  const budget = ocrBudget();
  const results: PromptDocument[] = [];

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

    const isImage = document.mime_type.startsWith("image/");
    const extraction = await extractDocument(
      { bytes, mimeType: document.mime_type, fileName: document.file_name },
      // The budget is only spent on files that would actually use it, so an
      // image arriving after three others isn't refused because two PDFs
      // went past first.
      { allowOcr: isImage ? budget.spend() : false },
    );

    // Stored so a human can see what the model was actually given. Reading
    // the extraction is usually how you find out why an analysis was odd.
    const { error } = await supabase
      .from("submission_documents")
      .update({
        extracted_text: extraction.text || null,
        text_status: extraction.status,
        extracted_at: new Date().toISOString(),
      })
      .eq("id", document.id);

    if (error) {
      console.error("Could not record extraction:", error.message);
    }

    results.push({ document, ...extraction });
  }

  return results;
}

type ModelResult =
  | { ok: true; value: Analysis; raw: string; usage: Usage }
  | { ok: false; status: "invalid_output" | "model_error"; error: string; raw?: string; usage?: Usage };

type Usage = { input: number; output: number };

async function askModel(
  systemPrompt: string,
  userPrompt: string,
): Promise<ModelResult> {
  const client = getAnthropicClient();

  if (!client) {
    return { ok: false, status: "model_error", error: "no API key configured" };
  }

  let raw = "";
  let usage: Usage | undefined;

  try {
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      // Constrains generation to the schema rather than only checking the
      // answer afterwards. It is still validated on the way back.
      output_config: {
        format: {
          type: "json_schema",
          schema: ANALYSIS_JSON_SCHEMA,
        },
      },
    });

    usage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    };

    // Safety classifiers can decline a request; the response is a normal 200
    // with an empty or partial body, so this has to be checked before
    // reading content.
    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        status: "model_error",
        error: "the model declined this request",
        usage,
      };
    }

    raw = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!raw.trim()) {
      return { ok: false, status: "invalid_output", error: "empty response", usage };
    }

    const parsed: unknown = JSON.parse(raw);
    const validated = validateAnalysis(parsed);

    if (!validated.ok) {
      return { ok: false, status: "invalid_output", error: validated.error, raw, usage };
    }

    return { ok: true, value: validated.value, raw, usage };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "unknown error";

    // A parse failure is bad output; anything else is the call itself.
    const status = raw ? "invalid_output" : "model_error";
    return { ok: false, status, error, raw: raw || undefined, usage };
  }
}

type LogInput = {
  submissionId: string;
  status: "ok" | "invalid_output" | "model_error" | "skipped";
  systemPrompt?: string;
  userPrompt?: string;
  raw?: string;
  result?: Analysis;
  error?: string;
  usage?: Usage;
  durationMs: number;
};

/**
 * Records the run, whatever happened.
 *
 * Written before the email is sent, not after, so an output that breaks the
 * sender is still on record. This table is how anyone finds out what the
 * model actually says — the first thirty of these are worth reading closely.
 */
async function logRun(input: LogInput): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from("analyses").insert({
      submission_id: input.submissionId,
      status: input.status,
      model: ANALYSIS_MODEL,
      system_prompt: input.systemPrompt ?? null,
      user_prompt: input.userPrompt ?? null,
      raw_output: input.raw ?? null,
      result: input.result ?? null,
      error: input.error ?? null,
      input_tokens: input.usage?.input ?? null,
      output_tokens: input.usage?.output ?? null,
      duration_ms: input.durationMs,
    });

    if (error) console.error("Could not log the analysis run:", error.message);
  } catch (cause) {
    // Never allowed to break the pipeline: losing the log is bad, losing the
    // person's email is worse.
    console.error("Could not log the analysis run:", cause);
  }
}

/**
 * Runs the whole thing for one submission. Never throws.
 */
export async function runAnalysis(submissionId: string): Promise<RunOutcome> {
  const startedAt = Date.now();

  try {
    const submission = await getSubmission(submissionId);

    if (!submission) {
      console.error(`No submission ${submissionId} to analyse.`);
      return "fallback";
    }

    await updateSubmission(submissionId, { analysis_status: "pending" });

    const documents = await extractAll(submissionId);

    const userPrompt = buildUserPrompt({
      submission,
      documents,
      requirements: requirementsFor({
        trade: submission.trade,
        platform: submission.platform,
      }),
    });

    const result = await askModel(SYSTEM_PROMPT, userPrompt);
    const durationMs = Date.now() - startedAt;

    if (!result.ok) {
      await logRun({
        submissionId,
        status: result.status,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        raw: result.raw,
        error: result.error,
        usage: result.usage,
        durationMs,
      });

      console.error(
        `Analysis for ${submissionId} fell back (${result.status}): ${result.error}`,
      );

      // The safe generic explainer. Sending nothing is not an option and
      // sending malformed output is worse than sending neither.
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
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      raw: result.raw,
      result: result.value,
      usage: result.usage,
      durationMs,
    });

    await updateSubmission(submissionId, {
      analysis_status: "ok",
      analysed_at: new Date().toISOString(),
    });

    await sendAnalysisEmails(submission, result.value, documents);
    return "ok";
  } catch (cause) {
    console.error(`Analysis for ${submissionId} failed outright:`, cause);

    await logRun({
      submissionId,
      status: "model_error",
      error: cause instanceof Error ? cause.message : "unknown error",
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
        await sendExplainerEmails(submission, []);
      }
    } catch (sendFailure) {
      console.error("Could not send the fallback email either:", sendFailure);
    }

    return "fallback";
  }
}
