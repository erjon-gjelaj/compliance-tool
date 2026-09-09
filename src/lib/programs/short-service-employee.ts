import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Short Service Employee.
 *
 * ## Not a regulation, and the document should not pretend otherwise
 *
 * This is a contractual requirement, not a legal one. Hiring clients in
 * refining and petrochemical work impose it because the injury statistics on
 * new people are stark — a disproportionate share of serious incidents happen
 * to somebody in their first few months, whatever their years in the trade.
 *
 * That distinction matters for how the document is written. It states what
 * the Company does and why, and it never suggests a regulator requires it.
 *
 * ## Three elements, and the ratio is the one with teeth
 *
 * The config names the period, the mentor ratio, and how a short service
 * employee is identified on site. The ratio is the one that gets a program
 * rejected, because a company that puts four new people on a crew of five has
 * a mentoring policy on paper and a crew of strangers in fact.
 *
 * ## Experience is not the same as familiarity
 *
 * The mistake this program exists to prevent is treating a thirty-year
 * pipefitter as not new. They are new to this company, this crew, this site
 * and this client's rules, and the statistics do not care how long they have
 * held a ticket. So the clock runs from joining, and a separate short clock
 * runs from arriving at an unfamiliar site.
 */

const Q = {
  responsible: "responsible_role",
  periodDays: "period_days",
  ratio: "mentor_ratio",
  identification: "identification_method",
  experienced: "experienced_exception",
  newSite: "new_site_clock",
  records: "records_location",
} as const;

const PERIOD: Record<string, string> = {
  "180": "six months",
  "120": "four months",
  "90": "three months",
};

const IDENTIFICATION: Record<string, string> = {
  hard_hat_sticker:
    "A sticker on the hard hat, visible from any direction, so that anybody on site — including the client's own people and other contractors — can see it without having to ask.",
  colored_hard_hat:
    "A hard hat in a distinct color, so that anybody on site can see it at a distance without having to ask.",
  vest:
    "A high-visibility vest in a distinct color, so that anybody on site can see it at a distance without having to ask.",
};

export const SHORT_SERVICE_EMPLOYEE: ProgramTemplate = {
  id: "sse",
  title: "Short Service Employee",
  shortName: "Short Service Employee",
  requirementId: "short-service-employee",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^short service (employee|worker)( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.periodDays,
      prompt: "How long is somebody treated as short service?",
      help: "Six months is what most clients in refining and petrochemical work expect.",
      kind: "choice",
      required: true,
      options: [
        { id: "180", label: "Six months" },
        { id: "120", label: "Four months" },
        { id: "90", label: "Three months" },
      ],
    },
    {
      id: Q.ratio,
      prompt: "How many short service employees can one mentor look after?",
      help: "Reviewers check this. One mentor to one is the common expectation.",
      kind: "choice",
      required: true,
      options: [
        { id: "one_to_one", label: "One each" },
        { id: "one_to_two", label: "Up to two each" },
        { id: "twenty_percent", label: "No more than one in five of the crew" },
      ],
    },
    {
      id: Q.identification,
      prompt: "How is a short service employee identified on site?",
      kind: "choice",
      required: true,
      options: [
        { id: "hard_hat_sticker", label: "A sticker on the hard hat" },
        { id: "colored_hard_hat", label: "A different colored hard hat" },
        { id: "vest", label: "A different colored vest" },
      ],
    },
    {
      id: Q.experienced,
      prompt: "Can an experienced hire have the period shortened?",
      help: "If yes, the program says who decides and what they have to write down.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.newSite,
      prompt: "Do you treat someone as new again when they go to an unfamiliar site?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where is the short service list kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const period = PERIOD[answers[Q.periodDays]] ?? "six months";
    const experienced = answers[Q.experienced] === "yes";
    const newSite = answers[Q.newSite] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const ratio =
      answers[Q.ratio] === "one_to_two"
        ? "One mentor looks after no more than two short service employees at a time. A mentor with more than that is doing their own job and watching nobody."
        : answers[Q.ratio] === "twenty_percent"
          ? "No more than one in five of any crew is a short service employee. A crew where the new people outnumber the experienced ones has a mentoring policy on paper and a crew of strangers in fact."
          : "One mentor is assigned to each short service employee. The mentor has that one person to look after, and does not hold the role for anybody else at the same time.";

    const body: Section[] = [
      {
        heading: "Who Is Short Service, and Why",
        blocks: [
          {
            type: "paragraph",
            text: `Every employee of ${company} is treated as short service for their first ${period} with the Company, whatever their experience in the trade.`,
          },
          {
            type: "paragraph",
            text: "That last clause is the point. A pipefitter with thirty years is new to this company, this crew, this site and this client's rules, and a disproportionate share of serious incidents happen to people in their first few months on a job regardless of how long they have held a ticket. Being experienced and being familiar are different things, and only one of them is protective.",
          },
          {
            type: "paragraph",
            text: `${company} maintains this program because its clients require it and because the reasoning behind it is sound. It is a commitment the Company makes, not a legal obligation it is describing.`,
          },
        ],
      },
      {
        heading: "Being Identifiable on Site",
        blocks: [
          {
            type: "paragraph",
            text: `A short service employee is identifiable at a glance for the whole period. ${company} uses:`,
          },
          { type: "paragraph", text: IDENTIFICATION[answers[Q.identification]] },
          {
            type: "paragraph",
            text: "The point is that somebody who is not on their crew — a client's operator, another contractor, a supervisor walking past — can see it and adjust what they do. Identification that only the Company's own supervisors understand achieves nothing.",
          },
          {
            type: "paragraph",
            text: "The marking is not a demerit and is not treated as one. Anybody who uses it to single somebody out is dealt with under the Company's accountability program.",
          },
        ],
      },
      {
        heading: "Mentors",
        blocks: [
          {
            type: "paragraph",
            text: "Each short service employee is assigned a mentor by name before their first shift. Being assigned a crew is not being assigned a mentor.",
          },
          { type: "paragraph", text: ratio },
          {
            type: "paragraph",
            text: "A mentor is somebody who has been with the Company well beyond the short service period, knows the work, and is willing to do it. Being the most senior person available is not the qualification.",
          },
          {
            type: "paragraph",
            text: "The mentor:",
          },
          {
            type: "bullets",
            items: [
              "Works within sight and voice of the short service employee, and does not send them off alone",
              "Goes through the job plan with them before each task rather than telling them to follow along",
              "Watches how the work is actually done and corrects it as it happens",
              "Answers questions without making the person feel foolish for asking — a mentor who does that gets asked nothing, and the arrangement stops working",
              "Tells the supervisor when the person is ready for less supervision, and when they are not",
            ],
          },
          {
            type: "paragraph",
            text: "Where the mentor is absent, the supervisor assigns another mentor for that shift or the short service employee does not work that shift. Nobody works unmentored because their mentor called in sick.",
          },
        ],
      },
      {
        heading: "What a Short Service Employee Does Not Do",
        blocks: [
          {
            type: "paragraph",
            text: "During the period, a short service employee does not:",
          },
          {
            type: "bullets",
            items: [
              "Work alone, or out of sight of their mentor",
              "Act as a permit holder, a fire watch, a confined space attendant, or any other role where somebody else's safety depends on them",
              "Operate equipment they have not been assessed on for this Company",
              "Supervise anybody, or act as a lead",
              "Mentor another short service employee",
            ],
          },
          {
            type: "paragraph",
            text: "They take part in everything else. The program limits what somebody carries alone; it does not sideline them, and a short service employee who spends their first months fetching materials has learned nothing when the period ends.",
          },
        ],
      },
      {
        heading: "Before the First Shift",
        blocks: [
          {
            type: "paragraph",
            text: "Before a short service employee starts, the supervisor confirms all of the following:",
          },
          {
            type: "numbered",
            items: [
              "They have been through the Company's induction and the safety programs their work touches.",
              "They have been through the client's site orientation where the site requires one.",
              "They have the protective equipment their work needs, fitted and explained.",
              "A mentor is assigned by name, is on shift, and knows they hold the role.",
              "They know they may stop work over any concern, and that nobody will be annoyed with them for it.",
              "They know who to ask, and that asking is expected rather than tolerated.",
            ],
          },
          {
            type: "paragraph",
            text: "The last two matter most. A new person who is unsure and does not want to look inexperienced will guess, and guessing is what the whole program exists to prevent.",
          },
        ],
      },
      {
        heading: "Coming Off Short Service",
        blocks: [
          {
            type: "paragraph",
            text: `At the end of the ${period}, the supervisor and the mentor together confirm the person is ready to work without a mentor. Reaching the date is not by itself the decision.`,
          },
          {
            type: "paragraph",
            text: "Where either of them is not satisfied, the period is extended and the reason is recorded. An extension is not a mark against anybody — it is the program working.",
          },
          {
            type: "paragraph",
            text: `The ${role} records the date somebody comes off the list, and the identification is removed at that point rather than left on.`,
          },
        ],
      },
    ];

    if (experienced) {
      body.push({
        heading: "Shortening the Period",
        blocks: [
          {
            type: "paragraph",
            text: `Where somebody joins with directly relevant experience, the ${role} may shorten the period. It is never removed entirely, and it is never shortened by a supervisor who needs the person on a crew this week.`,
          },
          {
            type: "paragraph",
            text: "The decision is written down before it takes effect, and records what the experience is, how it was verified, how long the period will be instead, and who decided. A verbal decision made on a Monday morning is not a decision this program allows.",
          },
          {
            type: "paragraph",
            text: "Where a client requires the full period regardless, the client's requirement applies and nothing is shortened for work on their site.",
          },
        ],
      });
    }

    if (newSite) {
      body.push({
        heading: "New to the Site, Not New to the Company",
        blocks: [
          {
            type: "paragraph",
            text: `An employee who is past their short service period but is going to a site or a process area they have not worked in before is treated as new to that site. They work with somebody familiar with it until they have been through the site's own hazards, layout, alarms, muster points and rules.`,
          },
          {
            type: "paragraph",
            text: "That is a short clock rather than a second full period — days rather than months — but it is not skipped. Site orientation tells somebody the rules; it does not make them familiar with the place.",
          },
        ],
      });
    }

    body.push({
      heading: "The List",
      blocks: [
        {
          type: "paragraph",
          text: `The ${role} keeps a current list of who is short service, when their period started, when it ends, and who their mentor is. It is kept at: ${records}.`,
        },
        {
          type: "paragraph",
          text: "Clients commonly ask for this list, and some require notice before a short service employee is sent to their site. The supervisor establishes what a client requires before the crew is scheduled rather than at the gate.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company looks after people in their first months with it: how long they are treated as short service, how they are identified on site, who mentors them, and what they do not do alone during that time.",
      policy: `It is the policy of ${company} that somebody new to the Company works alongside somebody who is not, for ${period}, however long they have worked in the trade.`,
      scopeNote:
        "It applies to every new employee, and to anybody returning after a long absence from this kind of work.",
      body,
      trainingPoints: [
        "That everybody is short service at first, and that it is not a comment on anybody's ability",
        "That being experienced in the trade is not the same as being familiar with this company, crew or site",
        "Who your mentor is, by name, and that you work within sight and voice of them",
        "What a short service employee does not do alone",
        "That asking a question is expected, and that guessing is the thing the program exists to prevent",
        "That you may stop work over a concern from your first shift",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through assigning mentors by name before a first shift, keeping to the ratio when a crew is short-handed, and confirming readiness at the end of a period rather than letting the date decide.",
      reviewTrigger:
        "The review checks that the ratio held on real crews rather than only on the list, since the pressure to breach it comes exactly when the Company is busiest.",
    });
  },
};
