"use server";

import {
  HONEYPOT_FIELD,
  validateMessage,
  type MessageFields,
  type MessageFormState,
  type MessageInput,
} from "@/lib/messages";
import { after } from "next/server";
import { sendContactMessage, sendIntakeEmails } from "@/lib/notify";
import { runAnalysis } from "@/lib/analysis/run";
import { CONTACT_EMAIL } from "@/lib/constants";
import {
  TOTAL_STEPS,
  initialIntakeState,
  validateStepFour,
  validateStepOne,
  validateStepThree,
  validateStepTwo,
  type IntakeFormState,
  type IntakeValues,
  type StepNumber,
} from "@/lib/intake";
import {
  completeWithDocuments,
  createSubmission,
  getSubmission,
  recordProgress,
  rowToValues,
  saveStepThree,
  saveStepTwo,
  updateSubmission,
} from "@/lib/submissions";
import {
  confirmUploads,
  listDocuments,
  requestUploadSlots,
} from "@/lib/documents";
import type { FileClaim } from "@/lib/uploads";
import {
  INTAKE_START_LIMIT,
  INTAKE_STEP_LIMIT,
  callerKey,
  rateLimit,
} from "@/lib/rate-limit";

/* -------------------------------------------------------------------------
 * Scope B intake
 * ---------------------------------------------------------------------- */

const INTAKE_FAILURE =
  "Something went wrong on our end and that step wasn't saved. Try again " +
  `in a moment, or email ${CONTACT_EMAIL} and we'll pick it up by hand.`;

const RATE_LIMITED =
  "That's a lot of submissions from one place in a short time. Give it a " +
  `few minutes, or email ${CONTACT_EMAIL} if you're stuck.`;

/** Every field the form posts, echoed back so a rejected step keeps its answers. */
function submittedIntakeValues(formData: FormData): IntakeValues {
  const single = [
    // Worth echoing more than most: a rejection notice is pasted out of a
    // portal, and losing it to a validation error on another field means
    // going back to find it again.
    "rejection_notes",
    "trade",
    "trade_other",
    "hiring_client",
    "platform",
    "deadline",
    "deadline_unknown",
    "contact_name",
    "email",
    "headcount_band",
    "emr",
    "trir",
    "previously_registered",
    "documents_unsure",
  ] as const;

  const multiple = ["states", "documents_held"] as const;

  const values: IntakeValues = {};

  for (const field of single) {
    const raw = formData.get(field);
    if (typeof raw === "string") values[field] = raw;
  }

  for (const field of multiple) {
    values[field] = formData
      .getAll(field)
      .filter((entry): entry is string => typeof entry === "string");
  }

  return values;
}

function stepFrom(formData: FormData): StepNumber {
  const raw = Number(formData.get("step"));
  if (raw === 2 || raw === 3 || raw === 4) return raw;
  return 1;
}

function idFrom(formData: FormData): string {
  const raw = formData.get("submission_id");
  return typeof raw === "string" ? raw : "";
}

/**
 * One action for the whole intake, dispatching on the step and the button
 * that submitted it.
 *
 * Each step is written as it is completed rather than everything at the end.
 * That is the reason this is several round trips instead of one: an intake
 * abandoned at step 2 still leaves a row with a name and an email on it, and
 * that is a lead worth calling. Holding it all in the browser until the last
 * screen would throw those away, which is the common case on a phone at a
 * job site.
 */
export async function submitIntakeStep(
  prevState: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  const step = stepFrom(formData);
  const submissionId = idFrom(formData) || prevState.submissionId;
  const values = submittedIntakeValues(formData);

  const intentRaw = formData.get("intent");
  const intent = typeof intentRaw === "string" ? intentRaw : "next";

  // Honeypot, same field and same reasoning as the contact form: hidden from
  // people, irresistible to form-filling bots. Answered with a plain success
  // so there is nothing to tune against, and nothing is written.
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    console.warn("Intake honeypot tripped; submission discarded.");
    return { status: "success", step };
  }

  const limit = rateLimit(
    await callerKey(),
    step === 1 && !submissionId ? INTAKE_START_LIMIT : INTAKE_STEP_LIMIT,
  );

  if (!limit.ok) {
    return { ...prevState, status: "error", message: RATE_LIMITED, values };
  }

  try {
    // Going back re-reads the stored row rather than trusting what the
    // browser still has, so the earlier step shows what was actually saved.
    if (intent === "back") {
      const previous = (step > 1 ? step - 1 : 1) as StepNumber;
      const stored = submissionId ? await getSubmission(submissionId) : null;

      return {
        status: "editing",
        step: previous,
        submissionId,
        values: stored ? rowToValues(stored) : values,
      };
    }

    if (step === 1) {
      // Step 1 is never skippable — it is the step that produces a lead.
      const result = validateStepOne(formData);

      if (!result.ok) {
        return {
          status: "error",
          step: 1,
          submissionId,
          message: "Check the highlighted fields and try again.",
          errors: result.errors,
          values,
        };
      }

      // Coming back to step 1 and changing something updates the row that
      // already exists, rather than leaving a second one behind for the same
      // person.
      let id = submissionId;
      if (id) {
        await updateSubmission(id, result.value);
      } else {
        id = await createSubmission(result.value);
      }

      return { status: "editing", step: 2, submissionId: id, values };
    }

    if (!submissionId) {
      // Nothing to attach a later step to. Sending them back to step 1 is
      // honest; silently discarding the answers is not.
      return {
        ...initialIntakeState,
        status: "error",
        message:
          "We lost track of your answers — start again from the first step.",
      };
    }

    if (step === 2) {
      if (intent === "skip") {
        await recordProgress(submissionId, 2);
        return { status: "editing", step: 3, submissionId };
      }

      const result = validateStepTwo(formData);

      if (!result.ok) {
        return {
          status: "error",
          step: 2,
          submissionId,
          message: "Check the highlighted fields and try again.",
          errors: result.errors,
          values,
        };
      }

      await saveStepTwo(submissionId, result.value);
      return { status: "editing", step: 3, submissionId, values };
    }

    if (step === 3) {
      if (intent === "skip") {
        await recordProgress(submissionId, 3);
        return { status: "editing", step: 4, submissionId };
      }

      const result = validateStepThree(formData);

      if (!result.ok) {
        return {
          status: "error",
          step: 3,
          submissionId,
          message: "Check the highlighted fields and try again.",
          errors: result.errors,
          values,
        };
      }

      await saveStepThree(submissionId, result.value);
      return { status: "editing", step: 4, submissionId, values };
    }

    // Step 4: the documents. Skipping still completes the intake — plenty of
    // people have nothing written down yet, which is itself an answer.
    if (intent === "skip") {
      await recordProgress(submissionId, TOTAL_STEPS);
    } else {
      const result = validateStepFour(formData);

      if (!result.ok) {
        return {
          status: "error",
          step: 4,
          submissionId,
          message: "Check the highlighted fields and try again.",
          errors: result.errors,
          values,
        };
      }

      // The files are already in storage by now — the browser sent them
      // straight there with signed upload URLs. This is where we find out
      // what actually landed, and anything that isn't what it claimed to be
      // is deleted rather than recorded.
      const confirmation = await confirmUploads(
        submissionId,
        result.value.uploads,
      );

      await completeWithDocuments(submissionId, {
        consented: result.value.consented && confirmation.accepted.length > 0,
      });

      if (confirmation.rejected.length > 0) {
        // Surfaced rather than swallowed. Someone who attached six files and
        // hears nothing will assume all six were read, and silence is
        // exactly the wrong answer about a document nobody looked at.
        console.warn(
          "Rejected uploads:",
          confirmation.rejected
            .map((entry) => `${entry.fileName} (${entry.reason})`)
            .join("; "),
        );

        if (confirmation.accepted.length === 0) {
          return {
            status: "error",
            step: 4,
            submissionId,
            message: `We couldn't read ${confirmation.rejected.length === 1 ? "that file" : "any of those files"}. Send without them, or try a different format.`,
            errors: {
              uploads: confirmation.rejected
                .map((entry) => `${entry.fileName}: ${entry.reason}`)
                .join(" · "),
            },
            values,
          };
        }
      }
    }

    // Only after the row is safely stored. Awaited so the sends aren't cut
    // short when the invocation ends, and it cannot throw or fail the
    // submission — see sendIntakeEmails.
    const stored = await getSubmission(submissionId);
    if (stored) {
      const documents = await listDocuments(submissionId);
      await sendIntakeEmails(
        stored,
        documents.map((document) => document.file_name),
      );
    }

    /*
     * The analysis runs after this response has gone out, not inside it.
     *
     * Reading several PDFs, running OCR over a photo and making a model call
     * takes far longer than anyone will hold a form open for — the person who
     * just tapped "Send my gap check" must not be the one waiting on it. Next
     * keeps the invocation alive for this callback after the response is
     * flushed, so the work still finishes on a serverless host.
     *
     * runAnalysis never throws and always ends by sending something, so
     * nothing here can strand a submission with no reply.
     */
    after(async () => {
      await runAnalysis(submissionId);
    });

    return { status: "success", step: TOTAL_STEPS, submissionId };
  } catch (cause) {
    // Logged server-side only: database errors can leak schema details.
    console.error("Intake step failed:", cause);
    return { ...prevState, status: "error", step, message: INTAKE_FAILURE, values };
  }
}

/**
 * Mints one signed upload URL per file, so the browser can send the bytes
 * straight to Supabase Storage.
 *
 * Called before the step-4 form is submitted, not as part of it. Uploads
 * cannot go through a server action at all: Vercel caps a serverless request
 * body at 4.5MB, and this step takes up to ten files of up to 10MB each.
 *
 * What comes back is a capability for one specific object path per file —
 * it cannot be used to write anywhere else, overwrite anything, or read
 * anything. The claims passed in are self-reported and are checked again
 * against the real bytes once they land; see confirmUploads.
 */
export async function createUploadSlots(
  submissionId: string,
  claims: FileClaim[],
) {
  if (!submissionId) {
    return { ok: false as const, error: "We lost track of your answers — start again from the first step." };
  }

  const limit = rateLimit(await callerKey(), INTAKE_STEP_LIMIT);
  if (!limit.ok) {
    return { ok: false as const, error: RATE_LIMITED };
  }

  // Proves the submission exists before handing out write capabilities
  // against its path, so a made-up id can't be used to park files in the
  // bucket.
  const submission = await getSubmission(submissionId);
  if (!submission) {
    return {
      ok: false as const,
      error: "We lost track of your answers — start again from the first step.",
    };
  }

  try {
    return await requestUploadSlots(submissionId, claims);
  } catch (cause) {
    console.error("Could not create upload slots:", cause);
    return {
      ok: false as const,
      error: "We couldn't start the upload. Try again in a moment.",
    };
  }
}

const MESSAGE_FAILURE =
  "We couldn't get that message out to our inbox, and it hasn't been saved " +
  `anywhere — so it would be lost if we said otherwise. Email ` +
  `${CONTACT_EMAIL} directly and it'll reach the same person.`;

function submittedMessageValues(formData: FormData): Partial<MessageInput> {
  const fields: MessageFields[] = ["name", "email", "message"];

  return Object.fromEntries(
    fields.map((field) => {
      const raw = formData.get(field);
      return [field, typeof raw === "string" ? raw : ""];
    }),
  );
}

/**
 * Contact-form submission. Emails our own inbox and nothing else — there is
 * no table behind this, by design (see sendContactMessage).
 *
 * The consequence is that this action, unlike submitLead, must not report
 * success unless the mail actually left. A message shown as sent but never
 * delivered is worse than an error: the person stops waiting for a reply
 * they were owed and we never knew they wrote.
 */
export async function submitMessage(
  _prevState: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const values = submittedMessageValues(formData);

  // Honeypot: hidden from people, irresistible to form-filling bots. Answered
  // with a plain success so whatever is on the other end has nothing to tune
  // against, and nothing is sent.
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    console.warn("Contact form honeypot tripped; message discarded.");
    return { status: "success" };
  }

  const result = validateMessage(formData);

  if (!result.ok) {
    return {
      status: "error",
      message: "Check the highlighted fields and send it again.",
      errors: result.errors,
      values,
    };
  }

  let sent = false;
  try {
    sent = await sendContactMessage(result.value);
  } catch (cause) {
    // sendContactMessage handles its own failures, so this is belt and
    // braces — but it must not throw past here and take the page down.
    console.error("Contact submission failed:", cause);
  }

  if (!sent) {
    return { status: "error", message: MESSAGE_FAILURE, values };
  }

  return { status: "success" };
}
