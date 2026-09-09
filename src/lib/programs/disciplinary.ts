import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Safety Accountability and Enforcement.
 *
 * ## The document that is easiest to get badly wrong
 *
 * Prequalification platforms ask for a "disciplinary policy" and most
 * contractors supply a ladder of punishments. That document is worse than
 * nothing, for a reason the safety literature has been consistent about for
 * decades: a company that reliably punishes people for what goes wrong stops
 * hearing about what goes wrong. Every other program in this library depends
 * on people reporting things, and this is the one that can quietly switch
 * that off.
 *
 * So this is written as accountability rather than punishment, and the part
 * that does the work is the distinction it draws: an honest mistake, a
 * decision that made sense given the pressure somebody was under, and a
 * deliberate choice to skip a control are three different things, and only
 * the last is a discipline matter. That is not softness — it is the only
 * version that leaves the reporting culture intact, and a reviewer who knows
 * the subject will recognise it.
 *
 * ## What it will not say
 *
 * That anybody has been disciplined, how many times, or with what result.
 * That is a personnel record, it concerns identifiable people, and it has no
 * business in a document that goes to a hiring client.
 */

const Q = {
  responsible: "responsible_role",
  decides: "who_decides",
  steps: "steps",
  immediate: "immediate_removal",
  positive: "recognition",
  records: "records_location",
} as const;

const STEPS_INTRO: Record<string, string> = {
  progressive:
    "Where a discipline matter is established, the Company's response escalates: a documented conversation, then a written warning, then suspension from the task or the site, then termination. Each step is recorded, and a step is not skipped except where the conduct itself warrants going straight to a later one.",
  case_by_case:
    "Where a discipline matter is established, the response fits the conduct rather than following a fixed ladder. What the Company does is recorded, together with why that response and not another, so that two similar cases can be compared.",
  documented_only:
    "Where a discipline matter is established, it is dealt with in a documented conversation with the employee and their supervisor, and the record notes what was agreed and by when. Repetition after that is what escalates.",
};

export const DISCIPLINARY: ProgramTemplate = {
  id: "disciplinary",
  title: "Safety Accountability and Enforcement",
  shortName: "Safety Accountability",
  requirementId: "disciplinary-policy",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(disciplinary( & | and )?(enforcement)?( policy)?|safety accountability( and enforcement)?)$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.decides,
      prompt: "Who decides whether something is a discipline matter?",
      kind: "choice",
      required: true,
      options: [
        { id: "owner", label: "The owner" },
        { id: "responsible", label: "Whoever looks after safety" },
        { id: "supervisor_then_owner", label: "The supervisor, reviewed by the owner" },
      ],
    },
    {
      id: Q.steps,
      prompt: "How does the company respond when it is one?",
      kind: "choice",
      required: true,
      options: [
        { id: "progressive", label: "Escalating steps, each one recorded" },
        { id: "case_by_case", label: "A response that fits the conduct" },
        { id: "documented_only", label: "A documented conversation, then escalate if repeated" },
      ],
    },
    {
      id: Q.immediate,
      prompt: "Is anything serious enough to remove someone from site the same day?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.positive,
      prompt: "Do you recognize good safety work as well?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are these records kept?",
      help: "They are personnel records, so somewhere access is limited.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const immediate = answers[Q.immediate] === "yes";
    const positive = answers[Q.positive] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const decider =
      answers[Q.decides] === "owner"
        ? "The Owner decides whether conduct is a discipline matter."
        : answers[Q.decides] === "supervisor_then_owner"
          ? "The supervisor raises it, and the Owner decides whether it is a discipline matter. A supervisor does not decide a matter involving their own crew alone."
          : `The ${role} decides whether conduct is a discipline matter, and is independent of the crew involved.`;

    const body: Section[] = [
      {
        heading: "What This Program Is For",
        blocks: [
          {
            type: "paragraph",
            text: `Every other safety program ${company} maintains depends on people saying what happened. A company that responds to problems by punishing whoever was nearest stops being told about them, and then stops being able to fix them.`,
          },
          {
            type: "paragraph",
            text: "So the purpose of this program is not to punish. It is to be clear about what the Company expects, what it does when those expectations are not met, and — most importantly — what it does not treat as a discipline matter at all.",
          },
        ],
      },
      {
        heading: "Three Different Things",
        blocks: [
          {
            type: "paragraph",
            text: "When something goes wrong, the Company establishes which of these it is before deciding what to do:",
          },
          {
            type: "numbered",
            items: [
              "An honest mistake. Somebody intended to do the right thing and did not. This is not a discipline matter. The response is to look at why the work allowed the mistake to matter — the equipment, the method, the time available, the supervision — and change that.",
              "A judgment call that turned out badly. Somebody weighed it up and chose wrong, often under pressure the Company created. This is not a discipline matter either. The response is to ask what made the wrong choice look reasonable at the time, and to fix that.",
              "A deliberate decision to skip a control. Somebody knew what was required, was able to do it, and chose not to. This is a discipline matter.",
            ],
          },
          {
            type: "paragraph",
            text: "The distinction is not about how bad the outcome was. The same act can hurt nobody on Monday and kill somebody on Tuesday, and treating those differently teaches people that consequences depend on luck.",
          },
        ],
      },
      {
        heading: "What Is Never a Discipline Matter",
        blocks: [
          {
            type: "paragraph",
            text: "None of the following is ever treated as grounds for discipline, and anybody who suggests otherwise is themselves in breach of this program:",
          },
          {
            type: "bullets",
            items: [
              "Reporting an incident, a near miss, or a hazard — including reporting one late",
              "Reporting an injury, or asking for medical attention",
              "Stopping work over a safety concern raised in good faith, including where the concern turns out to be unfounded",
              "Refusing a task the person has not been prepared for",
              "Raising something with a client, a regulator, or anybody else outside the Company",
              "Taking part honestly in an investigation, including saying that they themselves made the mistake",
            ],
          },
          {
            type: "paragraph",
            text: `An employee who believes they are being treated badly for any of these raises it with the Owner directly, and it is investigated as a breach of this program.`,
          },
        ],
      },
      {
        heading: "What the Company Expects",
        blocks: [
          {
            type: "paragraph",
            text: "Stated plainly, so nobody has to guess where the line is:",
          },
          {
            type: "bullets",
            items: [
              "Follow the controls in the job plan, and stop the job rather than work around one",
              "Use the protective equipment the task calls for",
              "Do not work on a task you have not been prepared for, and say so rather than attempt it",
              "Report incidents, near misses and hazards",
              "Do not remove, defeat or bypass a guard, lock, barrier or alarm",
              "Do not come to work impaired, and do not stay if you become unfit during a shift",
            ],
          },
        ],
      },
      {
        heading: "How a Matter Is Handled",
        blocks: [
          { type: "paragraph", text: decider },
          {
            type: "paragraph",
            text: "Before anything is decided, the employee is told what is alleged and is given the chance to explain what happened in their own words. Somebody who is not asked has not been heard, and a decision made without that is not a decision this program allows.",
          },
          { type: "paragraph", text: STEPS_INTRO[answers[Q.steps]] },
          {
            type: "paragraph",
            text: "A finding that somebody was careless is not a finding. It describes what they did without saying why the work allowed it to matter, and it produces no change that would stop the next person doing the same thing.",
          },
        ],
      },
    ];

    if (immediate) {
      body.push({
        heading: "Removal From Site",
        blocks: [
          {
            type: "paragraph",
            text: "Some conduct means somebody stops work immediately and leaves the site that day, before anything is decided. That is not a finding and not a punishment — it is what the Company does when leaving somebody in place would put them or others at risk.",
          },
          {
            type: "paragraph",
            text: "It applies to apparent impairment at work, to deliberately defeating a safety device, and to conduct that puts another person in immediate danger.",
          },
          {
            type: "paragraph",
            text: "What happens next follows the rest of this program: the person is told what is alleged, is asked what happened, and a decision is made afterwards.",
          },
        ],
      });
    }

    if (positive) {
      body.push({
        heading: "Recognizing Good Safety Work",
        blocks: [
          {
            type: "paragraph",
            text: `${company} recognizes employees who stop a job that needed stopping, report a near miss nobody else saw, or find a problem before it became one. Recognition is given openly, so that the crew can see what the Company actually values.`,
          },
          {
            type: "paragraph",
            text: "Nothing is measured by how few incidents get reported, and no bonus, award or scorecard depends on a low report count. A target like that is an instruction to stay quiet, and it is the fastest way to make a safety program worthless.",
          },
        ],
      });
    }

    body.push({
      heading: "Records",
      blocks: [
        {
          type: "paragraph",
          text: `Records under this program are kept at: ${records}. They are personnel records: they are confidential, they are seen only by those who need them, and they are not shared with clients.`,
        },
        {
          type: "paragraph",
          text: "An employee may see their own record and may add their own account of events to it.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "what the Company expects of its employees on safety, what it does when those expectations are not met, and what it never treats as a discipline matter.",
      policy: `It is the policy of ${company} that people are accountable for the choices they make and are not punished for the mistakes anybody could make. The Company would rather hear about a problem than be able to say it disciplined somebody for one.`,
      body,
      trainingPoints: [
        "What the Company expects, in the plain list above",
        "That reporting something — including reporting it late — is never grounds for discipline",
        "The difference between a mistake, a judgment call, and deliberately skipping a control",
        "That you will be asked what happened, in your own words, before anything is decided",
        "That you may see your own record and add your own account to it",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through the three-way distinction above, and on why a report they find inconvenient is still a report that must be welcomed.",
      reviewTrigger:
        "The review also asks whether reporting has fallen off, since a drop in reports is more often a sign that this program is being applied badly than that the work has got safer.",
    });
  },
};
