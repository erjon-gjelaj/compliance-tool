import type { Answers, Block, Section } from "@/lib/programs/types";

/**
 * The parts every written safety program has, so a program module only has to
 * write the part that is actually about its subject.
 *
 * ## What is shared and what is not
 *
 * Open any real safety program and the first two sections and the last three
 * are close to interchangeable: what this document is for, who it applies to,
 * who looks after it, what employees are told, where it is kept, and when it
 * is reviewed. That is not laziness in the industry — those sections exist
 * because a reviewer looks for them, and there are only so many ways to say
 * "this applies to every employee of the Company".
 *
 * What is not shared is the middle: the hazards, the controls, the sequence
 * somebody follows on a bad day. Writing fifty-six variants of "Availability
 * of This Program" adds nothing and guarantees they drift; writing fifty-six
 * genuinely different hazard sections is the actual work.
 *
 * So this owns the frame and each program owns its subject.
 *
 * ## The original four are deliberately not retrofitted
 *
 * Hazard Communication, PPE, the Emergency Action Plan and Incident Reporting
 * predate this module and are left alone. They are released, customers hold
 * versions of them, and re-assembling released prose to share a helper would
 * change the bytes of documents somebody has already submitted to a hiring
 * client — for no benefit to them. A shared frame is worth having; it is not
 * worth reissuing somebody's paperwork over.
 *
 * ## What the spine will not do
 *
 * It writes no hazard content and states no requirement. Nothing here knows
 * anything about any regulation, and a program that supplied nothing but a
 * title would come out as a frame with no substance rather than as a
 * plausible-looking document — which is the right failure.
 */

/** Roles a company can name, in the customer's words rather than a job title. */
export const RESPONSIBLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
  foreman: "Foreman",
};

/** The four every program asks, phrased the same way every time. */
export const RESPONSIBLE_OPTIONS = [
  { id: "owner", label: "The owner" },
  { id: "safety_manager", label: "A safety manager" },
  { id: "supervisor", label: "A site supervisor" },
  { id: "operations_manager", label: "An operations manager" },
] as const;

export function responsibleRole(answers: Answers, key = "responsible_role"): string {
  const chosen = answers[key];
  return RESPONSIBLE_LABELS[chosen] ?? chosen;
}

/**
 * Where somebody goes when the person they report to is the problem.
 *
 * A commitment that routes back to the person it protects against says
 * nothing. Where the responsible role IS the owner, the escalation has to go
 * somewhere else, so the sentence names the owner once rather than twice.
 */
export function escalation(role: string): string {
  return role === "Owner"
    ? "with the Owner directly"
    : `with the ${role}, or with the Owner directly where the ${role} is the person concerned`;
}

export type SpineSpec = {
  company: string;
  /** Already resolved to a label — "Safety Manager", not "safety_manager". */
  role: string;
  /** Sentence completing "This program sets out …". No leading capital. */
  purpose: string;
  /** The commitment the company is making. One or two sentences. */
  policy: string;
  /**
   * An extra scope sentence where the program covers less, or more, than
   * everybody. Most programs need none.
   */
  scopeNote?: string;
  /** The sections that are actually about the subject. */
  body: Section[];
  /**
   * What an employee has to take away, as a short list. Kept concrete: a
   * training section that says "employees are trained on this program" tells
   * a reviewer nothing and tells an employee less.
   */
  trainingPoints: string[];
  /** Anything supervisors are additionally taken through. */
  supervisorTraining?: string;
  /** Extra events that trigger a review, beyond the standard three. */
  reviewTrigger?: string;
};

function paragraph(text: string): Block {
  return { type: "paragraph", text };
}

/**
 * Assembles a complete program from its subject-specific parts.
 *
 * The frame is fixed and the order is fixed, because a reviewer reads dozens
 * of these and a document that puts its scope after its procedures costs them
 * time for no reason.
 */
export function assembleWithSpine(spec: SpineSpec): Section[] {
  const { company, role } = spec;

  const opening: Section[] = [
    {
      heading: "Purpose and Policy",
      blocks: [
        paragraph(`This program sets out ${spec.purpose}`),
        paragraph(spec.policy),
        paragraph(
          `No employee of ${company} is disciplined or treated any differently for raising a concern under this program, for stopping work over one, or for raising something that turns out to be nothing. An employee who is discouraged from doing so raises it ${escalation(role)}.`,
        ),
      ],
    },
    {
      heading: "Scope",
      blocks: [
        paragraph(
          `This program applies to every employee of ${company}, at every location where the Company performs work, and to anybody working under the Company's direction.`,
        ),
        ...(spec.scopeNote ? [paragraph(spec.scopeNote)] : []),
        paragraph(
          `Much of the work of ${company} is carried out at locations the Company does not control. Where a host employer's requirements on this subject are stricter than what follows, the host's requirements apply, and the supervisor for that job establishes what they are before work begins.`,
        ),
      ],
    },
    {
      heading: "Who Looks After This Program",
      blocks: [
        paragraph(
          `The ${role} is responsible for this program, for keeping it current, and for answering questions about it. Any employee who wants more information about it, or an explanation of what it asks of them, asks the ${role}.`,
        ),
      ],
    },
  ];

  const closing: Section[] = [
    {
      heading: "Instruction in This Program",
      blocks: [
        paragraph(
          `${company} goes through this program with an employee before they are first assigned work it covers, when their duties under it change, and when the program itself changes.`,
        ),
        paragraph("What an employee is expected to take from it:"),
        { type: "bullets", items: spec.trainingPoints },
        ...(spec.supervisorTraining ? [paragraph(spec.supervisorTraining)] : []),
        paragraph(
          `The ${role} records who was taken through this program, and on what date.`,
        ),
      ],
    },
    {
      heading: "Availability of This Program",
      blocks: [
        paragraph(
          "This program is kept in writing and is available to any employee, or their designated representative, on request. A copy travels with each crew to the site they are working on.",
        ),
      ],
    },
    {
      heading: "Review and Revision",
      blocks: [
        paragraph(
          `The ${role} reviews this program at least annually, whenever the work of ${company} changes in a way that affects it, and after any incident or near miss that showed something in it did not work.${spec.reviewTrigger ? ` ${spec.reviewTrigger}` : ""}`,
        ),
        paragraph(
          "The revision date and version number on the cover of this document record when it was last reviewed.",
        ),
      ],
    },
  ];

  return [...opening, ...spec.body, ...closing];
}

/**
 * The responsible-role question, which every program asks identically.
 *
 * Shared so the wording cannot drift between programs — a customer preparing
 * their fourth document should not be asked the same thing four different
 * ways.
 */
export const RESPONSIBLE_QUESTION = {
  id: "responsible_role",
  prompt: "Who looks after this program day to day?",
  help: "A role rather than a name, so it stays right when people change.",
  kind: "choice" as const,
  required: true,
  options: [...RESPONSIBLE_OPTIONS],
};
