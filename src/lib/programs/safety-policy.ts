import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Safety Policy, Roles and Responsibilities.
 *
 * ## The document at the front of the file
 *
 * This is the one a reviewer opens first and the one most contractors do
 * worst, because it is the easiest to fill with sentiment. "Safety is our
 * number one priority" tells a reviewer nothing, and they have read it two
 * hundred times.
 *
 * What a reviewer is actually looking for is whether responsibility has been
 * assigned to named roles rather than to the company in the abstract. A
 * policy where "the Company will ensure" appears twenty times has assigned
 * nothing to anybody. So the substance here is the responsibility table:
 * owner, supervisor, employee, and what each one actually does.
 *
 * ## The one commitment worth making
 *
 * Authority to stop work, held by everybody, with no penalty. It is the
 * single sentence in a safety policy that changes behaviour on a job site,
 * and it is the one a hiring client most wants to see from a subcontractor
 * working alongside their own crews.
 */

const Q = {
  responsible: "responsible_role",
  ownerRole: "owner_involvement",
  meetings: "meeting_cadence",
  budget: "budget_authority",
  measure: "how_measured",
} as const;

const MEETINGS: Record<string, string> = {
  daily:
    "Crews hold a short safety discussion at the start of each shift, covering the work planned that day and anything that has changed since the last one.",
  weekly:
    "Crews hold a documented safety meeting each week, and a short discussion at the start of each shift covering the work planned that day.",
  monthly:
    "The Company holds a documented safety meeting each month, and crews hold a short discussion at the start of each shift covering the work planned that day.",
};

const MEASURE: Record<string, string> = {
  leading:
    "The Company measures what it does rather than only what went wrong: job plans completed, near misses reported, corrective actions closed on time, and observations carried out. Counting only injuries measures luck as much as effort, and rewards silence.",
  both:
    "The Company tracks injuries and illnesses, and alongside them what it actually does: job plans completed, near misses reported, and corrective actions closed on time. Injury counts alone measure luck as much as effort.",
  incidents:
    "The Company tracks injuries, illnesses and near misses, and reviews them together rather than one at a time. A count on its own says little; the pattern across them is what the review is for.",
};

export const SAFETY_POLICY: ProgramTemplate = {
  id: "safety_policy",
  title: "Safety Policy, Roles and Responsibilities",
  shortName: "Safety Policy",
  requirementId: "written-safety-program",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(safety policy(, roles ?(and|&) ?responsibilities)?|written safety (manual|policy|program)( or program)?)$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.ownerRole,
      prompt: "What does the owner personally do on safety?",
      help: "Reviewers look for something specific here, not a statement of support.",
      kind: "choice",
      required: true,
      options: [
        { id: "reviews_incidents", label: "Reviews every incident" },
        { id: "visits_sites", label: "Visits job sites and walks the work" },
        { id: "approves_spend", label: "Signs off safety spending personally" },
      ],
    },
    {
      id: Q.meetings,
      prompt: "How often does the crew talk about safety together?",
      kind: "choice",
      required: true,
      options: [
        { id: "daily", label: "Every shift, before work" },
        { id: "weekly", label: "A meeting each week" },
        { id: "monthly", label: "A meeting each month" },
      ],
    },
    {
      id: Q.budget,
      prompt: "Can a supervisor spend money to fix a safety problem without asking first?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.measure,
      prompt: "What does the company actually track?",
      kind: "choice",
      required: true,
      options: [
        { id: "leading", label: "Mostly what we do — plans, reports, actions closed" },
        { id: "both", label: "Injuries, and what we do" },
        { id: "incidents", label: "Injuries and near misses" },
      ],
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const budget = answers[Q.budget] === "yes";

    const ownerDoes =
      answers[Q.ownerRole] === "visits_sites"
        ? "The Owner visits job sites and walks the work with the crew, rather than reading about it afterwards."
        : answers[Q.ownerRole] === "approves_spend"
          ? "The Owner personally approves spending on safety, and does not delegate that decision to whoever is holding the schedule."
          : "The Owner reads every incident report and every investigation, and asks what is being changed as a result.";

    const body: Section[] = [
      {
        heading: "What This Company Commits To",
        blocks: [
          {
            type: "paragraph",
            text: `${company} commits to the following, and expects to be held to it:`,
          },
          {
            type: "numbered",
            items: [
              "No job is worth an injury. Work that cannot be done safely is not done until it can be.",
              "Anybody may stop work over a safety concern, at any time, without asking permission and without penalty.",
              "Hazards are removed or controlled where that is possible, and protective equipment is what remains after that — not the first answer.",
              "Nobody is assigned work they have not been prepared for.",
              "Incidents and near misses are reported, looked into, and used to change something.",
              "What the Company asks of its crews, it asks of its supervisors and its owner first.",
            ],
          },
          {
            type: "paragraph",
            text: `This is not a statement that ${company} has no incidents. It is a statement of what the Company does about them, and what it does before them.`,
          },
        ],
      },
      {
        heading: "Who Is Responsible for What",
        blocks: [
          {
            type: "paragraph",
            text: "Responsibility here belongs to roles rather than to the Company in general. A commitment that belongs to everybody belongs to nobody.",
          },
          {
            type: "table",
            head: ["Role", "What they are responsible for"],
            rows: [
              [
                "Owner",
                "Setting this policy, providing what is needed to follow it, and answering for it. Safety decisions are not delegated away from this role when they cost money or time.",
              ],
              [
                role,
                "Keeping the Company's safety programs current, arranging training, looking into incidents, and telling the Owner what is not working.",
              ],
              [
                "Supervisors",
                "Planning each job before it starts, checking that people are prepared for what they are assigned, correcting unsafe work as they see it, and stopping the job when it needs stopping.",
              ],
              [
                "Employees",
                "Following the plan for the job, using the equipment the task calls for, reporting hazards, incidents and near misses, and stopping work over a concern rather than working around it.",
              ],
              [
                "Everybody",
                "Stop-work authority. Nobody has to earn it and nobody can be penalized for using it.",
              ],
            ],
          },
        ],
      },
      {
        heading: "Stop-Work Authority",
        blocks: [
          {
            type: "paragraph",
            text: `Any employee of ${company}, at any level and on any site, may stop work they believe is unsafe. They do not need permission, they do not need to be certain, and they do not need to be right.`,
          },
          {
            type: "paragraph",
            text: `Work restarts when the supervisor and the person who stopped it agree the concern has been dealt with. Where they do not agree, the ${role} decides, and the work stays stopped until they do.`,
          },
          {
            type: "paragraph",
            text: "Nobody is questioned, penalized or treated differently for stopping work in good faith, including when it turns out the job was fine. A stop-work authority somebody is afraid to use is a sentence in a document rather than a control.",
          },
        ],
      },
      {
        heading: "What the Owner Does",
        blocks: [
          { type: "paragraph", text: ownerDoes },
          {
            type: "paragraph",
            text: "Where a schedule and a safety requirement conflict, the Owner decides, and the decision is not delegated to the person under the most pressure to keep the job moving.",
          },
        ],
      },
      {
        heading: "Talking About the Work",
        blocks: [
          { type: "paragraph", text: MEETINGS[answers[Q.meetings]] },
          {
            type: "paragraph",
            text: `Meetings are about the work in hand rather than about safety in general. What is discussed and who was there is recorded, and anything raised that cannot be settled on the spot goes to the ${role} with a date.`,
          },
          {
            type: "paragraph",
            text: "Employees are asked what they think would make a job safer, and what gets raised is answered — a question that goes unanswered twice stops being asked.",
          },
        ],
      },
    ];

    if (budget) {
      body.push({
        heading: "Spending to Fix a Problem",
        blocks: [
          {
            type: "paragraph",
            text: "A supervisor may spend what is needed to correct a safety problem on the spot, without approval first, and tells the Owner afterwards. Requiring a phone call before a hazard can be fixed is how a hazard stays in place for a shift.",
          },
          {
            type: "paragraph",
            text: "Anything larger goes to the Owner, with the work stopped in the meantime if the hazard warrants it.",
          },
        ],
      });
    }

    body.push({
      heading: "How the Company Knows Whether This Is Working",
      blocks: [
        { type: "paragraph", text: MEASURE[answers[Q.measure]] },
        {
          type: "paragraph",
          text: `No target, bonus or scorecard at ${company} depends on a low number of reports. A target like that is an instruction to stay quiet, and it would undo every other program the Company maintains.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "what the Company commits to on safety, who is responsible for what, and the authority every employee has to stop work.",
      policy: `It is the policy of ${company} that no job is worth an injury, and that the Company would rather lose a day than have somebody hurt making it up.`,
      scopeNote:
        "This policy sits above the Company's other safety programs. Where one of them describes a particular hazard in more detail, that program governs the detail and this one governs the commitment.",
      body,
      trainingPoints: [
        "The six commitments above, and that they apply to supervisors and the owner first",
        "That anybody may stop work, without permission and without penalty",
        "Who is responsible for what, and who to go to when something is not being dealt with",
        "That nothing at this company rewards a low report count",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through what to do when a schedule and a safety requirement conflict, and on the fact that the decision is the Owner's rather than theirs to absorb.",
    });
  },
};
