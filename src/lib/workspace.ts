import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";
import type { DashboardSubmission, LibraryDocument } from "@/lib/dashboard";
import { entryPointFor } from "@/lib/entry-points";

/**
 * What the dashboard is for.
 *
 * It used to be a list of past submissions, which answers a question nobody
 * arrives with. The person opening this has one of two things in mind — what
 * do I do next, and what is holding me up — and everything here exists to
 * answer those from data we already hold.
 *
 * Two rules shape the whole module.
 *
 * Nothing is invented to fill a section. There is no expiry tracking here, for
 * instance, because nothing in this product knows when a certificate expires:
 * we have never been told a renewal date and we do not read one out of a
 * document. An "Expiring soon" panel with nothing behind it would be worse
 * than no panel, because an empty one reads as "nothing is expiring".
 *
 * And the next action is derived, never guessed. Every branch below points at
 * a specific row in a specific state, so the instruction on screen can be
 * checked against the thing that produced it.
 */

export type NextAction = {
  /** The instruction, in the second person and specific enough to act on. */
  title: string;
  /** Why this is the thing to do, one sentence. */
  detail: string;
  href: string;
  cta: string;
};

export type Workspace = {
  next: NextAction;
  /** Findings worth acting on, newest review first. Never speculative. */
  blockers: AnalysisItem[];
  /** Things only the contractor can settle. */
  questions: string[];
  /** Files we could not open, named. Silence must not imply "reviewed". */
  unreadable: string[];
  documents: LibraryDocument[];
  submissions: DashboardSubmission[];
  /** The submission the blockers and questions came from, if any. */
  activeSubmission: DashboardSubmission | null;
  platforms: string[];
  /** Soonest deadline given to us, if any was. */
  nextDeadline: { date: string; hiringClient: string } | null;
};

/** A submission that was started and never finished. */
function unfinished(submissions: DashboardSubmission[]) {
  return submissions.find((row) => row.status === "partial") ?? null;
}

/**
 * Decides the single thing worth doing next.
 *
 * Ordered by what is actually blocking them rather than by what is easiest to
 * render. An unfinished form comes first because it costs them their review
 * entirely; a rejection with nothing attached comes next because a client is
 * already waiting on it; and only then the ordinary "read your review".
 */
function decideNext(
  submissions: DashboardSubmission[],
  active: DashboardSubmission | null,
  review: Analysis | null,
  blockers: AnalysisItem[],
): NextAction {
  if (submissions.length === 0) {
    return {
      title: "Tell us what you're up against",
      detail:
        "Nothing has been sent from this address yet. The four starting points on the home page each take a couple of minutes.",
      href: "/",
      cta: "Start",
    };
  }

  const partial = unfinished(submissions);
  if (partial) {
    return {
      title: "Finish the form you started",
      detail: `You stopped at step ${partial.last_step} of 4 on the ${partial.platform} request for ${partial.hiring_client}. Finishing it is what produces the review.`,
      href: `/dashboard/${partial.id}`,
      cta: "Pick it up",
    };
  }

  // A rejection where we have neither the wording nor a file is the one case
  // where we genuinely cannot help until they send something.
  const blindRejection = submissions.find(
    (row) =>
      row.entry_reason === "rejection" &&
      !row.rejection_notes &&
      row.documentCount === 0,
  );

  if (blindRejection) {
    return {
      title: "Send us what came back",
      detail:
        "We have a rejection from you but not the reviewer's wording or the document they turned down, and we can't say much without one of them.",
      href: `/dashboard/${blindRejection.id}`,
      cta: "Add it",
    };
  }

  if (active && blockers.length > 0) {
    const first = blockers[0];
    return {
      title: `Sort out your ${first.requirement.toLowerCase()}`,
      detail: `It's the first of ${blockers.length === 1 ? "one item" : `${blockers.length} items`} your last review couldn't find in what you sent.`,
      href: `/dashboard/${active.id}`,
      cta: "Read the review",
    };
  }

  if (active && review) {
    return {
      title: "Confirm the open questions with your client",
      detail:
        "Nothing in your file came back missing. What's left is the part only your hiring client can answer.",
      href: `/dashboard/${active.id}`,
      cta: "Read the review",
    };
  }

  if (active?.analysis_status === "pending") {
    return {
      title: "Your review is being produced",
      detail:
        "It usually takes under a minute, and it arrives by email either way.",
      href: `/dashboard/${active.id}`,
      cta: "Open it",
    };
  }

  return {
    title: "Send the documents you have",
    detail:
      "We haven't been able to read anything of yours yet, and reading a real document is the difference between a list of questions and an answer about your file.",
    href: active ? `/dashboard/${active.id}` : "/",
    cta: "Open your request",
  };
}

/**
 * Assembles the workspace from rows already fetched.
 *
 * Deliberately takes data rather than fetching it: every query in
 * lib/dashboard filters on the caller's address inside the query, and keeping
 * this function pure means there is no path here that could read a row
 * without one.
 */
export function buildWorkspace({
  submissions,
  documents,
  activeReview,
  activeSubmission,
}: {
  submissions: DashboardSubmission[];
  documents: LibraryDocument[];
  activeReview: Analysis | null;
  activeSubmission: DashboardSubmission | null;
}): Workspace {
  /*
   * Only likely_missing counts as a blocker.
   *
   * "unknown" is deliberately excluded even though it looks like a gap. An
   * unknown means we had nothing to go on — no file, or a file we could not
   * read — and promoting it to a blocker would tell someone a document is
   * missing when what we actually established is that we did not look at one.
   * Those belong in the questions, which is where they go.
   */
  const blockers =
    activeReview?.items.filter((item) => item.status === "likely_missing") ?? [];

  const platforms = [...new Set(submissions.map((row) => row.platform))];

  const dated = submissions
    .filter((row) => row.deadline)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));

  return {
    next: decideNext(submissions, activeSubmission, activeReview, blockers),
    blockers,
    questions: activeReview?.questionsForClient ?? [],
    unreadable: activeReview?.unreadableFiles ?? [],
    documents,
    submissions,
    activeSubmission,
    platforms,
    nextDeadline: dated[0]
      ? { date: dated[0].deadline!, hiringClient: dated[0].hiring_client }
      : null,
  };
}

/** The door a submission came through, in the customer's words. */
export function submissionHeadline(row: DashboardSubmission): string {
  switch (row.entry_reason) {
    case "rejection":
      return "Rejected document";
    case "setup":
      return "New registration";
    case "documents":
      return "Written programs";
    default:
      return entryPointFor("gap_check").action;
  }
}
