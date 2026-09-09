import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Respiratory Protection.
 *
 * ## Six elements, and the order they have to happen in
 *
 * Medical evaluation, fit testing and its frequency, a cartridge change
 * schedule, facial hair, and a named administrator.
 *
 * The sequence is the substance. Somebody has to be medically evaluated
 * *before* they are fit tested, and fit tested *before* they wear a
 * respirator on a job — and the common failure is a crew who were handed
 * respirators and neither. A program that lists the three activities without
 * saying which gates which has described a filing system rather than a
 * control.
 *
 * ## Facial hair is the one people argue about
 *
 * A tight-fitting respirator seals against skin. Stubble along the sealing
 * surface breaks the seal, and no amount of tightening fixes it — which is why
 * this is stated as a condition of wearing one rather than as a grooming
 * preference. The program says what the alternative is, so it reads as a
 * choice about equipment rather than an argument about beards.
 *
 * ## What it will not do
 *
 * Name a cartridge service life in hours, or an assigned protection factor,
 * or say which cartridge suits which contaminant. Those depend on the
 * contaminant, its concentration, the work rate and the manufacturer, and a
 * template that printed a number would be handing somebody a schedule for a
 * substance it knows nothing about.
 */

const Q = {
  responsible: "responsible_role",
  useType: "use_type",
  medical: "medical_route",
  fitFrequency: "fit_frequency",
  changeBasis: "change_basis",
  voluntary: "voluntary_use",
  records: "records_location",
} as const;

const MEDICAL: Record<string, string> = {
  clinic:
    "The evaluation is carried out by the Company's occupational health provider. The employee completes the questionnaire privately and sends it to the provider directly; the Company receives the provider's written opinion on whether the person may wear a respirator, and nothing else.",
  any_provider:
    "The evaluation is carried out by a licensed provider chosen for the purpose. The employee completes the questionnaire privately and sends it to the provider directly; the Company receives the provider's written opinion on whether the person may wear a respirator, and nothing else.",
};

const FIT_FREQUENCY: Record<string, string> = {
  annual:
    "Fit testing is repeated at least once a year for anybody who wears a tight-fitting respirator.",
  annual_plus_change:
    "Fit testing is repeated at least once a year, and again whenever a different make, model or size is issued.",
};

export const RESPIRATORY: ProgramTemplate = {
  id: "respiratory",
  title: "Respiratory Protection",
  shortName: "Respiratory Protection",
  requirementId: "respiratory-protection",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^respiratory protection( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.useType,
      prompt: "What kind of respirators do your crews wear?",
      kind: "choice",
      required: true,
      options: [
        { id: "half_face", label: "Half-face cartridge respirators" },
        { id: "full_and_half", label: "Half and full-face" },
        { id: "supplied_air", label: "Supplied air or airline, as well as cartridge" },
      ],
    },
    {
      id: Q.medical,
      prompt: "Who does the medical evaluation?",
      kind: "choice",
      required: true,
      options: [
        { id: "clinic", label: "Our occupational health provider" },
        { id: "any_provider", label: "A licensed provider we arrange" },
      ],
    },
    {
      id: Q.fitFrequency,
      prompt: "How often is fit testing repeated?",
      kind: "choice",
      required: true,
      options: [
        { id: "annual_plus_change", label: "Yearly, and whenever the model changes" },
        { id: "annual", label: "Yearly" },
      ],
    },
    {
      id: Q.changeBasis,
      prompt: "How do people know when to change a cartridge?",
      help: "Smelling it is not a schedule — reviewers check this one.",
      kind: "choice",
      required: true,
      options: [
        { id: "written_schedule", label: "A written schedule per job and contaminant" },
        { id: "end_of_shift", label: "End of every shift, at the latest" },
        { id: "manufacturer_indicator", label: "The manufacturer's end-of-service indicator" },
      ],
    },
    {
      id: Q.voluntary,
      prompt: "Does anyone wear a dust mask voluntarily, where it isn't required?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are medical clearances and fit test records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const voluntary = answers[Q.voluntary] === "yes";
    const suppliedAir = answers[Q.useType] === "supplied_air";
    const records = (answers[Q.records] ?? "").trim();

    const changeSchedule =
      answers[Q.changeBasis] === "end_of_shift"
        ? "Cartridges are changed at the end of every shift in which they are worn, and sooner where the job or the manufacturer's information calls for it. Nothing is carried over to the next day."
        : answers[Q.changeBasis] === "manufacturer_indicator"
          ? "Cartridges fitted with an end-of-service indicator are changed when the indicator says so, and in any case at the interval the manufacturer states for the contaminant and conditions. The indicator is the trigger, not the only one."
          : `A written change schedule is established for each job before the work starts, from the contaminant, its likely concentration, the work rate and the manufacturer's information for that cartridge. The ${role} sets it, and it is written on the job's paperwork rather than left to the wearer.`;

    const body: Section[] = [
      {
        heading: "Controlling the Air First",
        blocks: [
          {
            type: "paragraph",
            text: `Before a respirator is considered, the supervisor for the job establishes whether the exposure can be removed or reduced instead — a different material, local extraction, general ventilation, wetting down, enclosing the work, or doing it somewhere else.`,
          },
          {
            type: "paragraph",
            text: "A respirator protects one person, only while it is worn, only if it fits, and only if the right cartridge is on it. Every other control protects everybody nearby without depending on any of that, which is why it comes first.",
          },
          {
            type: "paragraph",
            text: `Respirators are used for what remains after those controls, and for work where controls are not practical — short-duration tasks, changing conditions, emergencies.`,
          },
        ],
      },
      {
        heading: "Three Things Before Anybody Wears One",
        blocks: [
          {
            type: "paragraph",
            text: "In this order, and none of them is skipped:",
          },
          {
            type: "numbered",
            items: [
              "Medical evaluation. Wearing a respirator is work in itself — it adds breathing resistance and heat — and a licensed provider decides whether the person can do it safely.",
              "Fit testing. The specific make, model and size the person will actually wear is tested on their face.",
              "Instruction. What the respirator does and does not protect against, how to put it on, how to check the seal, how to clean and store it, and when to stop and leave the area.",
            ],
          },
          {
            type: "paragraph",
            text: `Somebody who has not completed all three does not wear a tight-fitting respirator on a job for ${company}. Being short-handed is not a reason to skip any of them.`,
          },
        ],
      },
      {
        heading: "Medical Evaluation",
        blocks: [
          { type: "paragraph", text: MEDICAL[answers[Q.medical]] },
          {
            type: "paragraph",
            text: "The employee's answers on the questionnaire are between them and the provider. The Company does not see them and does not ask.",
          },
          {
            type: "paragraph",
            text: "The evaluation is repeated when the provider says so, when the employee reports a change in their health that affects wearing one, when a supervisor observes them struggling, and when the work changes in a way that adds burden — heavier work, higher heat, longer wear.",
          },
        ],
      },
      {
        heading: "Fit Testing",
        blocks: [
          {
            type: "paragraph",
            text: "Fit testing is done on the exact make, model and size the person will wear. A test on a different respirator establishes nothing about the one they are issued.",
          },
          {
            type: "paragraph",
            text: "The test follows the protocol the test method sets out, carried out by somebody able to run it and to recognize a failure. Where the person fails on one model, another size or model is tried and tested, and the record shows what they passed on.",
          },
          { type: "paragraph", text: FIT_FREQUENCY[answers[Q.fitFrequency]] },
          {
            type: "paragraph",
            text: "Fit testing is also repeated after anything that could change the seal — noticeable weight change, dental work, facial surgery, or a scar along the sealing surface.",
          },
          {
            type: "paragraph",
            text: "Separately from the fit test, the wearer checks the seal themselves each time they put the respirator on, by the method they were shown. A fit test a year ago says nothing about this morning.",
          },
        ],
      },
      {
        heading: "Facial Hair",
        blocks: [
          {
            type: "paragraph",
            text: "A tight-fitting respirator seals against skin. Hair anywhere along the sealing surface breaks that seal, and tightening the straps does not fix it — it makes the respirator uncomfortable while still leaking.",
          },
          {
            type: "paragraph",
            text: "So anybody wearing a tight-fitting respirator is clean-shaven along the sealing surface at the start of each shift in which they will wear it. Stubble grown during a long shift counts.",
          },
          {
            type: "paragraph",
            text: `This is a condition of wearing that equipment rather than a rule about appearance. Where an employee cannot or does not wish to shave, ${company} looks at a loose-fitting powered respirator, which does not seal to the face, or at work that does not require one. Nobody is required to choose between shaving and their job without that conversation.`,
          },
        ],
      },
      {
        heading: "Cartridges and Filters",
        blocks: [
          {
            type: "paragraph",
            text: "The cartridge or filter is selected for the actual contaminant and is fitted before the respirator is issued for that job. A respirator with the wrong cartridge offers the protection of no respirator, while looking like protection.",
          },
          { type: "paragraph", text: changeSchedule },
          {
            type: "paragraph",
            text: "Nobody relies on smell, taste or irritation to decide when a cartridge is spent. Several contaminants give no warning at all, and by the time one is noticed the wearer has already been exposed.",
          },
          {
            type: "paragraph",
            text: "Any wearer who smells or tastes the contaminant, or feels irritation, leaves the area immediately and reports it. That is treated as a failure of the equipment or the schedule, and the job does not resume until the reason is understood.",
          },
        ],
      },
      {
        heading: "Care and Storage",
        blocks: [
          {
            type: "paragraph",
            text: "Respirators are issued to an individual and are not shared. Each wearer cleans and inspects theirs after use — face piece, straps, valves, gaskets and the cartridge seating.",
          },
          {
            type: "paragraph",
            text: "They are stored in a sealed bag or container, out of sunlight, heat, damp and contamination, and not left in a truck bed or a gang box loose. A respirator stored in the dust it is meant to protect against is contaminated on the inside.",
          },
          {
            type: "paragraph",
            text: "Anything cracked, perished, distorted or missing a part is taken out of service. Damaged respirators are replaced rather than repaired with what is to hand.",
          },
        ],
      },
    ];

    if (suppliedAir) {
      body.push({
        heading: "Supplied Air",
        blocks: [
          {
            type: "paragraph",
            text: "Where breathing air is supplied by airline, the air quality is confirmed to the grade specified for breathing air, and the certificate or test result for the supply is held for the job.",
          },
          {
            type: "paragraph",
            text: "Compressor intakes are placed where they cannot draw exhaust, fumes or the contaminant being worked in, and are checked before each use. Carbon monoxide monitoring or an alarm is used where an oil-lubricated compressor supplies the air.",
          },
          {
            type: "paragraph",
            text: "Breathing air couplings are incompatible with any other gas line on site, so that a breathing airline cannot be connected to anything else. Where escape provision is required for the work, it is on the wearer before entry rather than nearby.",
          },
        ],
      });
    }

    if (voluntary) {
      body.push({
        heading: "Wearing One Voluntarily",
        blocks: [
          {
            type: "paragraph",
            text: "Where an employee wants to wear a filtering face piece — a dust mask — for comfort on work that does not require respiratory protection, the Company allows it.",
          },
          {
            type: "paragraph",
            text: "They are told, before they do, that a dust mask is not protection against vapors, gases or oxygen deficiency; to use only a mask that is certified and clean; not to share it; and to store it where it will not be contaminated.",
          },
          {
            type: "paragraph",
            text: "Voluntary use of a dust mask does not require medical evaluation or fit testing. Voluntary use of any other kind of respirator does, and is handled exactly as required use, because the burden on the wearer is the same whatever their reason for wearing it.",
          },
        ],
      });
    }

    body.push({
      heading: "Records",
      blocks: [
        {
          type: "paragraph",
          text: `Medical clearances, fit test records, the change schedules set for jobs, and the current list of who is cleared for which respirator are kept at: ${records}.`,
        },
        {
          type: "paragraph",
          text: `The ${role} administers this program: keeping that list current, arranging evaluations and fit tests before they lapse, setting change schedules, and making sure nobody is issued a respirator they are not cleared and fitted for.`,
        },
        {
          type: "paragraph",
          text: "A fit test record states the make, model and size, the protocol used, the date, and who carried it out. \"Fit tested\" with no model against it does not establish anything.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company decides when a respirator is needed, what has to happen before somebody wears one, how the fit is established and kept, and when cartridges are changed.",
      policy: `It is the policy of ${company} that the air is made safe wherever it can be, that a respirator is what remains after that, and that nobody wears a tight-fitting respirator until they have been medically cleared and fit tested on the one they will actually wear.`,
      body,
      trainingPoints: [
        "That medical clearance comes before fit testing, and fit testing before wearing one on a job",
        "How to check the seal every time you put it on, and that a fit test last year proves nothing today",
        "Why hair along the sealing surface defeats the respirator no matter how tight the straps",
        "That a respirator with the wrong cartridge is not protection",
        "That smell and taste are not a change schedule, and that some contaminants give no warning",
        "To leave the area and report it if you smell, taste or feel the contaminant",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through checking that somebody is cleared and fit tested before issuing a respirator, applying the change schedule on a job, and what to do when a wearer reports breakthrough.",
      reviewTrigger:
        "The review checks that no clearance or fit test has lapsed for anybody still expected to wear a respirator.",
    });
  },
};
