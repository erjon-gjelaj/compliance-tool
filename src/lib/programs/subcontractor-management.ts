import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Subcontractor Management.
 *
 * ## The one where the customer is on the other side of the table
 *
 * Every other program in this library helps a subcontractor answer a hiring
 * client. This one is about what they do when they hire somebody themselves —
 * and the reason a client asks for it is precise: a client's safety statistics
 * include the people their contractor brought along, and they want to know
 * that the vetting they applied to this company was applied by this company to
 * the next one down.
 *
 * ## The load-bearing content
 *
 * Not a vetting checklist. It is what happens when the answer is no: whether
 * a subcontractor who does not meet the bar gets used anyway because the job
 * starts Monday. A program that describes selection criteria without saying
 * who may waive them has described an intention.
 *
 * ## What it will not do
 *
 * State a rate, a score, or a threshold that a subcontractor must meet.
 * Those are the customer's commercial decision, they differ by client and by
 * work, and a number printed here would be one this project invented.
 */

const Q = {
  responsible: "responsible_role",
  frequency: "how_often",
  vetting: "vetting_depth",
  waiver: "waiver_authority",
  onsite: "onsite_oversight",
  incidents: "incident_reporting",
  records: "records_location",
} as const;

const VETTING: Record<string, string> = {
  documents:
    "Their written safety programs, insurance certificates, and their injury and illness figures for the last three years.",
  documents_plus_platform:
    "Their written safety programs, insurance certificates, their injury and illness figures for the last three years, and their standing on the prequalification platform the client uses.",
  documents_plus_references:
    "Their written safety programs, insurance certificates, their injury and illness figures for the last three years, and a conversation with somebody they have recently worked for.",
};

export const SUBCONTRACTOR_MANAGEMENT: ProgramTemplate = {
  id: "sub_management",
  title: "Subcontractor Management",
  shortName: "Subcontractor Management",
  requirementId: "subcontractor-management",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(subcontractor management|contractor (management|safety))( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.frequency,
      prompt: "How often do you bring in a subcontractor?",
      kind: "choice",
      required: true,
      options: [
        { id: "rarely", label: "Rarely — specialist work only" },
        { id: "regularly", label: "Regularly, for parts of most jobs" },
        { id: "peaks", label: "To cover peaks in workload" },
      ],
    },
    {
      id: Q.vetting,
      prompt: "What do you look at before hiring one?",
      kind: "choice",
      required: true,
      options: [
        { id: "documents", label: "Their programs, insurance and injury figures" },
        { id: "documents_plus_platform", label: "That, plus their platform standing" },
        { id: "documents_plus_references", label: "That, plus a reference call" },
      ],
    },
    {
      id: Q.waiver,
      prompt: "Who can approve one that doesn't meet the bar?",
      help: "If nobody can, the program says so — that is a stronger answer.",
      kind: "choice",
      required: true,
      options: [
        { id: "nobody", label: "Nobody — they don't get used" },
        { id: "owner_written", label: "The owner, in writing, with conditions" },
      ],
    },
    {
      id: Q.onsite,
      prompt: "Who watches their work once they're on site?",
      kind: "choice",
      required: true,
      options: [
        { id: "our_supervisor", label: "Our supervisor for that job" },
        { id: "their_own", label: "They supervise themselves; we check in" },
      ],
    },
    {
      id: Q.incidents,
      prompt: "Do they have to report incidents to you?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where is the subcontractor file kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const incidents = answers[Q.incidents] === "yes";
    const noWaiver = answers[Q.waiver] === "nobody";
    const records = (answers[Q.records] ?? "").trim();

    const oversight =
      answers[Q.onsite] === "their_own"
        ? `Subcontractors supervise their own crews. The ${company} supervisor for the job confirms each day that the work matches what was agreed, that their people have what the job requires, and raises anything that does not look right with their supervisor rather than with their crew.`
        : `The ${company} supervisor for the job oversees the subcontractor's work on site: they are included in the job planning, in the daily discussion, and in anything that changes during the day.`;

    const body: Section[] = [
      {
        heading: "Why This Program Exists",
        blocks: [
          {
            type: "paragraph",
            text: `When ${company} brings a subcontractor onto a job, that subcontractor's people are working alongside the Company's own and under the client's expectations. The client's safety record includes them.`,
          },
          {
            type: "paragraph",
            text: `So the Company applies to the people it hires the same kind of scrutiny its own clients apply to it. It would be difficult to justify otherwise.`,
          },
          {
            type: "paragraph",
            text: `${company} does not transfer responsibility by subcontracting. Where the Company holds the contract, it answers for what happens on the job.`,
          },
        ],
      },
      {
        heading: "Before They Are Hired",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} reviews the following before any subcontractor is engaged:`,
          },
          { type: "paragraph", text: VETTING[answers[Q.vetting]] },
          {
            type: "paragraph",
            text: "What is being looked for is not a perfect record. It is whether they have written programs that cover the work they will actually do, whether they can say what happened in the incidents they have had, and whether their answers are specific rather than reassuring.",
          },
          {
            type: "paragraph",
            text: "A subcontractor who cannot produce their programs, or produces ones written for different work, has answered the question.",
          },
          {
            type: "paragraph",
            text: "Where the client sets its own requirements for subcontractors on their site, those are established first and applied in addition to the Company's own.",
          },
        ],
      },
      {
        heading: noWaiver ? "No Exceptions" : "Approving an Exception",
        blocks: noWaiver
          ? [
              {
                type: "paragraph",
                text: `A subcontractor who does not meet these requirements is not used, and nobody at ${company} has the authority to approve one who does not. There is no waiver, and the schedule is not a reason.`,
              },
              {
                type: "paragraph",
                text: "Where that leaves the Company unable to staff a job, the job is re-planned or the client is told. Both are better than putting a crew nobody checked onto a site the Company is responsible for.",
              },
            ]
          : [
              {
                type: "paragraph",
                text: "Only the Owner may approve a subcontractor who does not meet these requirements, and only in writing, before they start.",
              },
              {
                type: "paragraph",
                text: "The approval records what the shortfall is, why the work is going ahead anyway, what conditions apply — additional supervision, restricted scope, a shorter engagement — and who is responsible for those conditions holding.",
              },
              {
                type: "paragraph",
                text: "A supervisor cannot approve one, and neither can anybody under schedule pressure to fill a crew. The point of putting this in one person's hands is that the decision is visible rather than absorbed.",
              },
            ],
      },
      {
        heading: "Before They Start Work",
        blocks: [
          {
            type: "paragraph",
            text: "Once engaged and before their first shift, the subcontractor:",
          },
          {
            type: "numbered",
            items: [
              `Is told what ${company} expects of them on this job — the safety requirements, the client's site rules, and anything about the site that is not obvious.`,
              "Goes through the site's own orientation where the site runs one.",
              "Is taken through the job plan for the work they are doing, and takes part in planning where their work meets the Company's.",
              "Is told that every person on their crew has authority to stop work, and that the Company means it.",
              "Confirms their people hold what the work requires, and that their equipment is fit for it.",
            ],
          },
          {
            type: "paragraph",
            text: "Where several employers are working in the same area, who is doing what and when is settled before anybody starts. Most of what goes wrong between two contractors goes wrong in the gap between them.",
          },
        ],
      },
      {
        heading: "While They Are On Site",
        blocks: [
          { type: "paragraph", text: oversight },
          {
            type: "paragraph",
            text: `A ${company} employee who sees a subcontractor's crew doing something unsafe says so, and may stop that work exactly as they would stop the Company's own. Being somebody else's employee does not put a person outside the Company's stop-work authority on a job it is responsible for.`,
          },
          {
            type: "paragraph",
            text: "Anything that is not corrected is raised with the subcontractor's own management rather than left with their crew. Repeated failure to correct something ends the engagement.",
          },
        ],
      },
    ];

    if (incidents) {
      body.push({
        heading: "Incidents and Near Misses",
        blocks: [
          {
            type: "paragraph",
            text: `A subcontractor reports to ${company} every injury, incident and near miss involving their people on a job the Company holds — the same day, and whether or not anybody was hurt.`,
          },
          {
            type: "paragraph",
            text: "That is a condition of the engagement and is agreed before they start rather than raised afterwards. A subcontractor who only reports what the Company would have found out anyway is not reporting.",
          },
          {
            type: "paragraph",
            text: `${company} takes part in the investigation where its own work, planning or coordination was involved, and shares what it learns with them rather than filing it.`,
          },
          {
            type: "paragraph",
            text: "Where the client requires notification, that happens on the client's terms and is not delayed while the two companies establish who was at fault.",
          },
        ],
      });
    }

    body.push({
      heading: "Records",
      blocks: [
        {
          type: "paragraph",
          text: `A file is kept for each subcontractor at: ${records}. It holds what was reviewed before they were engaged, when, and by whom; the current insurance certificates; what they were told before starting; anything raised during the work; and any incident involving them.`,
        },
        {
          type: "paragraph",
          text: "The review is repeated rather than done once. A subcontractor used regularly is reviewed at least annually, and again whenever their insurance lapses or the work they are doing for the Company changes.",
        },
        {
          type: "paragraph",
          text: "Clients commonly ask to see this file. It is kept in a state where it could be shown without preparing it first.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company selects subcontractors, what they are told before they start, who oversees their work on site, and what is recorded about them.",
      policy: `It is the policy of ${company} that anybody it brings onto a job is held to the standard the Company is held to, and that responsibility for a job is not transferred by subcontracting part of it.`,
      body,
      trainingPoints: [
        "That a subcontractor's crew works to the same expectations as the Company's own",
        "That you may stop a subcontractor's work exactly as you would stop your own crew's",
        "To raise anything uncorrected with their management rather than leaving it with their crew",
        "That where two employers work in the same area, the gap between them is where things go wrong",
      ],
      supervisorTraining:
        noWaiver
          ? "Supervisors are additionally taken through coordinating work where two employers share an area, and on the fact that nobody — including them — may engage a subcontractor who has not been reviewed."
          : "Supervisors are additionally taken through coordinating work where two employers share an area, and on the fact that only the Owner may approve a subcontractor who falls short, in writing, before they start.",
      reviewTrigger:
        "The review checks that no subcontractor in regular use has gone more than a year without being looked at again.",
    });
  },
};
