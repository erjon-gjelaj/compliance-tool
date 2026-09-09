import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Job Safety Analysis.
 *
 * ## What this one is actually for
 *
 * Every other program in the library is about one hazard. This one is about
 * the method a crew uses to find hazards nobody wrote a program for — which
 * is most of them, on most days. A reviewer reads it to find out whether the
 * company plans work or just turns up.
 *
 * So the load-bearing content is not a definition of a JSA. It is: who writes
 * one, when a new one is required rather than a filed one reused, that the
 * crew doing the work takes part in writing it, and what happens when the job
 * changes halfway through. The last is the one most often missing and the one
 * that gets people hurt: a JSA written for the morning's task, still in
 * somebody's pocket at three o'clock while the crew does something else.
 *
 * ## Built around a form the customer already has, or does not
 *
 * There is no blank JSA form in this document. A contractor either has one —
 * from a client, a previous employer, an insurer — or needs one, and printing
 * a generic grid into their program would make it look like the Company had
 * adopted a form it does not use. The program describes what a JSA must
 * capture; the form is theirs.
 */

const Q = {
  responsible: "responsible_role",
  whoWrites: "who_writes",
  when: "when_written",
  review: "crew_review",
  stopWork: "stop_work",
  filed: "where_filed",
  clientForm: "client_form",
} as const;

const WHO_WRITES: Record<string, string> = {
  supervisor:
    "The supervisor for the job writes the analysis, with the crew who will do the work.",
  crew_lead:
    "The crew lead writes the analysis with the people who will do the work, and the supervisor reviews it before work starts.",
  safety_role:
    "The analysis is written by the person responsible for safety, together with the supervisor and the crew who will do the work.",
};

const WHEN_WRITTEN: Record<string, string> = {
  every_job:
    "An analysis is written for every job before work starts, however familiar the task.",
  new_or_changed:
    "An analysis is written before any job the Company has not done in that place before, and before any job whose method, equipment or crew has changed since the last time. A job repeated in the same place, the same way, with the same crew, uses the existing analysis — and the crew confirms out loud that nothing about it has changed before they start.",
  daily:
    "An analysis is written at the start of each shift for the work planned that shift, whether or not the crew has done it before.",
};

function whoWrites(answers: Answers): string {
  return WHO_WRITES[answers[Q.whoWrites]] ?? WHO_WRITES.supervisor;
}

export const JOB_SAFETY_ANALYSIS: ProgramTemplate = {
  id: "jsa",
  title: "Job Safety Analysis",
  shortName: "Job Safety Analysis",
  requirementId: "job-safety-analysis",

  /*
   * Offered to customers. Lifted by the owner on 2026-09-07, with the
   * standing instruction to build and release the remaining programs.
   */
  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^job safety analysis( ?\/ ?hazard assessment)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.whoWrites,
      prompt: "Who writes the job safety analysis?",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisor", label: "The supervisor for the job" },
        { id: "crew_lead", label: "The crew lead, reviewed by a supervisor" },
        { id: "safety_role", label: "Whoever looks after safety, with the crew" },
      ],
    },
    {
      id: Q.when,
      prompt: "When does a job get a new analysis?",
      help: "Reviewers look at this one closely.",
      kind: "choice",
      required: true,
      options: [
        { id: "every_job", label: "Every job, every time" },
        { id: "new_or_changed", label: "New jobs, and whenever something changes" },
        { id: "daily", label: "At the start of every shift" },
      ],
    },
    {
      id: Q.review,
      prompt: "Does the crew doing the work go through it before starting?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.stopWork,
      prompt: "Can anyone on the crew stop the job if conditions change?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.clientForm,
      prompt: "Do some clients make you use their own JSA form?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.filed,
      prompt: "Where do completed analyses end up?",
      help: "For example: back to the office with the daily paperwork.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const crewReviews = answers[Q.review] === "yes";
    const stopWork = answers[Q.stopWork] === "yes";
    const clientForm = answers[Q.clientForm] === "yes";
    const filed = (answers[Q.filed] ?? "").trim();

    const body: Section[] = [
      {
        heading: "What a Job Safety Analysis Covers",
        blocks: [
          {
            type: "paragraph",
            text: "A job safety analysis breaks a job into the steps it is actually done in, names what could go wrong at each step, and says what the crew will do about it before they start. It is written for the job in hand, not for the trade in general.",
          },
          {
            type: "paragraph",
            text: "Every analysis records at least the following:",
          },
          {
            type: "table",
            head: ["Recorded", "What goes in it"],
            rows: [
              ["The job", "What is being done, where, and on whose site"],
              ["Date and crew", "Who is doing the work, by name"],
              ["The steps", "The job in the order it is actually carried out"],
              [
                "What could go wrong",
                "At each step, and to whom — including people not on the crew",
              ],
              [
                "What is done about it",
                "The control for each hazard, specific enough to follow",
              ],
              [
                "Equipment and permits",
                "Tools, protective equipment, and any permit the job is under",
              ],
              ["Gone through with", "Who was briefed on it, and when"],
            ],
          },
          {
            type: "paragraph",
            text: "A control that says \"be careful\" or \"use caution\" is not a control. What is written is the thing somebody does: the barrier that goes up, the isolation that is proved, the second person on the radio.",
          },
        ],
      },
      {
        heading: "Who Writes It, and When",
        blocks: [
          { type: "paragraph", text: whoWrites(answers) },
          { type: "paragraph", text: WHEN_WRITTEN[answers[Q.when]] },
          {
            type: "paragraph",
            text: `The people who will do the work take part in writing it. An analysis produced in the office and handed to a crew describes a job somebody imagined; the crew are the ones who know how it is actually done, and they are the ones who have to follow it.`,
          },
        ],
      },
    ];

    if (crewReviews) {
      body.push({
        heading: "Going Through It With the Crew",
        blocks: [
          {
            type: "paragraph",
            text: "Before work starts, the crew go through the analysis together on site. That is a conversation rather than a signature: each person is asked whether anything about the job as they are now looking at it differs from what is written down.",
          },
          {
            type: "paragraph",
            text: "Everybody present signs it. A signature records that they were there and had the chance to speak, not that they agree the job is safe.",
          },
        ],
      });
    }

    body.push({
      heading: "When the Job Changes",
      blocks: [
        {
          type: "paragraph",
          text: "This is the part that matters most, because it is where an analysis stops describing the work.",
        },
        {
          type: "paragraph",
          text: "Work stops and the analysis is revisited when any of the following happens:",
        },
        {
          type: "bullets",
          items: [
            "The method changes, or a step is done in a different order",
            "Different equipment is used than the one written down",
            "The crew changes, including somebody joining part-way through",
            "The weather, the light, or the condition of the area changes",
            "Another trade starts work near enough to affect the job, or the Company's work starts affecting theirs",
            "Anything is found that was not expected — a live line, a damaged component, a space that is not what the drawing said",
          ],
        },
        {
          type: "paragraph",
          text: `Revisiting it can take two minutes standing in the same place. What it may not be is skipped because the crew are most of the way through and the change looks small.`,
        },
      ],
    });

    if (stopWork) {
      body.push({
        heading: "Stopping the Job",
        blocks: [
          {
            type: "paragraph",
            text: `Any employee of ${company} may stop the job, at any time, without asking permission first, if they believe the work is not safe or no longer matches the analysis. Nobody is questioned or penalized for stopping work in good faith, including where it turns out afterwards that the job was fine.`,
          },
          {
            type: "paragraph",
            text: `Work restarts when the supervisor and the person who stopped it agree that whatever prompted it has been dealt with, and the analysis reflects the change. If they do not agree, the ${role} decides, and the job stays stopped until they do.`,
          },
        ],
      });
    }

    if (clientForm) {
      body.push({
        heading: "Client Forms",
        blocks: [
          {
            type: "paragraph",
            text: `Some clients require their own analysis form, or a permit that includes one. Where they do, the Company uses theirs, and this program describes what has to be captured rather than the piece of paper it is captured on.`,
          },
          {
            type: "paragraph",
            text: "Where a client's form asks for less than this program does, the crew records the rest alongside it. A shorter form does not lower what the Company does.",
          },
        ],
      });
    }

    body.push({
      heading: "What Happens to Completed Analyses",
      blocks: [
        {
          type: "paragraph",
          text: `Completed analyses are kept at: ${filed}.`,
        },
        {
          type: "paragraph",
          text: `The ${role} reads them rather than filing them. A stack of analyses that all name the same hazard is telling the Company something no single one of them says, and it is the cheapest safety information the business produces.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how employees of the Company plan a job before starting it: how the hazards in the work are identified, what is done about them, and what happens when the job turns out differently from the plan.",
      policy: `It is the policy of ${company} that work is planned before it is started, by the people who are going to do it, and that a plan which no longer matches the job is stopped rather than followed.`,
      body,
      trainingPoints: [
        "How to break a job into the steps it is actually done in",
        "What counts as a control, and why \"be careful\" is not one",
        "That the analysis is written with the crew and not handed to them",
        "The changes that mean the job stops and the analysis is revisited",
        stopWork
          ? "That anybody may stop the job, and that nobody is penalized for it"
          : "Who to raise a concern with when the job stops matching the plan",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through writing an analysis, leading the discussion with a crew, and deciding when a change is big enough to stop for.",
      reviewTrigger:
        "The annual review reads the completed analyses together, since a hazard appearing across several of them is a pattern none of them shows on its own.",
    });
  },
};
