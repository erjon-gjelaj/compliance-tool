import "server-only";

import type { FileRequirement } from "@/lib/domain-dashboard";
import type { LibraryDocument } from "@/lib/dashboard";
import type { DocumentWithVersions } from "@/lib/programs/store";
import { PROGRAM_CATALOG, programConfigByKey } from "@/lib/config";
import { offerablePrograms } from "@/lib/programs/registry";
import { reminderState, todayIso, type MaintenanceRow } from "@/lib/maintenance";

/**
 * One list of everything a contractor's file needs, and where each item stands.
 *
 * ## Why this exists
 *
 * The same piece of paperwork used to be spread over four screens. A hazard
 * communication program was a row in Approval projects, a card in Generate
 * documents, a file in Documents, and a date in Maintenance — four places, four
 * vocabularies, and no single screen that answered the only question the
 * customer actually has: *what is left to do?*
 *
 * That is a reasonable way to model the domain and a bad way to show it to a
 * person who runs a scaffolding crew. They do not think in requirement sets and
 * generators. They think in a list of paperwork the plant is waiting on, and
 * each line is either sorted or it is not.
 *
 * So this collapses all four sources into one row per document, with exactly
 * one status and exactly one thing to do next. Every screen in the product now
 * renders from this, which is also why they cannot disagree with one another.
 *
 * ## The statuses are the customer's, not the schema's
 *
 * The database has seven (`missing`, `draft`, `submitted`, `under_review`,
 * `accepted`, `rejected`, `expired`) and they describe our workflow. A
 * contractor cares about four things, and the difference between `submitted`
 * and `under_review` is not one of them — both mean "sent, nothing for me to
 * do". Collapsing them is not hiding detail; it is refusing to make somebody
 * learn our state machine to find out whether they can go back to work.
 */

export type PaperworkState =
  /** They have it. Nothing to do. */
  | "ready"
  /** Missing, and we can write it here and now. */
  | "we_can_write_it"
  /** Missing, and only they can supply it — a certificate, a training record. */
  | "you_provide_it"
  /**
   * A written program we have not automated yet.
   *
   * Kept apart from `you_provide_it` because the two are not the same claim
   * and the difference matters to the person reading it. A certificate of
   * insurance is something we could never produce — it comes from their
   * broker. A ladder safety program is something this product exists to
   * write and simply does not write yet. Telling somebody "we have no way of
   * knowing this one" about the second is untrue, and it is untrue in the
   * direction that makes us look less capable than we are.
   */
  | "not_automated"
  /** Held, but a date has passed or is close. */
  | "needs_attention"
  /** We do not know whether this client asks for it. Their call, not ours. */
  | "ask_your_client";

export type PaperworkItem = {
  /** Stable across renders: the requirement key, or the program id. */
  key: string;
  title: string;
  state: PaperworkState;
  /** One line under the title. Never more — a list is for scanning. */
  detail: string;
  /** The single thing to do. */
  action: { label: string; href: string } | null;
  /** Set when this is a program we can generate. */
  programId?: string;
  /** Set when a finished document exists. */
  documentId?: string;
  /** A date that matters, already formatted for reading. */
  due?: string;
};

/** How the list is broken up. Order is the order somebody should work in. */
export const GROUPS = [
  {
    id: "we_can_write_it",
    heading: "We can write these for you",
    blurb: "A few questions each, then a finished Word and PDF in your name.",
  },
  {
    id: "not_automated",
    heading: "Written programs we do not generate yet",
    blurb:
      "Send yours if you already have one, or ask us and a person will prepare it.",
  },
  {
    id: "you_provide_it",
    heading: "Only you can send these",
    blurb:
      "Certificates, records and figures that come from your broker, your insurer or your own files. We could never produce these for you.",
  },
  {
    id: "needs_attention",
    heading: "Needs attention",
    blurb: "You have these, but something about them has come due.",
  },
  {
    id: "ready",
    heading: "Sorted",
    blurb: "Nothing to do on these.",
  },
  {
    id: "ask_your_client",
    heading: "Worth checking with your client",
    blurb:
      "We cannot see inside their portal, so we are not going to guess whether these apply to you.",
  },
] as const;

/**
 * Which generator, if any, answers a requirement.
 *
 * The requirement set keys programs as `program.<config key>`, and the
 * generator registry keys them by its own id — `hazcom` against
 * `hazard_communication`. `legacy_ids` in the config is the bridge, and going
 * through it rather than string-matching titles is what stops a rename
 * silently detaching a generator from the requirement it satisfies.
 */
export function programForRequirementKey(key: string): string | undefined {
  if (!key.startsWith("program.")) return undefined;

  const config = programConfigByKey(key.slice("program.".length));
  if (!config) return undefined;

  return offerablePrograms().find(
    (program) =>
      program.id === config.program_key || config.legacy_ids.includes(program.id),
  )?.id;
}

/** Requirement statuses that mean the contractor has nothing left to do. */
const SETTLED = new Set(["submitted", "under_review", "accepted"]);

function readable(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Builds the list.
 *
 * Deliberately pure and synchronous. Every caller has already fetched what it
 * needs for its own page, and a second round of queries in here would mean the
 * home screen and the paperwork screen could disagree about the same document
 * depending on which one loaded first.
 */
export function buildPaperwork({
  requirements,
  generated,
  uploaded,
  reminders,
  today = todayIso(),
}: {
  requirements: FileRequirement[];
  generated: DocumentWithVersions[];
  uploaded: LibraryDocument[];
  reminders: MaintenanceRow[];
  today?: string;
}): PaperworkItem[] {
  const items: PaperworkItem[] = [];
  const heldPrograms = new Map(generated.map((doc) => [doc.program_id, doc]));
  const claimed = new Set<string>();

  /*
   * The requirement set first, because it is the only source that knows what
   * this contractor's client actually asks for. Everything else is evidence
   * against it.
   */
  for (const requirement of requirements) {
    const programId = programForRequirementKey(requirement.requirement_key);
    const held = programId ? heldPrograms.get(programId) : undefined;
    if (programId) claimed.add(programId);

    const reminder = reminders.find(
      (entry) => entry.document_name === requirement.title,
    );
    /*
     * "later" is not news. A review due in eight months on a document they
     * already hold is a fact, not a task, and surfacing it here would put half
     * the list under a warning heading — which is how a list of warnings stops
     * being read at all.
     */
    const pressing =
      reminder && reminderState(reminder.due_date, today) !== "later"
        ? reminder
        : undefined;

    if (held) {
      items.push({
        key: requirement.requirement_key,
        title: requirement.title,
        state: pressing ? "needs_attention" : "ready",
        detail: pressing
          ? `${pressing.kind === "expiry" ? "Expires" : "Due for review"} ${readable(pressing.due_date)}.`
          : `Version ${held.current?.version ?? 1}, ready to download.`,
        action: { label: "Open", href: `/dashboard/documents/${held.id}` },
        programId,
        documentId: held.id,
        due: pressing ? readable(pressing.due_date) : undefined,
      });
      continue;
    }

    if (requirement.applicability === "unknown") {
      items.push({
        key: requirement.requirement_key,
        title: requirement.title,
        state: "ask_your_client",
        detail: "We are not sure this one applies to you. Your client will know.",
        action: null,
      });
      continue;
    }

    if (SETTLED.has(requirement.status)) {
      items.push({
        key: requirement.requirement_key,
        title: requirement.title,
        state: "ready",
        detail: "Sent. Nothing for you to do.",
        action: null,
      });
      continue;
    }

    if (programId) {
      items.push({
        key: requirement.requirement_key,
        title: requirement.title,
        state: "we_can_write_it",
        detail: "About two minutes of questions, then it is written for you.",
        action: {
          label: "Create it",
          href: `/dashboard/programs/${programId}`,
        },
        programId,
      });
      continue;
    }

    /*
     * A written program we have not automated, versus a record only they can
     * hold. The requirement key is what separates them, and getting this
     * wrong in either direction misleads: claiming we cannot know their
     * ladder safety program, or implying we could produce their certificate
     * of insurance.
     */
    if (requirement.requirement_key.startsWith("program.")) {
      items.push({
        key: requirement.requirement_key,
        title: requirement.title,
        state: "not_automated",
        detail:
          "We do not write this one automatically yet. Send yours, or ask and we will prepare it.",
        action: { label: "Ask us", href: "/dashboard/help" },
      });
      continue;
    }

    items.push({
      key: requirement.requirement_key,
      title: requirement.title,
      state: "you_provide_it",
      detail: "This one comes from your own records — send it and we will file it.",
      action: { label: "Upload", href: "/dashboard/documents#upload" },
    });
  }

  /*
   * Programs they hold that no requirement asked for.
   *
   * Somebody who generated a document before a requirement set existed still
   * owns it, and a list that quietly omitted it would look like we had lost
   * their file.
   */
  for (const doc of generated) {
    if (claimed.has(doc.program_id)) continue;

    const template = offerablePrograms().find(
      (program) => program.id === doc.program_id,
    );

    items.push({
      key: `held.${doc.program_id}`,
      title: template?.title ?? doc.program_id.replace(/_/g, " "),
      state: "ready",
      detail: `Version ${doc.current?.version ?? 1}, ready to download.`,
      action: { label: "Open", href: `/dashboard/documents/${doc.id}` },
      programId: doc.program_id,
      documentId: doc.id,
    });
  }

  /*
   * A file we could not read is the one upload problem worth raising here,
   * and it is deliberately ordered ahead of everything else.
   *
   * Not because replacing a file is urgent in itself, but because an
   * unreadable upload makes the rest of the list wrong: whatever is in it
   * counted for nothing, so somebody could spend an afternoon writing a
   * program that was sitting in that scan all along. The copy has to say
   * that, or it reads as busywork ahead of the things they actually came to
   * do.
   */
  for (const file of uploaded) {
    if (file.readable) continue;

    items.push({
      key: `unreadable.${file.id}`,
      title: file.file_name,
      state: "needs_attention",
      detail:
        "Nothing in this file counted towards your list — it is usually a scan with no text layer. Send a copy you can select text in and we will check it again for free, in case it covers something below.",
      action: { label: "Send a readable copy", href: "/dashboard/documents#upload" },
    });
  }

  return items;
}

/**
 * The one thing worth doing next.
 *
 * A screen that lists everything asks somebody to choose; a screen that names
 * one thing asks them to start. The order is what actually unblocks an
 * approval: fix what is broken, then take the things we can do for them, then
 * the things only they can send.
 */
export function nextAction(items: PaperworkItem[]): PaperworkItem | null {
  const order: PaperworkState[] = [
    "needs_attention",
    "we_can_write_it",
    "you_provide_it",
    "not_automated",
  ];

  for (const state of order) {
    const found = items.find((item) => item.state === state && item.action);
    if (found) return found;
  }

  return null;
}

/** How far along they are, counting only what they can actually act on. */
export function progress(items: PaperworkItem[]): {
  ready: number;
  total: number;
} {
  const actionable = items.filter((item) => item.state !== "ask_your_client");

  return {
    ready: actionable.filter((item) => item.state === "ready").length,
    total: actionable.length,
  };
}

/** Everything we could write for somebody, whether or not it was asked for. */
export function allGenerators() {
  return offerablePrograms().map((program) => ({
    id: program.id,
    title: program.title,
  }));
}

/** How many of the catalogue's programs exist as generators. For honest copy. */
export const CATALOGUE_SIZE = PROGRAM_CATALOG.length;
