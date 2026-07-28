import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * The Hazard Communication programme.
 *
 * Written by hand in this repo and assembled deterministically. No model runs
 * at request time; the same answers produce the same document twice.
 *
 * The voice throughout is the company's own. A safety programme is a statement
 * of what a company does and commits to — it is adopted by the company and it
 * binds them. So every sentence here is in that register ("the Company
 * maintains…"), and there is no sentence anywhere in it that tells the reader
 * what the law obliges them to do. That distinction is the whole reason this
 * file is allowed to exist under the project's regulatory output rules: it is
 * policy the customer adopts, not advice about their legal position.
 *
 * `sourceRef` on each section records which element of 29 CFR 1910.1200(e)
 * that section is there to cover. It exists so a future amendment can be
 * traced to the sections it touches. It is never printed.
 *
 * Every company-specific fact is substituted from an answer the customer gave.
 * There is no default anywhere in this file that invents one.
 */

/** Answer ids, so the template and the questions cannot drift apart. */
const Q = {
  responsible: "responsible_role",
  sdsFormat: "sds_format",
  sdsLocation: "sds_location",
  labelling: "labelling",
  multiEmployer: "multi_employer",
  nonRoutine: "non_routine",
  unlabelledPipes: "unlabelled_pipes",
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
 * A role rather than a person's name, deliberately. A name goes stale the week
 * someone leaves and turns a live programme into a document that describes
 * staff the company no longer employs; a role stays true. It is also one fewer
 * personal detail to hold.
 */
function responsibleRole(answers: Answers): string {
  const chosen = answers[Q.responsible];
  return RESPONSIBLE_LABELS[chosen] ?? chosen;
}

const SDS_ACCESS_SENTENCE: Record<string, string> = {
  paper:
    "Safety data sheets are maintained in printed form and are available to employees in hard copy during every work shift.",
  digital:
    "Safety data sheets are maintained electronically and are available to employees on request during every work shift, without barrier to access.",
  both: "Safety data sheets are maintained both in printed form and electronically, and are available to employees during every work shift by either route.",
};

const LABELLING_SENTENCE: Record<string, string> = {
  manufacturer:
    "Containers are kept in the packaging supplied by the manufacturer, importer, or distributor, with the original label intact and legible.",
  workplace_labels:
    "Where a chemical is transferred into a secondary container, that container is marked with the product identifier and the hazard information for the chemical it holds.",
  both: "Containers are normally kept in the packaging supplied by the manufacturer, importer, or distributor, with the original label intact and legible. Where a chemical is transferred into a secondary container, that container is marked with the product identifier and the hazard information for the chemical it holds.",
};

export const HAZCOM: ProgramTemplate = {
  id: "hazard_communication",
  title: "Hazard Communication Program",
  shortName: "Hazard Communication",
  requirementId: "hazard-communication",
  release: "customer_available",
  templateVersion: "1.0.0",

  // lib/requirements labels this "Hazard communication programme". Compared
  // case-insensitively against both spellings, because the reference data uses
  // British spelling and a review stored before that settled may carry either.
  matchesLabel: (label) =>
    /^hazard communication (program|programme)$/i.test(label.trim()),

  /*
   * Seven questions, two of them conditional, and none asked that the profile
   * can answer. Each earns its place by changing whether a section appears or
   * by supplying a fact the document would otherwise have to invent.
   *
   * What is deliberately NOT asked: the chemical inventory. A list typed into
   * a form on one afternoon is out of date by the next delivery, and a
   * programme that names chemicals the company no longer holds is worse than
   * one that describes how the list is kept. So the document commits to
   * maintaining the inventory and says where it lives.
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
      id: Q.sdsFormat,
      prompt: "How do your crew get to safety data sheets?",
      kind: "choice",
      required: true,
      options: [
        { id: "paper", label: "Printed copies in a binder" },
        { id: "digital", label: "On a computer, tablet, or phone" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.sdsLocation,
      prompt: "Where are they kept?",
      help: "For example: the site office, each work vehicle, or a named system.",
      kind: "text",
      required: true,
    },
    {
      id: Q.labelling,
      prompt: "How are chemical containers labelled on your jobs?",
      kind: "choice",
      required: true,
      options: [
        { id: "manufacturer", label: "We use them in the original containers" },
        {
          id: "workplace_labels",
          label: "We pour them into other containers and label those",
        },
        { id: "both", label: "Both, depending on the job" },
      ],
    },
    {
      id: Q.multiEmployer,
      prompt: "Do you work on sites where other contractors are working too?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.unlabelledPipes,
      prompt: "Do your crew work on pipes or lines that aren't labelled?",
      help: "Common on plant and refinery work.",
      kind: "boolean",
      required: true,
      // Only relevant to people on other people's sites, which is where
      // unlabelled process piping is encountered.
      showWhen: (answers) => answers[Q.multiEmployer] === "yes",
    },
    {
      id: Q.nonRoutine,
      prompt: "Are there occasional jobs with chemical exposure outside the normal routine?",
      help: "Tank cleaning, confined space work, one-off maintenance.",
      kind: "boolean",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const sdsLocation = answers[Q.sdsLocation].trim();
    const multiEmployer = answers[Q.multiEmployer] === "yes";
    const nonRoutine = answers[Q.nonRoutine] === "yes";
    const unlabelledPipes = answers[Q.unlabelledPipes] === "yes";

    const sections: Section[] = [
      {
        heading: "Purpose and Policy",
        sourceRef: "1910.1200(e)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} is committed to providing a safe and healthful workplace for every employee. This written Hazard Communication Program sets out how ${company} identifies the hazardous chemicals present in its work, how information about those chemicals is obtained and kept, and how that information reaches the employees who work with or around them.`,
          },
          {
            type: "paragraph",
            text: `It is the policy of ${company} that no employee is asked to work with a hazardous chemical without access to the information needed to do so safely, and without the training to understand it.`,
          },
        ],
      },
      {
        heading: "Scope",
        sourceRef: "1910.1200(b)",
        blocks: [
          {
            type: "paragraph",
            text: `This program applies to every employee of ${company} who may be exposed to a hazardous chemical under normal working conditions, or in a foreseeable emergency. It applies at every location where ${company} performs work, including customer sites.`,
          },
        ],
      },
      {
        heading: "Responsibilities",
        sourceRef: "1910.1200(e)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} is responsible for this program: for keeping it current, for maintaining the chemical inventory and the safety data sheet collection, for seeing that containers are labelled, and for arranging employee training.`,
          },
          {
            type: "paragraph",
            text: "Supervisors are responsible for ensuring that the employees they direct have received training before working with a hazardous chemical, and that safety data sheets are accessible on the job.",
          },
          {
            type: "paragraph",
            text: "Employees are responsible for following the safe work practices covered in training, for using the protective equipment provided, and for reporting damaged or missing container labels to their supervisor.",
          },
        ],
      },
      {
        heading: "Hazardous Chemical Inventory",
        sourceRef: "1910.1200(e)(1)(i)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} maintains a list of the hazardous chemicals known to be present in its work. Each chemical on the list is identified by the product identifier used on its label and on its safety data sheet, so that the list, the label, and the sheet can be matched to one another.`,
          },
          {
            type: "paragraph",
            text: `The ${role} updates the list when a new chemical is brought into use and when one is no longer used. The list is kept with the safety data sheets described in the following section, and is available to employees on the same terms.`,
          },
        ],
      },
      {
        heading: "Safety Data Sheets",
        sourceRef: "1910.1200(g)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} maintains a safety data sheet for each hazardous chemical on its inventory, as supplied by the manufacturer, importer, or distributor.`,
          },
          { type: "paragraph", text: SDS_ACCESS_SENTENCE[answers[Q.sdsFormat]] },
          {
            type: "paragraph",
            text: `Safety data sheets are kept at the following location: ${sdsLocation}.`,
          },
          {
            type: "paragraph",
            text: `Where a safety data sheet has not been received for a chemical, or the sheet received is incomplete, the ${role} requests it from the supplier and records that the request has been made. Employees are told how to obtain a sheet, and no employee is refused access to one.`,
          },
        ],
      },
      {
        heading: "Container Labels",
        sourceRef: "1910.1200(f)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} does not remove or deface the labels applied by a manufacturer, importer, or distributor on any container of hazardous chemicals.`,
          },
          { type: "paragraph", text: LABELLING_SENTENCE[answers[Q.labelling]] },
          {
            type: "paragraph",
            text: `Labels are kept legible and in English. Damaged or missing labels are reported to a supervisor and replaced before the container is used again.`,
          },
        ],
      },
      {
        heading: "Employee Information and Training",
        sourceRef: "1910.1200(h)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} provides training on hazardous chemicals to each employee at the time of their initial assignment, and again whenever a new chemical hazard that they have not previously been trained on is introduced into their work area.`,
          },
          { type: "paragraph", text: "Training covers:" },
          {
            type: "bullets",
            items: [
              "the requirements of this program, and where the written program, the chemical inventory, and the safety data sheets are kept",
              "the operations in their work area where hazardous chemicals are present",
              "the physical, health, and any other hazards of the chemicals in that area",
              "the methods and observations used to detect the presence or release of a hazardous chemical",
              "the measures employees can take to protect themselves, including work practices, emergency procedures, and the personal protective equipment provided",
              "how to read and use the information on labels and safety data sheets",
            ],
          },
          {
            type: "paragraph",
            text: `The ${role} records who has been trained and on what date.`,
          },
        ],
      },
    ];

    if (nonRoutine) {
      sections.push({
        heading: "Non-Routine Tasks",
        sourceRef: "1910.1200(e)(1)(ii)",
        blocks: [
          {
            type: "paragraph",
            text: `Some work carried out by ${company} falls outside normal routine and may involve chemical exposure that day-to-day training does not cover.`,
          },
          {
            type: "paragraph",
            text: `Before such a task begins, the ${role} reviews the chemicals involved and briefs the employees who will carry it out on the hazards, the protective measures to be used, and the emergency procedures that apply. The briefing is given before work starts, and work does not begin until it has been given.`,
          },
        ],
      });
    }

    if (unlabelledPipes) {
      sections.push({
        heading: "Unlabelled Pipes and Lines",
        sourceRef: "1910.1200(e)(1)(ii)",
        blocks: [
          {
            type: "paragraph",
            text: `Employees of ${company} work at locations where piping and lines may carry hazardous chemicals without being labelled.`,
          },
          {
            type: "paragraph",
            text: `Before work begins on or near such piping, the ${role} obtains from the site operator the identity of the contents, the hazards they present, and any precautions required, and passes that information to the employees carrying out the work. Employees do not open, cut, or break into a line whose contents have not been identified.`,
          },
        ],
      });
    }

    if (multiEmployer) {
      sections.push({
        heading: "Multi-Employer Workplaces",
        sourceRef: "1910.1200(e)(2)",
        blocks: [
          {
            type: "paragraph",
            text: `${company} regularly performs work at sites where employees of other employers are present.`,
          },
          {
            type: "paragraph",
            text: `Before work begins at such a site, the ${role} provides the host employer and any other contractor whose employees may be exposed with access to the safety data sheets for the chemicals ${company} brings on site, tells them how those chemicals will be labelled, and describes the precautions that apply.`,
          },
          {
            type: "paragraph",
            text: `The ${role} likewise obtains the same information from the host employer for the chemicals present at the site, and passes it to ${company} employees working there.`,
          },
        ],
      });
    }

    sections.push(
      {
        heading: "Availability of This Program",
        sourceRef: "1910.1200(e)(1)",
        blocks: [
          {
            type: "paragraph",
            text: `A copy of this written program, the chemical inventory, and the safety data sheets are available to any employee, or their designated representative, on request. They are kept at: ${sdsLocation}.`,
          },
        ],
      },
      {
        heading: "Review and Revision",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} reviews this program at least annually, and whenever the work of ${company} changes in a way that affects it — a new chemical, a change in how chemicals are stored or accessed, or a change in the kind of sites worked on.`,
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
