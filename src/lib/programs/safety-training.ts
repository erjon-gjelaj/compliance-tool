import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Safety Training.
 *
 * ## The distinction this document has to hold
 *
 * A training program describes how the Company trains. It does not, and must
 * not, assert that anybody has been trained — that is a fact about particular
 * people on particular dates, and it lives in the records, not in a program.
 * A generated document claiming a crew is competent would be the single most
 * damaging sentence this product could produce.
 *
 * So every statement here is about the system: who decides what training a
 * job needs, when it happens, what is recorded, and what stops somebody
 * working without it. The word "trained" appears about the Company's
 * obligations and never about its people.
 *
 * ## What it is built around
 *
 * The gate. Reviewers ask for a training program because they want to know
 * what stops an untrained person being put on a task — and most programs
 * answer with a list of course titles instead. The load-bearing sections here
 * are the gate before first assignment, the record that proves it, and what
 * happens when a client's site requires something the Company's own list does
 * not.
 */

const Q = {
  responsible: "responsible_role",
  gate: "before_work",
  who: "who_decides",
  refresher: "refresher",
  records: "records_location",
  clientSpecific: "client_specific",
  competency: "competency_check",
} as const;

const GATE_SENTENCE: Record<string, string> = {
  before_assignment:
    "No employee is assigned to a task until the training that task requires is complete and recorded. The check happens before the assignment, not on the way to site.",
  before_site:
    "No employee goes to a client site until the training that site and their tasks require is complete and recorded, including the client's own orientation where they run one.",
  induction_then_task:
    "Every new employee goes through the Company's induction before any work, and task-specific training before being assigned to that task. Neither is treated as covering the other.",
};

const COMPETENCY_SENTENCE: Record<string, string> = {
  observation:
    "Training is not counted as complete until a supervisor has watched the person do the task and is satisfied they can do it unsupervised. Attendance on its own is not competence, and a signature on a sign-in sheet records only that somebody was in the room.",
  written:
    "Training is not counted as complete until the person has demonstrated what they learned, in writing or by explaining it back. Attendance on its own is not competence.",
  supervised_period:
    "After training, the person works under direct supervision on that task until the supervisor is satisfied they can do it alone. Attendance on its own is not competence.",
};

export const SAFETY_TRAINING: ProgramTemplate = {
  id: "safety_training",
  title: "Safety Training",
  shortName: "Safety Training",
  requirementId: "safety-training-program",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(written )?safety training( ?& ?orientation| program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.who,
      prompt: "Who decides what training a job needs?",
      kind: "choice",
      required: true,
      options: [
        { id: "responsible", label: "The person who looks after safety" },
        { id: "supervisor", label: "The supervisor for that job" },
        { id: "client_led", label: "Mostly whatever the client's site requires" },
      ],
    },
    {
      id: Q.gate,
      prompt: "What has to be done before someone starts a task?",
      help: "This is the part reviewers look for.",
      kind: "choice",
      required: true,
      options: [
        { id: "before_assignment", label: "Training done and recorded before assignment" },
        { id: "before_site", label: "Training done before they go to the site" },
        { id: "induction_then_task", label: "Company induction first, then task training" },
      ],
    },
    {
      id: Q.competency,
      prompt: "How do you know the training took?",
      kind: "choice",
      required: true,
      options: [
        { id: "observation", label: "A supervisor watches them do the task" },
        { id: "written", label: "They show what they learned" },
        { id: "supervised_period", label: "They work supervised for a while afterwards" },
      ],
    },
    {
      id: Q.refresher,
      prompt: "Do you repeat training on a schedule?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.clientSpecific,
      prompt: "Do client sites require their own orientation or training?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are training records kept?",
      help: "For example: a folder in the office, or a shared drive.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const refresher = answers[Q.refresher] === "yes";
    const clientSpecific = answers[Q.clientSpecific] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const decides =
      answers[Q.who] === "supervisor"
        ? "The supervisor for each job establishes what training it requires, and confirms with the " +
          role +
          " where they are not certain."
        : answers[Q.who] === "client_led"
          ? `The requirements of the client's site are the starting point, and the ${role} checks them against the work ${company} will actually be doing — a site orientation covers the site, not the Company's own tasks.`
          : `The ${role} establishes what training each kind of work requires, and reviews it whenever the Company takes on work of a kind it has not done before.`;

    const body: Section[] = [
      {
        heading: "What Training Is Required, and Who Decides",
        blocks: [
          { type: "paragraph", text: decides },
          {
            type: "paragraph",
            text: "What a task requires is worked out from the task, not from a standard list. Two jobs with the same name on a quote can need different things, and the one the Company has never done before is the one worth stopping over.",
          },
          {
            type: "paragraph",
            text: `Where ${company} cannot establish what a task requires, it does not assign the task until it can.`,
          },
        ],
      },
      {
        heading: "Before Anybody Starts",
        blocks: [
          { type: "paragraph", text: GATE_SENTENCE[answers[Q.gate]] },
          { type: "paragraph", text: COMPETENCY_SENTENCE[answers[Q.competency]] },
          {
            type: "paragraph",
            text: `An employee who is not yet through the training a task requires is not put on that task, and is not put on it "for one day" or "just to help out". The gate is the point of the program; a program with a gate that bends has no gate.`,
          },
        ],
      },
      {
        heading: "What Is Recorded",
        blocks: [
          {
            type: "paragraph",
            text: "A record is made for every session, and it is the record rather than anybody's memory that establishes what has been covered:",
          },
          {
            type: "table",
            head: ["Recorded", "What goes in it"],
            rows: [
              ["Who", "Each person present, by name and signature"],
              ["What", "The subject, and the material or course used"],
              ["When", "The date, and how long it took"],
              ["Who gave it", "The trainer, and where they are external, which body"],
              [
                "How it was checked",
                "How the Company satisfied itself the person can do the task",
              ],
              [
                "Certificate or card",
                "Where the training produces one, its number and expiry",
              ],
            ],
          },
          {
            type: "paragraph",
            text: `Records are kept at: ${records}. They are kept for the length of the person's employment and afterwards, because a client may ask about work done years earlier and the Company has no other way of answering.`,
          },
          {
            type: "paragraph",
            text: "An employee may see their own training record on request, and is given a copy when they leave.",
          },
        ],
      },
    ];

    if (refresher) {
      body.push({
        heading: "Repeat Training",
        blocks: [
          {
            type: "paragraph",
            text: `Training is repeated at the interval the subject calls for, and the ${role} keeps the schedule of what falls due when. Where a certificate or card carries its own expiry, that date governs.`,
          },
          {
            type: "paragraph",
            text: "Training is also repeated, whatever the schedule says, when the way the work is done changes, when an incident or near miss suggests something did not land, and when somebody returns after a long absence from that kind of work.",
          },
          {
            type: "paragraph",
            text: "Somebody whose required training has lapsed is treated as not having it, and comes off that task until it is back in date.",
          },
        ],
      });
    }

    if (clientSpecific) {
      body.push({
        heading: "Client and Site Requirements",
        blocks: [
          {
            type: "paragraph",
            text: "Client sites commonly require their own orientation, and some require particular certificates before anybody is allowed on. The supervisor for the job establishes what a site requires before the crew is scheduled, not on the morning they arrive.",
          },
          {
            type: "paragraph",
            text: `Site orientation is recorded alongside the Company's own training. It does not replace it: an orientation covers that site's rules, and ${company} remains responsible for whether its own people can do the work.`,
          },
          {
            type: "paragraph",
            text: "Where a client requires something the Company does not currently hold, the work is not accepted until it does.",
          },
        ],
      });
    }

    body.push({
      heading: "What This Program Does Not Claim",
      blocks: [
        {
          type: "paragraph",
          text: `This document describes how ${company} trains its employees. It says nothing about any particular person, and it is not evidence of anybody's competence.`,
        },
        {
          type: "paragraph",
          text: "That evidence is the training records themselves, which name people and dates. Anybody asking whether a specific person is trained for a specific task is answered from the records, not from this program.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company works out what training its employees need, what has to be complete before somebody is assigned a task, and what is recorded to show it.",
      policy: `It is the policy of ${company} that nobody is assigned work they have not been prepared for, and that the Company would rather turn a job down than put somebody on a task they are not ready for.`,
      body,
      trainingPoints: [
        "That no task starts until the training it requires is complete and recorded",
        "Who to ask when it is not clear what a task requires",
        "That a lapsed certificate means coming off that task until it is renewed",
        "That an employee may see their own training record at any time",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through establishing what a job requires, checking it before assigning anybody, and what to do when a crew arrives on site short of a requirement.",
    });
  },
};
