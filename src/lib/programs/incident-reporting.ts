import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * Incident Reporting and Investigation Program.
 *
 * This is an internal company procedure. It does not decide whether an event
 * is recordable or externally reportable, and it does not print a reporting
 * deadline whose applicability depends on facts outside the questionnaire.
 *
 * Customer-specific facts appear only from confirmed answers. The remaining
 * prose is the policy the company adopts: report without retaliation, care
 * for people first, preserve evidence without obstructing emergency work,
 * investigate systems rather than assign blame, and close corrective actions.
 */

const Q = {
  firstContact: "first_contact_role",
  route: "reporting_route",
  hostSites: "host_sites",
  investigator: "investigator_role",
  correctiveOwner: "corrective_owner_role",
  records: "records_location",
} as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
};

const ROUTE_SENTENCES: Record<string, string> = {
  direct:
    "Employees report directly to the first-contact role in person or by voice call as soon as they can do so safely.",
  phone_text:
    "Employees call or text the first-contact role as soon as they can do so safely, then provide the written details requested for the investigation.",
  form:
    "Employees notify the first-contact role as soon as they can do so safely and complete the company's incident report form when immediate conditions are under control.",
};

function role(answers: Answers, id: string): string {
  const selected = answers[id];
  return ROLE_LABELS[selected] ?? selected;
}

export const INCIDENT_REPORTING: ProgramTemplate = {
  id: "incident_reporting_investigation",
  title: "Incident Reporting and Investigation Program",
  shortName: "Incident Reporting and Investigation",
  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^incident reporting and investigation (program|programme)$/i.test(
      label.trim(),
    ),

  questions: [
    {
      id: Q.firstContact,
      prompt: "Who should an employee tell first after an incident or near miss?",
      help: "Choose a role rather than a person's name.",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisor", label: "The site supervisor" },
        { id: "safety_manager", label: "The safety manager" },
        { id: "owner", label: "The owner" },
        { id: "operations_manager", label: "The operations manager" },
      ],
    },
    {
      id: Q.route,
      prompt: "How does the employee make the report?",
      kind: "choice",
      required: true,
      options: [
        { id: "direct", label: "In person or by voice call" },
        { id: "phone_text", label: "Call or text, followed by written details" },
        { id: "form", label: "Immediate notice, then a company report form" },
      ],
    },
    {
      id: Q.hostSites,
      prompt: "Does your crew work at customer or host-controlled sites?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.investigator,
      prompt: "Who leads incident investigations?",
      help: "This role gathers facts and coordinates the investigation.",
      kind: "choice",
      required: true,
      options: [
        { id: "safety_manager", label: "The safety manager" },
        { id: "supervisor", label: "The site supervisor" },
        { id: "owner", label: "The owner" },
        { id: "operations_manager", label: "The operations manager" },
      ],
    },
    {
      id: Q.correctiveOwner,
      prompt: "Who owns corrective actions until they are closed?",
      kind: "choice",
      required: true,
      options: [
        { id: "operations_manager", label: "The operations manager" },
        { id: "safety_manager", label: "The safety manager" },
        { id: "supervisor", label: "The site supervisor" },
        { id: "owner", label: "The owner" },
      ],
    },
    {
      id: Q.records,
      prompt: "Where are incident reports and investigation records kept?",
      help: "Name the office, filing system, or restricted company system.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const firstContact = role(answers, Q.firstContact);
    const investigator = role(answers, Q.investigator);
    const correctiveOwner = role(answers, Q.correctiveOwner);
    const records = answers[Q.records].trim();
    const hostSites = answers[Q.hostSites] === "yes";

    const sections: Section[] = [
      {
        heading: "Purpose and Policy",
        sourceRef: "1904.35(b)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} maintains this program so workplace injuries, illnesses, property damage, environmental events, and close calls or near misses are reported, examined, and used to prevent recurrence.`,
          },
          {
            type: "paragraph",
            text: "Care for people and control immediate danger come first. Reporting is encouraged and is not treated as an admission of fault. No employee is disciplined, discriminated against, or otherwise disadvantaged for making a good-faith report of a work-related injury, illness, hazard, incident, or near miss.",
          },
        ],
      },
      {
        heading: "What Employees Report",
        sourceRef: "1904.35(b)(1); OSHA Incident Investigation guidance",
        blocks: [
          {
            type: "paragraph",
            text: "Employees report work-related injuries and symptoms, occupational illnesses, exposures, first-aid events, vehicle or equipment damage, spills or releases, fires, and events that could reasonably have caused harm even when nobody was injured.",
          },
          {
            type: "paragraph",
            text: "An employee reports when they become aware of the event or recognize that symptoms may be work-related. Uncertainty about severity, work-relatedness, or whether a record is required is not a reason to withhold an internal report.",
          },
        ],
      },
      {
        heading: "Immediate Response and Internal Notification",
        sourceRef: "1904.35(b)(1)",
        blocks: [
          {
            type: "paragraph",
            text: "The first person aware of an incident calls for emergency assistance when needed, moves away from continuing danger, warns others, and provides aid only within their ability and assigned role.",
          },
          {
            type: "paragraph",
            text: ROUTE_SENTENCES[answers[Q.route]],
          },
          {
            type: "paragraph",
            text: `The first internal contact is the ${firstContact}. That role makes sure immediate care and hazard control are addressed, then promptly notifies the ${investigator} to begin the fact-finding process.`,
          },
        ],
      },
      {
        heading: "Scene Control and Evidence",
        sourceRef: "OSHA Incident Investigation guidance",
        blocks: [
          {
            type: "paragraph",
            text: `After emergency needs are addressed, the ${firstContact} limits access to the affected area where it is safe and practical to do so. Scene control never delays rescue, medical care, hazard isolation, or directions from emergency or site authorities.`,
          },
          {
            type: "paragraph",
            text: "Equipment, materials, photographs, documents, electronic data, and other evidence are preserved in their condition at the time of the event unless moving or changing them is necessary to protect people or prevent further damage. Any necessary change is recorded.",
          },
        ],
      },
      {
        heading: "Investigation Process",
        sourceRef: "OSHA Incident Investigation guidance",
        blocks: [
          {
            type: "paragraph",
            text: `The ${investigator} leads the investigation and involves employees, supervisors, witnesses, and people with relevant technical knowledge as appropriate. The purpose is to understand what happened and why, not to select a person to blame.`,
          },
          {
            type: "numbered",
            items: [
              "Confirm that immediate care and hazard controls are in place.",
              "Visit or document the scene and establish the sequence of events.",
              "Interview involved employees and witnesses separately, using open questions and recording their own accounts.",
              "Review relevant equipment, materials, procedures, job planning, supervision, communications, and prior reports.",
              "Identify immediate causes, contributing conditions, and underlying system or programme causes.",
              "Develop corrective actions that address the causes found and communicate relevant lessons to affected employees.",
            ],
          },
        ],
      },
      {
        heading: "Information Recorded",
        sourceRef: "OSHA Incident Investigation guidance",
        blocks: [
          {
            type: "paragraph",
            text: "The investigation record captures the date, time, location, people involved, work underway, event description, injury or damage known at the time, immediate response, witnesses, photographs or other evidence, sequence of events, contributing factors, underlying causes, and corrective actions.",
          },
          {
            type: "paragraph",
            text: "Facts are distinguished from assumptions. Medical information and personal details are limited to what the record needs and are handled only by people whose role requires access.",
          },
        ],
      },
    ];

    if (hostSites) {
      sections.push({
        heading: "Customer and Host-Site Coordination",
        blocks: [
          {
            type: "paragraph",
            text: `${company} performs work at customer or host-controlled sites. The ${firstContact} also follows the site's incident-notification and scene-control process and supplies the factual information requested by the authorised site contact.`,
          },
          {
            type: "paragraph",
            text: "A host-site report does not replace the company's internal report. Company employees cooperate with a joint investigation while company records and corrective actions remain under this program.",
          },
        ],
      });
    }

    sections.push(
      {
        heading: "External Reporting and Recordkeeping Review",
        sourceRef: "1904.39",
        blocks: [
          {
            type: "paragraph",
            text: `The ${investigator} immediately escalates a fatality, in-patient hospitalization, amputation, loss of an eye, or another potentially externally reportable event to the Owner. The Owner determines, using the facts of the event and current applicable requirements, whether and how it must be reported or recorded.`,
          },
          {
            type: "paragraph",
            text: "This program does not itself decide that a particular event is recordable or reportable and is not a substitute for the event-specific review. Internal investigation continues whether or not an external record or notification is required.",
          },
        ],
      },
      {
        heading: "Corrective Actions and Follow-Up",
        sourceRef: "OSHA Incident Investigation guidance",
        blocks: [
          {
            type: "paragraph",
            text: `The ${correctiveOwner} assigns each corrective action to a responsible role, sets a target date based on risk, tracks progress, and records closure. An interim control remains in place when a permanent correction cannot be completed immediately.`,
          },
          {
            type: "paragraph",
            text: "Closure means the action was implemented and its effectiveness was checked. An action that does not control the identified cause is revised or replaced rather than marked complete.",
          },
        ],
      },
      {
        heading: "Records and Program Review",
        blocks: [
          {
            type: "paragraph",
            text: `Incident reports, investigation materials, corrective-action records, and closure evidence are kept at: ${records}.`,
          },
          {
            type: "paragraph",
            text: `The ${investigator} reviews incident and near-miss trends and the ${correctiveOwner} reviews overdue or ineffective actions. This program is reviewed after a significant event and whenever experience shows that the reporting, investigation, or follow-up process should change.`,
          },
          {
            type: "paragraph",
            text: "The revision date and version number on the cover record the current edition.",
          },
        ],
      },
    );

    return sections;
  },
};
