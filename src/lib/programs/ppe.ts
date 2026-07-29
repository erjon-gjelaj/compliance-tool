import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * Personal Protective Equipment programme.
 *
 * Like the HazCom template, this is hand-written company policy assembled
 * without a model. Facts about the company appear only where an answer
 * supplies them. In particular, the template does not claim that anybody has
 * completed training or that the company owns a particular item of equipment.
 */

const Q = {
  responsible: "responsible_role",
  assessment: "assessment_process",
  provided: "ppe_provided",
  issue: "issue_method",
  inspection: "inspection_method",
  shared: "shared_ppe",
  replacement: "replacement_method",
} as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
};

const ASSESSMENT_SENTENCES: Record<string, string> = {
  each_job:
    "A PPE hazard assessment is completed before work begins on each new job or at each new work location.",
  task_based:
    "PPE hazard assessments are maintained by task and are reviewed against the conditions at each job before work begins.",
  both:
    "PPE hazard assessments are maintained by task, reviewed against each job before work begins, and supplemented when the site presents a hazard the task assessment does not cover.",
};

const ISSUE_SENTENCES: Record<string, string> = {
  central:
    "Required PPE is issued from a central stock before the employee begins the affected work.",
  supervisor:
    "The supervisor for the job issues the PPE identified by the assessment before the affected work begins.",
  mixed:
    "Standard PPE is issued from central stock, and the job supervisor supplies any additional PPE identified for the particular task or site.",
};

const INSPECTION_SENTENCES: Record<string, string> = {
  before_use:
    "Employees inspect PPE before each use, and the responsible role checks its condition during routine job observations.",
  scheduled:
    "Employees inspect PPE before each use, and the responsible role also performs and records scheduled inspections.",
  manufacturer:
    "Employees inspect PPE before each use, with additional inspections performed at the intervals and in the manner stated by the equipment manufacturer.",
};

const REPLACEMENT_SENTENCES: Record<string, string> = {
  supervisor:
    "An employee reports damaged, defective, contaminated, or worn PPE to the job supervisor, who removes it from service and arranges repair or replacement.",
  responsible:
    "An employee reports damaged, defective, contaminated, or worn PPE to the responsible role, who removes it from service and arranges repair or replacement.",
  exchange:
    "Damaged, defective, contaminated, or worn PPE is taken out of service and exchanged through the company's equipment issue point.",
};

function role(answers: Answers): string {
  const selected = answers[Q.responsible];
  return ROLE_LABELS[selected] ?? selected;
}

export const PPE: ProgramTemplate = {
  id: "personal_protective_equipment",
  title: "Personal Protective Equipment Program",
  shortName: "Personal Protective Equipment",
  requirementId: "ppe",
  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^personal protective equipment (program|programme)$/i.test(label.trim()),

  questions: [
    {
      id: Q.responsible,
      prompt: "Who looks after PPE assessments and this program?",
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
      id: Q.assessment,
      prompt: "How do you assess which PPE a job needs?",
      kind: "choice",
      required: true,
      options: [
        { id: "each_job", label: "A separate assessment for each job or site" },
        { id: "task_based", label: "Assessments by task, checked at each job" },
        { id: "both", label: "Task assessments plus job-specific additions" },
      ],
    },
    {
      id: Q.provided,
      prompt: "What PPE do you provide when a job assessment calls for it?",
      help: "List categories, not brands or inventory counts. For example: hard hats, eye protection, gloves, hearing protection.",
      kind: "text",
      required: true,
    },
    {
      id: Q.issue,
      prompt: "How does required PPE reach the crew?",
      kind: "choice",
      required: true,
      options: [
        { id: "central", label: "Issued from a central stock" },
        { id: "supervisor", label: "Issued by the job supervisor" },
        { id: "mixed", label: "Standard issue plus job-specific equipment" },
      ],
    },
    {
      id: Q.inspection,
      prompt: "How is PPE checked for damage or wear?",
      kind: "choice",
      required: true,
      options: [
        { id: "before_use", label: "Before use and during job observations" },
        { id: "scheduled", label: "Before use plus recorded scheduled checks" },
        { id: "manufacturer", label: "Before use plus manufacturer intervals" },
      ],
    },
    {
      id: Q.shared,
      prompt: "Is any PPE used by more than one employee?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.replacement,
      prompt: "How does damaged or worn PPE get replaced?",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisor", label: "Reported to the job supervisor" },
        { id: "responsible", label: "Reported to the program owner" },
        { id: "exchange", label: "Exchanged at the equipment issue point" },
      ],
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const responsible = role(answers);
    const supplied = answers[Q.provided].trim();
    const shared = answers[Q.shared] === "yes";

    const sections: Section[] = [
      {
        heading: "Purpose and Policy",
        sourceRef: "1910.132(a); 1926.95(a)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} maintains this Personal Protective Equipment Program to identify workplace hazards that call for protective equipment and to set out how that equipment is selected, provided, used, inspected, cared for, and replaced.`,
          },
          {
            type: "paragraph",
            text: "The first means of protection is to remove or control a hazard where practical. PPE is used for hazards that remain, and it is selected for the task and the employee who will wear it.",
          },
        ],
      },
      {
        heading: "Scope",
        sourceRef: "1910.132(a); 1926.95(a)",
        blocks: [
          {
            type: "paragraph",
            text: `This program applies to employees of ${company} whose work may expose them to hazards capable of causing injury or impairment through contact, absorption, inhalation, or physical impact.`,
          },
        ],
      },
      {
        heading: "Responsibilities",
        sourceRef: "1910.132(d)-(f)",
        blocks: [
          {
            type: "paragraph",
            text: `The ${responsible} is responsible for maintaining this program, coordinating PPE hazard assessments, selecting suitable PPE, and arranging instruction and programme review.`,
          },
          {
            type: "paragraph",
            text: "Supervisors verify that the assessment for the work has been reviewed before the job starts, make required PPE available, and stop work when required PPE is missing, damaged, or being used incorrectly.",
          },
          {
            type: "paragraph",
            text: "Employees follow the assessment and instructions for their work, inspect PPE before use, use it as intended, care for it, and report loss, damage, contamination, poor fit, or a change in workplace conditions.",
          },
        ],
      },
      {
        heading: "PPE Hazard Assessment",
        sourceRef: "1910.132(d)",
        blocks: [
          { type: "paragraph", text: ASSESSMENT_SENTENCES[answers[Q.assessment]] },
          {
            type: "paragraph",
            text: `The ${responsible} records the workplace or task evaluated, the date of the assessment, the hazards identified, the PPE selected, and the person certifying the assessment. The assessment is reviewed when the work, equipment, materials, or site conditions change.`,
          },
          {
            type: "paragraph",
            text: "The assessment considers hazards to the eyes, face, head, feet, hands, hearing, respiratory system, and body, together with electrical, chemical, heat, impact, penetration, compression, and falling-object exposures where they are present.",
          },
        ],
      },
      {
        heading: "Selection and Provision",
        sourceRef: "1910.132(b), (d); 1926.95(b)-(d)",
        blocks: [
          {
            type: "paragraph",
            text: `Based on its assessments, ${company} provides the following categories of PPE when the work calls for them: ${supplied}. This statement identifies the categories the company makes available; the assessment for the actual task determines what is worn.`,
          },
          {
            type: "paragraph",
            text: "PPE is selected to protect against the identified hazard, to be compatible with other equipment worn at the same time, and to fit the employee properly. Selection follows the equipment manufacturer's instructions and the conditions of the work.",
          },
          { type: "paragraph", text: ISSUE_SENTENCES[answers[Q.issue]] },
        ],
      },
      {
        heading: "Use and Fit",
        sourceRef: "1910.132(d); 1926.95(c)",
        blocks: [
          {
            type: "paragraph",
            text: "Employees use the PPE identified for the task whenever the exposure is present. PPE is adjusted and worn in the manner covered by the manufacturer's instructions and the company's instruction for the task.",
          },
          {
            type: "paragraph",
            text: "An employee who cannot obtain a secure and usable fit, or whose PPE interferes with another item, stops and reports the problem so a different size, model, or combination can be selected.",
          },
        ],
      },
      {
        heading: "Inspection, Care, and Replacement",
        sourceRef: "1910.132(a); 1926.95(a), (c)",
        blocks: [
          { type: "paragraph", text: INSPECTION_SENTENCES[answers[Q.inspection]] },
          {
            type: "paragraph",
            text: "PPE is stored in a clean, dry location protected from damage, contamination, sunlight, extreme temperature, and other conditions that could impair it. Cleaning and maintenance follow the manufacturer's instructions.",
          },
          { type: "paragraph", text: REPLACEMENT_SENTENCES[answers[Q.replacement]] },
          {
            type: "paragraph",
            text: "Equipment removed from service is not returned to use until it has been repaired, cleaned, or replaced and found suitable for the work.",
          },
        ],
      },
    ];

    if (shared) {
      sections.push({
        heading: "Shared PPE",
        sourceRef: "1910.132(a); 1926.95(a)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} uses some PPE for more than one employee. Shared equipment is cleaned and, where appropriate, disinfected between users. Its condition and fit are checked before it is reissued, and personal items are not shared where doing so would create a hygiene or fit problem.`,
          },
        ],
      });
    }

    sections.push(
      {
        heading: "Instruction and Understanding",
        sourceRef: "1910.132(f)",
        blocks: [
          {
            type: "paragraph",
            text: `Before an employee is assigned to use PPE, the ${responsible} arranges instruction covering when PPE is needed, which PPE applies, how to put it on, adjust it, wear it and remove it, its limitations, and its proper care, maintenance, useful life, and disposal.`,
          },
          {
            type: "paragraph",
            text: "The employee demonstrates understanding and the ability to use the equipment before working under the programme. Instruction is repeated when workplace changes, equipment changes, or observed use shows that the employee no longer has the necessary understanding or skill.",
          },
          {
            type: "paragraph",
            text: "The company records the instruction it provides. This programme does not itself serve as a record that any named employee has completed instruction.",
          },
        ],
      },
      {
        heading: "Review and Revision",
        blocks: [
          {
            type: "paragraph",
            text: `The ${responsible} reviews this program and its assessments at least annually and whenever the work, hazards, equipment, or experience of ${company} shows that a change is needed.`,
          },
          {
            type: "paragraph",
            text: "The revision date and version number on the cover record when this document was last reviewed.",
          },
        ],
      },
    );

    return sections;
  },
};
