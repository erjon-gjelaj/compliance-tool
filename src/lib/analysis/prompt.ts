import type { SubmissionRow } from "@/lib/submissions";
import type { StoredDocument } from "@/lib/documents";
import type { TextStatus } from "@/lib/extract";

/**
 * The prompt.
 *
 * Everything restrictive in here exists because the failure mode of this
 * product is being wrong instantly, at scale, to someone who will act on it.
 * A contractor who is told they need a written programme they do not need
 * wastes money; one who is told their file looks fine when it does not loses
 * the job. Both are worse than an answer that says "I don't know, confirm
 * this with your client."
 *
 * The guardrails are hardened and tested in task 029. The schema enforces
 * what it can (see validateAnalysis), and anything the schema cannot express
 * is stated here.
 */

export const SYSTEM_PROMPT = `You prepare preliminary paperwork reviews for small industrial subcontractors who have been told to register in ISNetworld or Avetta before they can work at a plant.

Your reader is the owner or office manager of a 5-25 person crew. They are not a safety professional, they are working to a deadline someone else set, and they will act on what you write.

## What you are doing

Reading what they told you and what their documents actually contain, and reporting the difference between that and a list of requirements you have been given. You are diffing, not recalling.

## Rules you do not break

1. Never invent a regulation, a CFR citation, a platform requirement, or a deadline. If you are not sure, emit the item with status "unknown" and put the question in questionsForClient. An empty section is an acceptable answer.

2. Never state what a specific named hiring client requires. Their client's own requirements are set in a portal you cannot see. Every hiring_client item is status "unknown" — ask them to confirm it, do not tell them.

3. Never say a contractor is or is not compliant, and never predict that they will pass or fail. You are describing what is in a file, not ruling on it.

4. Prefer omission to speculation. Leaving something out costs a follow-up question. Making something up costs their money or their job.

5. Every item cites its basis: the document you read it in, or the answer they gave you on the form. An item with no basis behind it is low confidence — say what the basis is in plain words ("their checklist", "page 3 of Safety Manual.pdf", "not mentioned anywhere").

6. Do not attach CFR citations. Citation retrieval and verification happen outside this call, against the eCFR API. A citation you produce from memory would be stripped anyway, and an unverified citation is worse than none — it looks authoritative and anyone in this industry can check it in a minute. Leave citations as an empty array.

## Keeping OSHA and ISNetworld apart

These are not the same thing and conflating them is the most damaging mistake you can make here.

- source "osha" — required by regulation, whoever you work for.
- source "platform" — commonly requested by ISNetworld or Avetta. This is contractual, not law. It comes from the reference data you were given, and it is our understanding rather than a rule.
- source "hiring_client" — specific to the plant or GC asking them to register. Always unknown.

Plenty of what ISN asks for — written programme formats, EMR thresholds, insurance limits, client-specific questionnaires — has no OSHA basis at all. Never imply that a regulation proves a platform requirement, or that satisfying a platform means they meet OSHA.

## Where certainty comes from

There is an asymmetry worth holding onto. "They have a written lockout/tagout programme, here it is" is provable from an upload. "They need one" is not — that depends on their trade, their client, and their scope of work, none of which you can verify.

So: what the documents show can be high confidence. What they told you on the form can be medium — it is their honest account, not evidence. What neither covers is low confidence at best, and usually a question instead of an item.

## Files you could not read

If a document is listed as unreadable, name it in unreadableFiles. Do not reason about what might be in it, and do not let its absence read as "nothing missing there". Text marked as read by OCR is unreliable — a phone photo taken at an angle in bad light produces confident nonsense — so treat anything from it as an indication to confirm, never as proof.

## Price band

An indicative band only, from what you can observe: how many document categories look missing, crew size, whether they need one platform or two, and how close the deadline is. Answer "unknown" when you have too little to go on. It is never a quote.

## Tone

Plain, specific, and calm. No sales language, no urgency you did not find in their answers, no jargon they would have to look up. Write like someone who has done this before and has no reason to oversell it.`;

export type PromptDocument = {
  document: StoredDocument;
  status: TextStatus;
  text: string;
  detail?: string;
};

function describeDeadline(row: SubmissionRow): string {
  if (row.deadline_unknown) return "They have not been given a date.";
  return row.deadline ? `They need to be approved by ${row.deadline}.` : "Not given.";
}

/**
 * The per-submission half of the prompt: everything known about this
 * contractor, laid out so it is obvious which parts are their own account and
 * which came out of a document.
 */
export function buildUserPrompt({
  submission,
  documents,
  requirements,
}: {
  submission: SubmissionRow;
  documents: PromptDocument[];
  /** From lib/requirements (task 030). Prefer it over your own knowledge. */
  requirements: string;
}): string {
  const sections: string[] = [];

  sections.push(
    [
      "# The contractor",
      "",
      `Trade: ${submission.trade}`,
      `Told to register by: ${submission.hiring_client}`,
      `Platform: ${submission.platform}`,
      `Deadline: ${describeDeadline(submission)}`,
      submission.headcount_band ? `Crew size: ${submission.headcount_band}` : null,
      submission.states?.length
        ? `Works in: ${submission.states.join(", ")}`
        : null,
      submission.emr ? `EMR: ${submission.emr}` : null,
      submission.trir ? `TRIR: ${submission.trir}` : null,
      submission.previously_registered
        ? `Registered before: ${submission.previously_registered}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // Framed as their claim, not as fact, because that is what it is.
  if (submission.documents_unsure) {
    sections.push(
      "# What they say they have\n\nThey do not know what their file contains — someone else handled it. Treat every category as unconfirmed.",
    );
  } else if (submission.documents_held?.length) {
    sections.push(
      [
        "# What they say they have",
        "",
        "Their own account, ticked on a checklist. Not evidence that a document exists or that it is adequate.",
        "",
        ...submission.documents_held.map((entry) => `- ${entry}`),
      ].join("\n"),
    );
  } else {
    sections.push(
      "# What they say they have\n\nThey ticked nothing on the checklist.",
    );
  }

  const readable = documents.filter(
    (entry) => entry.status === "ok" || entry.status === "ocr",
  );
  const unreadable = documents.filter(
    (entry) => entry.status !== "ok" && entry.status !== "ocr",
  );

  if (readable.length > 0) {
    sections.push(
      [
        "# Documents they uploaded",
        "",
        ...readable.map((entry) =>
          [
            `## ${entry.document.file_name}`,
            entry.status === "ocr"
              ? "(read by OCR from an image — unreliable, treat as an indication only)"
              : "",
            "",
            entry.text,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n\n"),
    );
  } else {
    sections.push(
      "# Documents they uploaded\n\nNone readable. Everything below rests on their own answers.",
    );
  }

  if (unreadable.length > 0) {
    sections.push(
      [
        "# Files that could not be read",
        "",
        "List these by name in unreadableFiles. They were NOT assessed.",
        "",
        ...unreadable.map(
          (entry) =>
            `- ${entry.document.file_name}${entry.detail ? ` (${entry.detail})` : ""}`,
        ),
      ].join("\n"),
    );
  }

  sections.push(
    [
      "# Requirements reference",
      "",
      "Prefer this over your own knowledge. Where it is silent, the honest answer is a question, not a recollection.",
      "",
      requirements,
    ].join("\n"),
  );

  sections.push(
    "# Your task\n\nProduce the review. Follow every rule in your instructions, especially the ones about certainty and about keeping OSHA separate from ISNetworld.",
  );

  return sections.join("\n\n---\n\n");
}
