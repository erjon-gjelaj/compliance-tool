import type { SubmissionRow } from "@/lib/submissions";
import {
  isReadable,
  isReliable,
  type ExtractedDocument,
} from "@/lib/analysis/documents";
import {
  CITATIONS_SOURCE_DATE,
  REQUIREMENTS_VERSION,
  anyVerified,
  citationsFor,
  requirementsFor,
  type Requirement,
} from "@/lib/requirements";
import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";

/**
 * Builds the review by reading the documents, with no model involved.
 *
 * The rule this follows is that everything reported must be a fact about a
 * file or about an answer the contractor gave us. "We searched the four
 * documents you sent for the words a lockout/tagout programme is written in,
 * and did not find them" is checkable, reproducible, and true whether or not
 * anyone has researched what ISNetworld asks for. "You need a lockout/tagout
 * programme" is a different kind of claim, and this code is not in a position
 * to make it.
 *
 * So the output is a diff, not a judgement:
 *
 *   present         the words turned up in a document they sent
 *   likely_missing  they sent documents, and the words are in none of them
 *   unknown         we have nothing to go on either way
 *
 * Three consequences worth stating plainly. A match is evidence the subject is
 * covered somewhere, not that the document is adequate — a programme can
 * mention fall protection and still be rejected. A non-match on a file we
 * could not read is not a finding at all, which is why unreadable files are
 * held out of the "we looked and it wasn't there" reasoning entirely and
 * listed by name instead.
 *
 * And the two directions are not symmetric where image recognition is
 * involved. OCR text can show a subject IS covered — the words are on the page
 * — but never that one is absent, because dropping a word is its commonest
 * failure. So OCR can produce `present`, at reduced confidence, and can never
 * produce `likely_missing`. See isReliable.
 */

/** How many documents have text we can actually search. */
function readable(documents: ExtractedDocument[]) {
  return documents.filter(isReadable);
}

function unreadableNames(documents: ExtractedDocument[]) {
  return documents
    .filter((entry) => !isReadable(entry))
    .map((entry) => entry.document.file_name);
}

type Hit = { fileName: string; phrase: string; viaOcr: boolean };

/**
 * Looks for any of a requirement's phrases in the readable documents.
 *
 * Matching is on word boundaries rather than raw substrings, so "loto" does
 * not fire on "photo" and "300a" does not fire inside a part number. It is
 * still a text search and it can be fooled — a manual with a contents page
 * listing sections it never actually contains will match. The output says
 * where the match came from so a person can check it in one click.
 */
function findPhrase(
  requirement: Requirement,
  documents: ExtractedDocument[],
): Hit | null {
  for (const entry of readable(documents)) {
    const haystack = entry.text.toLowerCase();

    for (const phrase of requirement.phrases) {
      const needle = phrase.toLowerCase();
      const at = haystack.indexOf(needle);
      if (at === -1) continue;

      const before = at === 0 ? " " : haystack[at - 1];
      const after = haystack[at + needle.length] ?? " ";
      const isBoundary = (character: string) => !/[a-z0-9]/.test(character);

      if (isBoundary(before) && isBoundary(after)) {
        return {
          fileName: entry.document.file_name,
          phrase,
          viaOcr: entry.status === "ocr",
        };
      }
    }
  }

  return null;
}

function itemFor(
  requirement: Requirement,
  submission: SubmissionRow,
  documents: ExtractedDocument[],
): AnalysisItem {
  const hit = findPhrase(requirement, documents);
  const searched = readable(documents);
  // Everything searched, versus the subset read reliably enough that finding
  // nothing in it is itself a finding. See isReliable.
  const reliable = documents.filter(isReliable);
  const ticked = requirement.checklist
    ? (submission.documents_held ?? []).includes(requirement.checklist)
    : false;

  const base = {
    requirement: requirement.label,
    source: requirement.source,
    // Retrieved from eCFR by scripts/verify-citations.mts, not recalled here.
    // Present on the item whatever its status: the standard on a subject does
    // not depend on whether this contractor's file mentions it.
    citations: citationsFor(requirement.id).map((citation) => ({
      cfr: citation.cfr,
      // Subpart first, because plenty of section headings are useless alone:
      // 1910.132 and 1926.1203 are both published as "General requirements",
      // and only the subpart says one is about protective equipment and the
      // other about confined spaces in construction. Both strings came back
      // from eCFR; joining them is the only editorial act here.
      title: citation.subpart
        ? `${citation.subpart} — ${citation.title}`
        : citation.title,
      verifiedAt: CITATIONS_SOURCE_DATE,
      supportsClaim: true,
      // 1910.147 and 1910.146 both exclude construction outright. A
      // scaffolding or mechanical subcontractor on a plant turnaround may
      // well be doing construction work, and showing them a general industry
      // standard without saying so is close to misleading. Which part applies
      // turns on the activity rather than the trade, so the caveat is stated
      // and the judgement left with them.
      note: citation.excludesConstruction
        ? "This standard states it does not cover construction employment — Part 1926 covers construction."
        : undefined,
    })),
    action: requirement.action,
  };

  if (hit) {
    // Found. OCR text is not proof of anything on its own — a photo read at
    // an angle produces confident nonsense — so a match that came through it
    // is reported one confidence level down.
    return {
      ...base,
      status: "present",
      confidence: hit.viaOcr ? "medium" : "high",
      basis: hit.viaOcr
        ? `"${hit.phrase}" read from ${hit.fileName} by image recognition, which is unreliable — worth confirming yourself`
        : `"${hit.phrase}" appears in ${hit.fileName}`,
    };
  }

  if (ticked) {
    // They say they have it and we could not find it. That is not a
    // contradiction — the document may simply not have been uploaded — but it
    // is worth telling them which of the two it is.
    return {
      ...base,
      status: "present",
      confidence: "low",
      basis:
        searched.length > 0
          ? `you ticked this on the checklist, but we did not find it in the ${searched.length === 1 ? "file" : `${searched.length} files`} you sent`
          : "you ticked this on the checklist; you did not send a file for it",
      action: `${requirement.action} Send it over if you want it checked.`,
    };
  }

  // Both remaining unknowns need there to be nothing to search. Once a file
  // has actually been read, the search outcome is better evidence than
  // anything ticked on the form: "not sure what my file contains" describes
  // what they know, not what the document says. Checking it first made
  // likely_missing unreachable for exactly the person this is built for.
  if (searched.length === 0) {
    return {
      ...base,
      status: "unknown",
      confidence: "low",
      basis: submission.documents_unsure
        ? "you said you were not sure what your file contains"
        : "nothing to check it against — you did not tick it or send a file",
    };
  }

  // Anything read by image recognition disqualifies a "missing" verdict.
  //
  // A match from OCR is already reported a level down, but a NON-match was
  // falling straight through to likely_missing, which is the asymmetry the
  // wrong way round: OCR's usual failure is dropping or mangling a word, so it
  // is much better at showing a subject IS covered than that one is absent.
  // Left alone, a photographed manual whose heading OCR'd badly would tell
  // someone they lack a programme sitting on page 12 of their own document.
  //
  // This holds even when a reliable file was also searched, because the phrase
  // could be in the part we could not read properly.
  if (reliable.length < searched.length) {
    return {
      ...base,
      status: "unknown",
      confidence: "low",
      basis:
        "we could only read some of what you sent by image recognition, which drops words too often for us to tell you this is missing on the strength of it",
      action: `${requirement.action} A file we can read the text of would settle it.`,
    };
  }

  return {
    ...base,
    status: "likely_missing",
    confidence: "medium",
    basis: `not mentioned in the ${reliable.length === 1 ? "file" : `${reliable.length} files`} you sent, and not ticked on your checklist`,
  };
}

/**
 * An indicative band from things that can actually be counted: how many
 * categories came back missing, how many people they run, whether it is one
 * platform or two, and how close the date is.
 *
 * Never a number, and never a promise. It is a rough sense of size so the
 * reply is worth reading, and the email says as much next to it.
 */
function priceBandFor(
  submission: SubmissionRow,
  items: AnalysisItem[],
  documents: ExtractedDocument[],
): Analysis["priceBand"] {
  // Nothing was read, so there is nothing to size. A checklist tick is their
  // word about a document we have not seen, and sizing a job from it would
  // put a band against an assumption — "low" here would read as "this is a
  // small job" when the honest answer is that we have no idea.
  if (readable(documents).length === 0) return "unknown";

  const missing = items.filter((item) => item.status === "likely_missing").length;

  let score = missing;

  if (submission.platform === "Both") score += 2;
  if (submission.headcount_band === "26-50" || submission.headcount_band === "51+") {
    score += 1;
  }

  if (submission.deadline) {
    const days =
      (new Date(submission.deadline).getTime() - Date.now()) / 86_400_000;
    if (Number.isFinite(days) && days < 30) score += 2;
  }

  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function summaryFor(
  submission: SubmissionRow,
  items: AnalysisItem[],
  documents: ExtractedDocument[],
): string {
  const searched = readable(documents);

  // The hiring-client item is left out of the denominator: it is permanently
  // unknown by design, so counting it would quietly drag every ratio down and
  // invite the reader to think a category had been overlooked.
  const checkable = items.filter((item) => item.source !== "hiring_client");
  const present = checkable.filter((item) => item.status === "present").length;
  const missing = checkable.filter(
    (item) => item.status === "likely_missing",
  ).length;

  const opening =
    searched.length === 0
      ? "You did not send any documents we could read, so this is based only on what you told us on the form."
      : `We read ${searched.length === 1 ? "the file" : `all ${searched.length} files`} you sent and searched ${searched.length === 1 ? "it" : "them"} for each of the document types below.`;

  const found =
    present > 0
      ? ` ${present} of ${checkable.length} look covered somewhere in what you sent or told us.`
      : "";

  const gap =
    missing > 0
      ? ` ${missing} ${missing === 1 ? "was" : "were"} not mentioned anywhere we looked.`
      : "";

  return `${opening}${found}${gap} This is a text search, not a judgement about whether a document is good enough — a programme can mention a subject and still come back for revision.`;
}

function questionsFor(
  submission: SubmissionRow,
  items: AnalysisItem[],
  documents: ExtractedDocument[],
): string[] {
  const questions: string[] = [];

  // The single most important thing we do not know, asked first.
  questions.push(
    `What has ${submission.hiring_client} actually asked you for? Their own list is set in their portal and we cannot see it — it is the one thing that decides your file.`,
  );

  if (!anyVerified()) {
    // Said out loud rather than buried. The reference list is where our
    // understanding of the platforms lives, and it has not been researched
    // yet, so the honest framing is "these are the usual categories" and not
    // "these are your requirements".
    questions.push(
      // Deliberately not "the categories above": when nothing was readable the
      // email leads with these questions and the categories follow, so any
      // wording that names a position is wrong half the time.
      "Does your client's list match the categories we've listed? Ours is the set we see most often, not a verified copy of anyone's requirements.",
    );
  }

  if (submission.documents_unsure) {
    questions.push(
      "Who put your current file together, and can you get the documents from them? Almost nothing can be checked until we can see what exists.",
    );
  }

  const unknowns = items.filter((item) => item.status === "unknown");
  if (unknowns.length > 0 && readable(documents).length === 0) {
    questions.push(
      "Can you send the documents you do have? Reading them is the difference between a list of questions and a real answer.",
    );
  }

  if (submission.deadline_unknown) {
    questions.push(
      "Has anyone given you a date? It changes the order worth working in.",
    );
  }

  return questions;
}

/**
 * The whole review, assembled from what the documents say.
 */
export function buildAnalysis({
  submission,
  documents,
}: {
  submission: SubmissionRow;
  documents: ExtractedDocument[];
}): Analysis {
  const requirements = requirementsFor({
    trade: submission.trade,
    platform: submission.platform,
  });

  const items = requirements.map((requirement) =>
    itemFor(requirement, submission, documents),
  );

  // What their specific hiring client requires is not in this file and never
  // will be — it lives in a portal we cannot see. It is reported as unknown,
  // every time, rather than quietly omitted, because its absence is the most
  // important limitation of the whole review.
  items.push({
    requirement: `Whatever ${submission.hiring_client} specifically requires`,
    source: "hiring_client",
    status: "unknown",
    confidence: "low",
    basis: "we cannot see your client's portal or their requirement list",
    action: "Ask them for their requirement list, or export it from the platform.",
    citations: [],
  });

  return {
    summary: summaryFor(submission, items, documents),
    items,
    questionsForClient: questionsFor(submission, items, documents),
    priceBand: priceBandFor(submission, items, documents),
    unreadableFiles: unreadableNames(documents),
    referenceVersion: REQUIREMENTS_VERSION,
  };
}
