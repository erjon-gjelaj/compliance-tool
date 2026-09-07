import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * The Emergency Action Plan.
 *
 * Written by hand in this repo and assembled deterministically, as HazCom and
 * PPE are. The voice is the company's own throughout, and nothing here tells
 * the reader what the law obliges them to do. `sourceRef` records which
 * element of 29 CFR 1910.38 a section covers, for our maintenance only, and is
 * never printed.
 *
 * ## Why this one is built around a table
 *
 * `lib/requirements` says of this requirement: "Site-specific detail is
 * usually what gets it sent back." That is the whole problem with an
 * emergency plan written for a subcontractor. Most of their work happens on
 * somebody else's site, where the host's alarm, the host's exits and the
 * host's muster point govern — so a plan describing "our evacuation route" is
 * describing a building the crew will not be standing in.
 *
 * A generic plan cannot be made site-specific by writing more prose. It is
 * made site-specific by carrying a record that gets completed per job, before
 * work starts. So this document ends with a Site Emergency Record: a table
 * with a row per site, deliberately blank, and a commitment that it is filled
 * in during site orientation. That blank table is the most useful thing in
 * the document, and it is the reason the plan can be honest about not knowing
 * the muster point of a refinery it has never been to.
 *
 * ## What it never asserts
 *
 * That anybody has been trained, that alarms have been tested, or that any
 * particular site's arrangements are known. Each is a fact about a given day
 * that a questionnaire cannot establish.
 */

/** Answer ids, so the template and the questions cannot drift apart. */
const Q = {
  responsible: "responsible_role",
  ownPremises: "own_premises",
  premisesMuster: "premises_muster",
  hostSites: "host_sites",
  accounting: "accounting",
  alarm: "alarm",
  rescueDuties: "rescue_duties",
} as const;

const RESPONSIBLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
};

function responsibleRole(answers: Answers): string {
  const chosen = answers[Q.responsible];
  return RESPONSIBLE_LABELS[chosen] ?? chosen;
}

/**
 * How the company accounts for its people once everyone is out.
 *
 * This is the element most often missing from a subcontractor's plan, and the
 * one a host employer cares about most: the site can evacuate perfectly and
 * still not know whether a visiting crew of four is all present.
 */
const ACCOUNTING_SENTENCE: Record<string, string> = {
  supervisor_headcount:
    "The supervisor of each crew accounts for their own people by name at the assembly point. The count is by name against the crew assigned that day, not by headcount alone, so that a person who left early is not mistaken for a person still inside.",
  sign_in:
    "The sign-in record for the site is used to establish who was present. The supervisor of each crew then accounts for their people by name against that record at the assembly point, so that a person who left early is not mistaken for a person still inside.",
  phone_roll:
    "The supervisor of each crew calls each of their people in turn and records who has answered. Anyone not accounted for by name is reported immediately, so that a person who left early is not mistaken for a person still inside.",
};

const ALARM_SENTENCE: Record<string, string> = {
  site_alarm:
    "On sites that operate their own alarm or public address system, that system is the alarm. The signal it uses, and what it means, are established during site orientation and recorded for that site.",
  air_horn:
    "The Company carries an air horn to each work location. A sustained blast is the signal to stop work and evacuate. Where a site operates its own alarm, the site's alarm takes precedence and the horn is used only where the site has none.",
  radio:
    "Crews stay in contact by two-way radio, and the instruction to stop work and evacuate is given over it. Where a site operates its own alarm, that alarm takes precedence.",
  verbal:
    "Crews work within sight and hearing of their supervisor, and the instruction to stop work and evacuate is given verbally and passed on by each person to the next. Where a site operates its own alarm, that alarm takes precedence.",
};

export const EAP: ProgramTemplate = {
  id: "emergency_action_plan",
  title: "Emergency Action Plan",
  shortName: "Emergency Action Plan",
  requirementId: "emergency-action-plan",

  /*
   * Not offered until somebody reviews the prose. Same rule as every other
   * programme (docs/release-one.md): the flag is lifted per programme, by a
   * person, and the lift is recorded here with a date. HazCom and PPE both
   * carry that record; this one does not yet.
   */
  release: "internal_testing",
  templateVersion: "1.0.0",

  matchesLabel: (label) => /^emergency action plan$/i.test(label.trim()),

  /*
   * Seven questions, one conditional.
   *
   * What is deliberately NOT asked: the details of any particular site. There
   * is no form that can capture the muster point of every refinery a crew
   * might be sent to, and a plan that named three of them would be silent
   * about the fourth. The site record at the end of the document is where
   * that lives, filled in per job.
   */
  questions: [
    {
      id: Q.responsible,
      prompt: "Who looks after this plan day to day?",
      help: "A role rather than a name, so it stays right when people change.",
      kind: "choice",
      required: true,
      options: [
        { id: "owner", label: "The owner" },
        { id: "safety_manager", label: "A safety manager" },
        { id: "supervisor", label: "A site supervisor" },
        { id: "operations_manager", label: "An operations manager" },
      ],
    },
    {
      id: Q.ownPremises,
      prompt: "Do you have your own yard, shop, or office where crew report?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.premisesMuster,
      prompt: "Where do people assemble if they have to leave it?",
      help: "For example: the far end of the parking lot, by the gate.",
      kind: "text",
      required: true,
      showWhen: (answers) => answers[Q.ownPremises] === "yes",
    },
    {
      id: Q.hostSites,
      prompt: "Do your crews work on sites run by a client?",
      help: "Plant, refinery, utility, or another contractor's site.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.alarm,
      prompt: "How does the word to evacuate reach your crew?",
      kind: "choice",
      required: true,
      options: [
        { id: "site_alarm", label: "The site's own alarm or PA system" },
        { id: "air_horn", label: "An air horn or whistle we carry" },
        { id: "radio", label: "Two-way radio" },
        { id: "verbal", label: "Passed on verbally — crews work close together" },
      ],
    },
    {
      id: Q.accounting,
      prompt: "Once everyone is out, how do you know nobody is missing?",
      help: "This is the part a host employer asks about most.",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisor_headcount", label: "Each supervisor accounts for their own crew by name" },
        { id: "sign_in", label: "We check against the site sign-in sheet" },
        { id: "phone_roll", label: "We call round by phone" },
      ],
    },
    {
      id: Q.rescueDuties,
      prompt: "Do any of your people have first aid or rescue duties assigned to them?",
      kind: "boolean",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const ownPremises = answers[Q.ownPremises] === "yes";
    const premisesMuster = (answers[Q.premisesMuster] ?? "").trim();
    const hostSites = answers[Q.hostSites] === "yes";
    const rescueDuties = answers[Q.rescueDuties] === "yes";

    const sections: Section[] = [
      {
        heading: "Purpose and Policy",
        sourceRef: "1910.38(a)",
        blocks: [
          {
            type: "paragraph",
            text: `This Emergency Action Plan sets out what employees of ${company} do when an emergency requires them to stop work and leave the area, wherever that work is taking place.`,
          },
          {
            type: "paragraph",
            text: `It is the policy of ${company} that no task is worth an injury, and that any employee may stop work and leave for a place of safety without waiting for permission. Nobody is questioned or disciplined for evacuating in good faith, including where it later turns out there was no emergency.`,
          },
        ],
      },
      {
        heading: "Scope",
        sourceRef: "1910.38(a)",
        blocks: [
          {
            type: "paragraph",
            text: `This plan applies to every employee of ${company}, at every location where the Company performs work.`,
          },
          {
            type: "paragraph",
            text: `Much of the work of ${company} is carried out at locations the Company does not control. Where that is so, the arrangements of the site govern the alarm, the exit routes, and the place of assembly. This plan does not replace them. It sets out how ${company} finds out what those arrangements are, how its employees are told, and how the Company accounts for its own people once they are outside.`,
          },
        ],
      },
      {
        heading: "Who to Ask About This Plan",
        sourceRef: "1910.38(c)(6)",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} is responsible for this plan. Any employee who wants more information about it, or an explanation of what it asks of them, asks the ${role}.`,
          },
        ],
      },
      {
        heading: "Reporting an Emergency",
        sourceRef: "1910.38(c)(1)",
        blocks: [
          {
            type: "paragraph",
            text: "An employee who discovers a fire, a release, a serious injury, or any other emergency:",
          },
          {
            type: "numbered",
            items: [
              "Raises the alarm by the means described below, so that everyone in the area knows to leave",
              "Calls, or has somebody call, the emergency number for that location — 911 where no site-specific number applies",
              "Notifies site control or the host employer's contact where working on a site run by somebody else",
              `Notifies the ${role}`,
            ],
          },
          {
            type: "paragraph",
            text: "Raising the alarm comes before making the call. An employee is never expected to fight a fire, contain a release, or enter an area to reach a casualty.",
          },
        ],
      },
      {
        heading: "How the Alarm Reaches the Crew",
        sourceRef: "1910.38(d)",
        blocks: [
          { type: "paragraph", text: ALARM_SENTENCE[answers[Q.alarm]] },
          {
            type: "paragraph",
            text: "Whatever the means, the signal to evacuate is distinct from any other signal used on that job, and every employee is told what it sounds like before they begin work there.",
          },
        ],
      },
      {
        heading: "Evacuation",
        sourceRef: "1910.38(c)(2)",
        blocks: [
          {
            type: "paragraph",
            text: "On hearing the signal, employees stop work, make equipment safe only where doing so takes seconds and does not delay them, leave by the nearest safe route, and go directly to the assembly point for that location.",
          },
          {
            type: "paragraph",
            text: "Employees do not return to collect tools or personal belongings, and do not re-enter for any reason until the person in charge of the location says it is safe to do so.",
          },
        ],
      },
    ];

    if (ownPremises) {
      sections.push({
        heading: "Company Premises",
        sourceRef: "1910.38(c)(2)",
        blocks: [
          {
            type: "paragraph",
            text: `At premises operated by ${company}, employees leave by the nearest exit and assemble at: ${premisesMuster}.`,
          },
          {
            type: "paragraph",
            text: `The ${role} keeps exit routes clear and unobstructed, and makes sure that every employee who reports to these premises knows the route out and the assembly point.`,
          },
        ],
      });
    }

    if (hostSites) {
      sections.push({
        heading: "Sites Run by a Client or Host Employer",
        sourceRef: "1910.38(c)(2)",
        blocks: [
          {
            type: "paragraph",
            text: `On a site run by somebody else, that site's emergency arrangements apply to ${company} employees exactly as they apply to everyone else on it.`,
          },
          {
            type: "paragraph",
            text: `Before work begins at such a site, the supervisor for that job establishes, from the host employer's orientation or from site control:`,
          },
          {
            type: "bullets",
            items: [
              "What the alarm signal is, and how it differs from any other signal used on the site",
              "Which exit routes apply to the area the crew will be working in",
              "Where the assembly point is, and any alternative used when wind direction makes the first unusable",
              "Who the site's emergency contact is, and how they are reached",
              "Any site-specific hazard that changes how an area is left, such as a process unit or a confined space",
            ],
          },
          {
            type: "paragraph",
            text: `That information is recorded in the Site Emergency Record at the end of this plan and is passed to every ${company} employee working there before they start. Where a crew moves to a different area of a large site, the supervisor confirms whether the routes and assembly point change with it.`,
          },
        ],
      });
    }

    sections.push({
      heading: "Accounting for Employees",
      sourceRef: "1910.38(c)(3)",
      blocks: [
        {
          type: "paragraph",
          text: `${company} accounts for its own employees after every evacuation, whether or not the site also does so.`,
        },
        { type: "paragraph", text: ACCOUNTING_SENTENCE[answers[Q.accounting]] },
        {
          type: "paragraph",
          text: `Anybody not accounted for is reported immediately to the person in charge of the location, and to the emergency services if they are present. No ${company} employee re-enters to look for them.`,
        },
      ],
    });

    sections.push({
      heading: "Shutting Down Equipment",
      sourceRef: "1910.38(c)(4)",
      blocks: [
        {
          type: "paragraph",
          text: `Where a task involves equipment that cannot simply be left running, how it is to be made safe is planned before work begins and is recorded for that job. No employee of ${company} remains behind to shut down equipment unless that plan names the task, the person, and their own route out.`,
        },
        {
          type: "paragraph",
          text: "In every other case, equipment is left as it stands and the area is evacuated.",
        },
      ],
    });

    if (rescueDuties) {
      sections.push({
        heading: "Rescue and Medical Duties",
        sourceRef: "1910.38(c)(5)",
        blocks: [
          {
            type: "paragraph",
            text: `Certain ${company} employees have first aid or rescue duties assigned to them. Those duties, and who holds them, are recorded for each job alongside the site information at the end of this plan.`,
          },
          {
            type: "paragraph",
            text: "An employee with such duties acts only within what they have been prepared and equipped for, and only where doing so does not put them in the area being evacuated. Nobody is expected to enter a hazardous atmosphere, a confined space, or a fire to perform a rescue.",
          },
        ],
      });
    }

    sections.push({
      heading: "Instruction in This Plan",
      sourceRef: "1910.38(e)",
      blocks: [
        {
          type: "paragraph",
          text: `${company} goes through this plan with an employee before they are first assigned work, when their duties under it change, and when the plan itself changes.`,
        },
        {
          type: "paragraph",
          text: `Site-specific arrangements are separate from that, and are given at the site before work starts there. An employee who has been through this plan has not thereby been told the muster point of a site they have never visited.`,
        },
        {
          type: "paragraph",
          text: `The ${role} records who was taken through the plan, and on what date.`,
        },
      ],
    });

    sections.push({
      heading: "Site Emergency Record",
      sourceRef: "1910.38(c)(2)",
      blocks: [
        {
          type: "paragraph",
          text: "This is the part of the plan that makes it apply to the job in hand. A row is completed for each site before work begins there, from the host employer's orientation, and is gone through with the crew working on it.",
        },
        {
          type: "table",
          head: [
            "Site / area",
            "Alarm signal",
            "Exit route",
            "Assembly point",
            "Site emergency contact",
            "Confirmed on",
          ],
          rows: [
            ["", "", "", "", "", ""],
            ["", "", "", "", "", ""],
            ["", "", "", "", "", ""],
            ["", "", "", "", "", ""],
          ],
        },
        {
          type: "paragraph",
          text: `A blank row is not an oversight. ${company} does not know the arrangements of a site it has not yet been given, and this plan does not pretend otherwise — the row is completed on arrival, before any work starts.`,
        },
      ],
    });

    sections.push(
      {
        heading: "Availability of This Plan",
        sourceRef: "1910.38(b)",
        blocks: [
          {
            type: "paragraph",
            text: `This plan is kept in writing and is available to any employee, or their designated representative, on request. A copy travels with each crew to the site they are working on, together with the completed record for that site.`,
          },
        ],
      },
      {
        heading: "Review and Revision",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} reviews this plan at least annually, whenever the work of ${company} changes in a way that affects it, and after any evacuation — whether real or a drill — that showed something in it did not work.`,
          },
          {
            type: "paragraph",
            text: "The revision date and version number on the cover of this document record when it was last reviewed.",
          },
        ],
      },
    );

    return sections;
  },
};
