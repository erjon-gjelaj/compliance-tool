import type { SubmissionRow } from "@/lib/submissions";
import type { Requirement } from "@/lib/requirements";
import type { RejectionReading } from "@/lib/analysis/schema";

/**
 * Reads what a contractor pasted out of a rejection notice.
 *
 * The whole of this module operates on one input: text the contractor copied
 * from their portal and pasted into our form. That is worth stating at the
 * top because of what it rules out. We do not see ISNetworld or Avetta. We
 * have no reviewer, no account, no queue position and no requirement list.
 * Every finding here is a fact about a paragraph the contractor gave us, and
 * the wording downstream has to keep it that way.
 *
 * So the distinction this module exists to hold:
 *
 *   "your notes mention lockout/tagout"     — checkable, and what we say
 *   "the reviewer requires lockout/tagout"  — a claim about a document we
 *                                             have never seen, and one we
 *                                             are not in a position to make
 *
 * The second is the natural sentence to write and the reason this is a
 * separate module rather than a few lines inside the matcher. A rejection is
 * the moment a contractor is most inclined to believe whatever they are told,
 * because somebody with authority has just told them they are wrong.
 *
 * The matching itself is the same word-boundary phrase search the rest of the
 * review uses, pointed at the pasted text instead of at an uploaded document.
 * It reuses each requirement's existing recognition phrases, so a rejection
 * mentioning "energy control procedure" lands on the same requirement that
 * phrase identifies in a manual — no second vocabulary to keep in step.
 */

/**
 * Word-boundary search, so "loto" does not fire inside "photo".
 *
 * Deliberately a copy of the matcher's boundary rule rather than a shared
 * helper: that one searches an extracted document and returns which file it
 * hit, which is not a question that means anything here. Sharing it would
 * have meant a parameter that is always null on one of the two call sites.
 */
function mentions(haystack: string, phrase: string): boolean {
  const needle = phrase.toLowerCase();
  const at = haystack.indexOf(needle);
  if (at === -1) return false;

  const before = at === 0 ? " " : haystack[at - 1];
  const after = haystack[at + needle.length] ?? " ";
  const isBoundary = (character: string) => !/[a-z0-9]/.test(character);

  return isBoundary(before) && isBoundary(after);
}

/**
 * Which requirements the pasted notes appear to be about.
 *
 * Returns null when this submission did not come through the rejection door,
 * so the review carries no rejection block at all rather than an empty one —
 * absent and "nothing found" are different states and the email renders them
 * differently.
 */
export function readRejection(
  submission: SubmissionRow,
  requirements: readonly Requirement[],
): RejectionReading | null {
  if (submission.entry_reason !== "rejection") return null;

  const notes = submission.rejection_notes?.trim() ?? "";

  if (!notes) {
    // The door was used but nothing was pasted. They may have attached the
    // notice as a file instead, which is a supported way to do this — the
    // documents are read by the ordinary pipeline either way. What we must
    // not do is guess at a subject.
    return { notesProvided: false, subjects: [] };
  }

  const haystack = notes.toLowerCase();
  const subjects: RejectionReading["subjects"] = [];

  for (const requirement of requirements) {
    const phrase = requirement.phrases.find((entry) =>
      mentions(haystack, entry),
    );

    if (phrase) {
      subjects.push({ requirement: requirement.label, phrase });
    }
  }

  return { notesProvided: true, subjects };
}

/**
 * Questions a rejection raises that the ordinary review does not.
 *
 * All three are things only the contractor can settle, and each one exists
 * because the alternative is us filling the gap with an assumption:
 *
 *  - what the reviewer actually asked for, as opposed to which subject their
 *    words touched on;
 *  - whether the file they turned down is the file they sent us, since a
 *    review of a different document answers the wrong question entirely;
 *  - whether a resubmission has a date on it.
 */
export function rejectionQuestions(
  reading: RejectionReading | null,
  submission: SubmissionRow,
  readableDocumentCount: number,
): string[] {
  if (!reading) return [];

  const questions: string[] = [];

  if (!reading.notesProvided && readableDocumentCount === 0) {
    questions.push(
      "What exactly did they send back? Paste the reviewer's wording or send the notice — without it we are working from your trade alone, which is not enough to tell you what to fix.",
    );
  } else if (reading.subjects.length === 0) {
    // Notes exist and matched nothing. Saying so is more useful than silence:
    // it tells them the wording did not name a subject we recognise, which is
    // a fact about our reference list rather than about their file.
    questions.push(
      "Which document did they turn down? What you sent us does not name a subject we recognise, so tell us the document and we can look at that one specifically.",
    );
  }

  if (readableDocumentCount === 0) {
    questions.push(
      "Can you send the document they rejected? Reading the version they saw is the only way to tell you what it is missing.",
    );
  }

  questions.push(
    `Has ${submission.hiring_client} given you a date to resubmit by? It changes what is worth doing first.`,
  );

  return questions;
}
