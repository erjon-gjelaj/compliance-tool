import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * The Personal Protective Equipment programme.
 *
 * Written by hand in this repo and assembled deterministically, exactly as
 * HazCom is. No model runs at request time; the same answers produce the same
 * document twice.
 *
 * The voice is the company's own throughout ("the Company provides…"). Nothing
 * in this file tells the reader what the law obliges them to do — it is policy
 * the customer adopts and is bound by, which is what makes it permissible
 * under the project's regulatory output rules. `sourceRef` records which
 * element of 29 CFR 1910.132 a section exists to cover, for our maintenance
 * only. It is never printed.
 *
 * ## Why the hazard assessment is the spine of this document
 *
 * `lib/requirements` says of this requirement: "Check it includes the written
 * hazard assessment, not just a kit list." That is the difference between a
 * PPE programme that is accepted and one that comes back. A list of equipment
 * describes what a company owns; an assessment describes how it decided, which
 * is the part a reviewer cannot infer. So the questions ask who walks the job
 * and where the written assessment lives, and four of the thirteen sections
 * are about assessing rather than about equipment.
 *
 * ## What this programme deliberately does NOT cover
 *
 * Respiratory protection. It is a separate requirement in our own reference
 * data, it carries its own standard, and a respirator programme needs fit
 * testing and medical evaluation that none of these questions ask about. A
 * document that mentioned respirators in passing would read as covering them.
 * The Scope section says so explicitly rather than staying silent, because
 * silence in a safety programme is read as coverage.
 *
 * ## What it never asserts
 *
 * That training has happened, or that any particular equipment is owned. Both
 * are facts about the world on a given day that a form cannot establish. Every
 * sentence about training is a commitment about what happens before an
 * employee is assigned work, not a claim that it already has.
 */

/** Answer ids, so the template and the questions cannot drift apart. */
const Q = {
  responsible: "responsible_role",
  assessmentBy: "assessment_by",
  assessmentLocation: "assessment_location",
  provision: "provision",
  hostSites: "host_sites",
  specialty: "specialty",
  specialtyList: "specialty_list",
} as const;

const RESPONSIBLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
};

/**
 * The responsible party, in the document's words.
 *
 * A role rather than a person's name, for the reason recorded in hazcom.ts: a
 * name goes stale the week somebody leaves and turns a live programme into a
 * document describing staff the company no longer employs.
 */
function responsibleRole(answers: Answers): string {
  const chosen = answers[Q.responsible];
  return RESPONSIBLE_LABELS[chosen] ?? chosen;
}

const ASSESSOR_LABELS: Record<string, string> = {
  responsible: "the person named above",
  site_supervisor: "the supervisor responsible for that site",
  outside: "an outside safety consultant engaged by the Company",
};

/**
 * How the assessment gets done, as a phrase the sentences below slot into.
 *
 * "the person named above" resolves at render time to whichever role was
 * chosen, so the two answers cannot contradict each other in the finished
 * document.
 */
function assessorPhrase(answers: Answers): string {
  const chosen = answers[Q.assessmentBy];
  if (chosen === "responsible") return `the ${responsibleRole(answers)}`;
  return ASSESSOR_LABELS[chosen] ?? chosen;
}

/**
 * Who pays, in the company's own words.
 *
 * The two carve-outs offered here — ordinary safety-toe footwear and
 * prescription eyewear — are the two that a small contractor most often
 * handles differently, and a programme that claimed the company pays for
 * everything when it does not would be a false statement in a document the
 * customer signs. So it is asked rather than assumed.
 */
const PROVISION_SENTENCE: Record<string, string> = {
  all_provided:
    "All personal protective equipment required by this program is provided by the Company at no cost to the employee.",
  except_boots:
    "Personal protective equipment required by this program is provided by the Company at no cost to the employee, with the exception of ordinary safety-toe footwear and prescription eyewear, which the employee provides and which the Company permits to be worn away from the workplace.",
  specialised_only:
    "Employees provide their own everyday safety-toe footwear and prescription eyewear. All other personal protective equipment required by this program, including any equipment specific to a task or a site, is provided by the Company at no cost to the employee.",
};

export const PPE: ProgramTemplate = {
  id: "personal_protective_equipment",
  title: "Personal Protective Equipment Program",
  shortName: "Personal Protective Equipment",
  requirementId: "ppe",

  /*
   * NOT offered to customers yet, and that is deliberate rather than an
   * oversight.
   *
   * docs/release-one.md sets the rule: the flag is lifted per programme, by a
   * person, once the prose for that programme has been written or reviewed by
   * somebody qualified. The pipeline is finished and this document generates
   * correctly — what has not happened is that review. Changing this one line
   * to "customer_available" is the whole of shipping it, and it should be
   * changed by whoever is willing to stand behind the wording, not by whoever
   * wrote it.
   */
  release: "internal_testing",
  templateVersion: "1.0.0",

  // lib/requirements labels this "Personal protective equipment programme".
  // Both spellings accepted, as in hazcom.ts, because a review stored before
  // the reference data settled may carry either.
  matchesLabel: (label) =>
    /^personal protective equipment (program|programme)$/i.test(label.trim()),

  /*
   * Seven questions, one conditional, and none that the company profile can
   * already answer.
   *
   * What is deliberately NOT asked: a list of the equipment held. It is the
   * same trap as the chemical inventory in HazCom — a list typed in one
   * afternoon is wrong by the next job, and a programme naming equipment the
   * company no longer issues is worse than one describing how equipment is
   * selected. The document commits to the assessment driving selection, and
   * says where the assessment is kept.
   */
  questions: [
    {
      id: Q.responsible,
      prompt: "Who looks after this program day to day?",
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
      id: Q.assessmentBy,
      prompt: "Who walks the job and decides what protection is needed?",
      help: "This is the part reviewers look for. It is what makes a program more than a kit list.",
      kind: "choice",
      required: true,
      options: [
        { id: "responsible", label: "The same person as above" },
        { id: "site_supervisor", label: "The supervisor for that particular site" },
        { id: "outside", label: "An outside safety consultant" },
      ],
    },
    {
      id: Q.assessmentLocation,
      prompt: "Where is the written assessment kept?",
      help: "For example: the site office, a job file, or a named system.",
      kind: "text",
      required: true,
    },
    {
      id: Q.provision,
      prompt: "Who pays for the equipment?",
      kind: "choice",
      required: true,
      options: [
        { id: "all_provided", label: "We provide everything at no cost" },
        {
          id: "except_boots",
          label: "We provide everything except boots and prescription glasses",
        },
        {
          id: "specialised_only",
          label: "Crew bring their own boots and glasses; we provide the rest",
        },
      ],
    },
    {
      id: Q.hostSites,
      prompt: "Do you work on sites where the client sets their own PPE rules?",
      help: "Common on plant, refinery and utility work.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.specialty,
      prompt:
        "Do some jobs need protection beyond hard hat, eye protection, gloves and boots?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.specialtyList,
      prompt: "Which kinds?",
      help: "For example: hearing protection, face shields, fall harnesses, flame-resistant clothing, cut-resistant sleeves.",
      kind: "text",
      required: true,
      showWhen: (answers) => answers[Q.specialty] === "yes",
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const assessor = assessorPhrase(answers);
    const assessmentLocation = answers[Q.assessmentLocation].trim();
    const hostSites = answers[Q.hostSites] === "yes";
    const specialty = answers[Q.specialty] === "yes";
    const specialtyList = (answers[Q.specialtyList] ?? "").trim();

    const sections: Section[] = [
      {
        heading: "Purpose and Policy",
        sourceRef: "1910.132(a)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} is committed to providing a safe and healthful workplace for every employee. This written Personal Protective Equipment Program sets out how ${company} identifies the hazards present in its work, how it decides what protective equipment those hazards call for, and how that equipment reaches the employees who need it.`,
          },
          {
            type: "paragraph",
            text: `It is the policy of ${company} that protective equipment is the last line of defense and not the first. Where a hazard can be removed, guarded, or engineered out, ${company} does that in preference to relying on equipment worn by the employee. Where a hazard remains, no employee is asked to face it without the equipment identified by the assessment described in this program, and without instruction in its use.`,
          },
        ],
      },
      {
        heading: "Scope",
        sourceRef: "1910.132(a)",
        blocks: [
          {
            type: "paragraph",
            text: `This program applies to every employee of ${company} whose work may expose them to a hazard capable of causing injury or impairment through absorption, inhalation, or physical contact. It applies at every location where ${company} performs work, including customer sites.`,
          },
          {
            type: "paragraph",
            text: `This program does not cover respiratory protection. Where work performed by ${company} calls for a respirator, that work is governed by a separate written respiratory protection program, which addresses the medical evaluation and fit testing that respirator use requires and which this document does not.`,
          },
        ],
      },
      {
        heading: "Responsibilities",
        sourceRef: "1910.132(a)",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} is responsible for this program: for seeing that the hazard assessment described below is carried out and recorded, that the equipment it identifies is available, that employees are instructed before they are assigned work requiring it, and that the program is reviewed.`,
          },
          {
            type: "bullets",
            items: [
              `Supervisors are responsible for seeing that the equipment identified for a task is worn and used on that task, and for stopping work where it is not.`,
              `Employees are responsible for using the equipment provided, for inspecting it before use, for caring for it, and for reporting equipment that is damaged, worn out, or does not fit.`,
              `No employee is disciplined for reporting defective equipment or for stopping work because the equipment needed is not available.`,
            ],
          },
        ],
      },
      {
        heading: "Hazard Assessment",
        sourceRef: "1910.132(d)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} assesses the workplace to determine whether hazards are present, or are likely to be present, that call for the use of personal protective equipment. The assessment is carried out by ${assessor}.`,
          },
          {
            type: "paragraph",
            text: "The assessment considers, at minimum, the sources of hazard reasonably foreseeable in the work:",
          },
          {
            type: "bullets",
            items: [
              "Impact, penetration, compression, and rolling or falling objects",
              "Chemical exposure, including splash and skin contact",
              "Heat, flame, and hot surfaces",
              "Harmful dust, fume, and airborne particulate",
              "Light radiation, including welding arc and cutting operations",
              "Electrical hazards, including contact and arc",
              "Sharp edges, abrasion, and entanglement",
              "Working at height, and the hazards below a work area",
            ],
          },
          {
            type: "paragraph",
            text: `Where the assessment identifies a hazard that cannot be removed or controlled by other means, it records the protective equipment selected for it and the reason for that selection.`,
          },
        ],
      },
      {
        heading: "Written Certification of the Assessment",
        sourceRef: "1910.132(d)(2)",
        blocks: [
          {
            type: "paragraph",
            text: `The assessment is recorded in writing. The written record identifies the workplace or task assessed, the person who performed the assessment, and the date it was performed, and states that it is a certification of hazard assessment.`,
          },
          {
            type: "paragraph",
            text: `The written assessment is kept at: ${assessmentLocation}. A copy is available to any employee, or their designated representative, on request.`,
          },
        ],
      },
      {
        heading: "When the Assessment Is Repeated",
        sourceRef: "1910.132(d)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} repeats the assessment for a workplace or task when any of the following occurs:`,
          },
          {
            type: "bullets",
            items: [
              "Work begins at a new site, or at a site whose conditions differ from those previously assessed",
              "A process, tool, material, or method of work changes",
              "An injury, illness, or near miss suggests that a hazard was not identified or was underestimated",
              "Equipment selected under a previous assessment proves unsuitable in use",
              "The program is reviewed under the Review and Revision section below",
            ],
          },
        ],
      },
      {
        heading: "Selection of Equipment",
        sourceRef: "1910.132(c)",
        blocks: [
          {
            type: "paragraph",
            text: `Equipment is selected to fit the hazard identified by the assessment, not by general category. ${company} selects equipment that is of safe design and construction for the work it is performed in, and that is appropriate to the degree of hazard the assessment recorded.`,
          },
          {
            type: "paragraph",
            text: `Equipment is selected to fit the employee who will wear it. Where equipment is available in more than one size or configuration, ${company} makes the range available rather than issuing a single size, on the basis that equipment that does not fit is not worn and does not protect.`,
          },
        ],
      },
      {
        heading: "Provision and Cost",
        sourceRef: "1910.132(h)",
        blocks: [
          { type: "paragraph", text: PROVISION_SENTENCE[answers[Q.provision]] },
          {
            type: "paragraph",
            text: `Replacement equipment is provided on the same terms. An employee who reports equipment as damaged, worn out, contaminated, or no longer fitting is issued a replacement, and is not asked to continue work requiring that equipment until the replacement is in hand.`,
          },
        ],
      },
      {
        heading: "Employee-Owned Equipment",
        sourceRef: "1910.132(b)",
        blocks: [
          {
            type: "paragraph",
            text: `Where an employee provides their own protective equipment, ${company} remains responsible for ensuring that it is adequate for the hazard identified by the assessment, and that it is maintained in a sanitary and reliable condition. Equipment that does not meet that standard is not permitted in use, and is replaced under the Provision and Cost section above.`,
          },
        ],
      },
      {
        heading: "Instruction in Use",
        sourceRef: "1910.132(f)",
        blocks: [
          {
            type: "paragraph",
            text: `Before an employee is assigned work requiring personal protective equipment, ${company} instructs them in:`,
          },
          {
            type: "numbered",
            items: [
              "When protective equipment is necessary for the work they are assigned",
              "What equipment is necessary, and why the assessment selected it",
              "How to put it on, take it off, adjust it, and wear it",
              "The limits of the equipment — what it protects against and what it does not",
              "How to inspect it, care for it, store it, and when to take it out of service",
            ],
          },
          {
            type: "paragraph",
            text: `${company} instructs an employee again where their work changes in a way that makes previous instruction insufficient, where the equipment selected for their work changes, or where their use of the equipment in practice suggests the earlier instruction was not understood.`,
          },
          {
            type: "paragraph",
            text: `The ${role} records who was instructed, in what, and on what date.`,
          },
        ],
      },
      {
        heading: "Inspection, Care, and Defective Equipment",
        sourceRef: "1910.132(e)",
        blocks: [
          {
            type: "paragraph",
            text: "Employees inspect their protective equipment before each use. Equipment is checked for cracks, tears, deformation, contamination, missing components, expired service life, and any other condition that would reduce the protection it gives.",
          },
          {
            type: "paragraph",
            text: `Equipment found to be defective, damaged, or contaminated is removed from service immediately and is not used until it has been repaired to the manufacturer's specification or replaced. Defective equipment is not returned to a store or a vehicle where it could be picked up and used again; it is taken out of circulation by the ${role}.`,
          },
        ],
      },
    ];

    if (specialty) {
      sections.push({
        heading: "Task-Specific Equipment",
        sourceRef: "1910.132(d)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `Beyond the equipment worn generally on ${company} work, certain tasks call for additional protection identified by the hazard assessment. ${company} has identified the following as arising in its work: ${specialtyList}.`,
          },
          {
            type: "paragraph",
            text: `Equipment of this kind is selected, provided, inspected, and instructed in on the same terms as all other equipment under this program. The assessment for the task records which of it applies, and it is issued for the task rather than held generally.`,
          },
        ],
      });
    }

    if (hostSites) {
      sections.push({
        heading: "Work on Client and Host Employer Sites",
        sourceRef: "1910.132(a)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} regularly performs work at sites controlled by a client or host employer who sets their own requirements for protective equipment.`,
          },
          {
            type: "paragraph",
            text: `Before work begins at such a site, the ${role} establishes what the site requires and compares it against the assessment ${company} has made for the task. Where the site requires more than the ${company} assessment identified, the site requirement is met. Where the ${company} assessment identifies a hazard the site rules do not address, ${company} equips its employees for it regardless of whether the site asks.`,
          },
          {
            type: "paragraph",
            text: `Site rules are treated as a floor rather than a ceiling. ${company} does not reduce the protection its own assessment called for because a host employer asks for less.`,
          },
        ],
      });
    }

    sections.push(
      {
        heading: "Availability of This Program",
        sourceRef: "1910.132(a)",
        blocks: [
          {
            type: "paragraph",
            text: `A copy of this written program and the written hazard assessment are available to any employee, or their designated representative, on request. They are kept at: ${assessmentLocation}.`,
          },
        ],
      },
      {
        heading: "Review and Revision",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} reviews this program at least annually, and whenever the work of ${company} changes in a way that affects it — new equipment, a new kind of site, a change in the tasks performed, or an injury that the program did not anticipate.`,
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
