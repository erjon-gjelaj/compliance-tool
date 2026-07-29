import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * Emergency Action Plan.
 *
 * This template is deliberately site-specific. It never invents a workplace,
 * an alarm, an escape route, or an assembly point: those facts all come from
 * answers and the assembly gate refuses a document when one is absent.
 *
 * The document records company policy, not a conclusion that a particular
 * standard applies. `sourceRef` is internal maintenance metadata and is never
 * printed.
 */

const Q = {
  site: "covered_site",
  emergencies: "anticipated_emergencies",
  coordinator: "coordinator_role",
  reporting: "alarm_and_reporting",
  routes: "evacuation_routes",
  muster: "muster_point",
  critical: "critical_operations",
  medical: "rescue_medical",
} as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
};

const MEDICAL_PARAGRAPHS: Record<string, string> = {
  outside:
    "Employees do not enter or re-enter a danger area to perform rescue. Fire, rescue, and emergency medical duties are left to the public or site emergency services called under this plan. Employees may provide only the assistance they can give without entering the danger area.",
  first_aid:
    "Rescue inside a danger area is left to the public or site emergency services. Employees separately designated and qualified by the company may provide first aid from a safe location while emergency medical services are on the way; this plan does not itself designate or qualify any employee.",
  site_team:
    "Rescue and emergency medical duties are turned over to the site's designated emergency response team. Other employees evacuate, report what they know, and do not re-enter until the site authority gives permission.",
};

function role(answers: Answers): string {
  const selected = answers[Q.coordinator];
  return ROLE_LABELS[selected] ?? selected;
}

export const EMERGENCY_ACTION_PLAN: ProgramTemplate = {
  id: "emergency_action_plan",
  title: "Emergency Action Plan",
  shortName: "Emergency Action Plan",
  requirementId: "emergency-action-plan",
  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) => /^emergency action plan$/i.test(label.trim()),

  questions: [
    {
      id: Q.site,
      prompt: "Which workplace or job site does this plan cover?",
      help: "Use the site name and address, or another description your crew will recognise.",
      kind: "text",
      required: true,
    },
    {
      id: Q.emergencies,
      prompt: "Which emergencies could lead to an evacuation or shelter instruction there?",
      help: "For example: fire, chemical release, severe weather, gas leak, or another site-specific event.",
      kind: "text",
      required: true,
    },
    {
      id: Q.coordinator,
      prompt: "Who coordinates this plan and answers questions about it?",
      help: "Choose a role rather than a person's name.",
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
      id: Q.reporting,
      prompt: "How are emergencies reported, and what signal tells the crew to act?",
      help: "Include the reporting route and the alarm, announcement, or host-site signal employees follow.",
      kind: "text",
      required: true,
    },
    {
      id: Q.routes,
      prompt: "Which evacuation routes and exits should the crew use?",
      help: "Describe the primary route and what employees do if it is blocked.",
      kind: "text",
      required: true,
    },
    {
      id: Q.muster,
      prompt: "Where does the crew assemble after evacuating?",
      help: "Give a precise muster point away from the hazard and emergency access routes.",
      kind: "text",
      required: true,
    },
    {
      id: Q.critical,
      prompt: "Who, if anyone, stays briefly for critical shutdown work, and what do they do?",
      help: 'If nobody remains, write "No one; everyone evacuates immediately."',
      kind: "text",
      required: true,
    },
    {
      id: Q.medical,
      prompt: "Who handles rescue and emergency medical duties?",
      kind: "choice",
      required: true,
      options: [
        { id: "outside", label: "Public or site emergency services" },
        { id: "first_aid", label: "Emergency services, with designated first-aid providers" },
        { id: "site_team", label: "The site's emergency response team" },
      ],
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const coordinator = role(answers);
    const site = answers[Q.site].trim();
    const emergencies = answers[Q.emergencies].trim();
    const reporting = answers[Q.reporting].trim();
    const routes = answers[Q.routes].trim();
    const muster = answers[Q.muster].trim();
    const critical = answers[Q.critical].trim();

    return [
      {
        heading: "Purpose, Scope, and Availability",
        sourceRef: "1910.38(a)-(b)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} maintains this Emergency Action Plan to organise a safe and orderly response by its employees at ${site}. It applies while company employees are working at that location.`,
          },
          {
            type: "paragraph",
            text: "A current copy is kept available to covered employees at the workplace. Site instructions take precedence when the host or emergency authority directs a different immediate action.",
          },
        ],
      },
      {
        heading: "Anticipated Emergencies",
        sourceRef: "1910.38(c)",
        blocks: [
          {
            type: "paragraph",
            text: `This plan addresses the following emergencies identified for the covered workplace: ${emergencies}.`,
          },
          {
            type: "paragraph",
            text: "Employees follow the alarm or instruction given for the event. They do not delay evacuation to collect personal items, investigate an unknown condition, or carry out work that is not assigned in this plan.",
          },
        ],
      },
      {
        heading: "Plan Coordination and Responsibilities",
        sourceRef: "1910.38(c)(6)",
        blocks: [
          {
            type: "paragraph",
            text: `The ${coordinator} coordinates this plan and is the job title employees contact for more information or an explanation of their duties.`,
          },
          {
            type: "paragraph",
            text: "Supervisors communicate the site arrangements before work begins, keep their work groups together where practical, direct evacuation, and report their group status at the assembly point.",
          },
          {
            type: "paragraph",
            text: "Employees report emergencies promptly, follow the applicable signal and route, assist others only when it is safe and within their assigned role, and remain at the assembly point until accounted for and released.",
          },
        ],
      },
      {
        heading: "Reporting and Employee Alarm",
        sourceRef: "1910.38(c)(1), (d)",
        blocks: [
          {
            type: "paragraph",
            text: `At this workplace, emergencies are reported and employees are alerted as follows: ${reporting}.`,
          },
          {
            type: "paragraph",
            text: "An employee who discovers an emergency uses the stated reporting route from a safe location, gives the nature and location of the emergency, and follows the instructions received. Employees treat the identified emergency signal as an instruction to act immediately.",
          },
        ],
      },
      {
        heading: "Evacuation Routes and Conduct",
        sourceRef: "1910.38(c)(2)",
        blocks: [
          {
            type: "paragraph",
            text: `The evacuation routes and exit arrangements for the covered workplace are: ${routes}.`,
          },
          {
            type: "paragraph",
            text: "Employees use the nearest safe assigned route, walk without running, keep exits and emergency access clear, and do not use a route affected by smoke, fire, a release, structural damage, or another visible hazard. If the primary route is unsafe, they use the alternate arrangement stated above or follow the site authority's direction.",
          },
          {
            type: "paragraph",
            text: "Nobody re-enters the evacuated area until the host, incident commander, fire department, or other authority controlling the emergency states that it is safe.",
          },
        ],
      },
      {
        heading: "Critical Operations Before Evacuation",
        sourceRef: "1910.38(c)(3)",
        blocks: [
          {
            type: "paragraph",
            text: `The arrangement for employees who might remain briefly to operate or shut down critical equipment is: ${critical}.`,
          },
          {
            type: "paragraph",
            text: "No employee remains behind unless the role and action are expressly included in that arrangement, conditions allow the action to be completed safely, and an escape route remains available. Anyone not assigned that duty evacuates immediately.",
          },
        ],
      },
      {
        heading: "Assembly and Accounting",
        sourceRef: "1910.38(c)(4)",
        blocks: [
          {
            type: "paragraph",
            text: `After evacuation, employees report directly to: ${muster}. They remain there, keep access routes clear, and do not leave until their status has been recorded or a supervisor releases them.`,
          },
          {
            type: "paragraph",
            text: `The ${coordinator} coordinates the headcount. Supervisors account for the employees and known visitors assigned to their work groups and promptly report anyone missing, last known locations, and any known injuries to the coordinator and emergency authority. Nobody re-enters to search for a missing person.`,
          },
        ],
      },
      {
        heading: "Rescue and Emergency Medical Duties",
        sourceRef: "1910.38(c)(5)",
        blocks: [
          {
            type: "paragraph",
            text: MEDICAL_PARAGRAPHS[answers[Q.medical]],
          },
          {
            type: "paragraph",
            text: "A person calling for assistance gives the site location, nature of the emergency, number and condition of injured people if known, and a safe location where responders can be met.",
          },
        ],
      },
      {
        heading: "Plan Communication and Review",
        sourceRef: "1910.38(e)-(f)",
        blocks: [
          {
            type: "paragraph",
            text: `The ${coordinator} arranges review of this plan with covered employees when it is adopted, when an employee is first assigned at the covered workplace, when an employee's duties under it change, and when the plan changes.`,
          },
          {
            type: "paragraph",
            text: "Employees designated to assist with an evacuation receive separate instruction for that role before assignment. This plan does not itself record that any named employee has completed instruction or is qualified for rescue, medical, or emergency-response duties.",
          },
          {
            type: "paragraph",
            text: `The ${coordinator} reviews the plan after an emergency or drill and whenever the workplace, alarm, routes, assembly point, personnel, or anticipated emergencies change. The revision date and version number on the cover record the current edition.`,
          },
        ],
      },
    ];
  },
};
