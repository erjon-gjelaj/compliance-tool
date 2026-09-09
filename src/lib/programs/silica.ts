import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Respirable Crystalline Silica.
 *
 * ## The dust that does not look like a hazard
 *
 * Silica dust from cutting, grinding or drilling concrete, stone, brick or
 * mortar is invisible at the size that reaches the deep lung. The visible
 * cloud is the coarse fraction; the part that causes silicosis cannot be
 * seen, so a crew who have cleared the visible dust believe they have dealt
 * with it.
 *
 * The disease is permanent, progressive after exposure stops, and appears
 * years later. There is no moment during the work when anything seems wrong.
 *
 * ## Control at the tool, not on the face
 *
 * Water or on-tool extraction removes most of it for everybody in the area.
 * A respirator protects one person, only while worn, only if fitted. So the
 * order is stated and the document is explicit that a respirator is not the
 * first answer — which is exactly the substitution crews make when the water
 * kit is awkward.
 *
 * ## What it will not do
 *
 * State an exposure limit, an action level, a control method for a specific
 * task, or a respirator assigned protection factor. The applicable standard
 * carries a table of tasks and controls, that table is what the customer
 * should work to, and a version transcribed here would be one this project
 * invented.
 */

const Q = {
  responsible: "responsible_role",
  tasks: "silica_tasks",
  control: "primary_control",
  housekeeping: "cleanup_method",
  medical: "medical_surveillance",
  assessment: "exposure_assessment",
  records: "records_location",
} as const;

const CONTROL: Record<string, string> = {
  water:
    "Water suppression is the Company's normal control: the tool is fed with water at the point of cutting, at a rate sufficient to keep dust down for the whole task rather than a trickle that runs out halfway.",
  extraction:
    "On-tool extraction is the Company's normal control: a shroud at the point of cutting, connected to a vacuum with a filter suited to fine dust, checked as working before the task starts.",
  both:
    "Water suppression or on-tool extraction is used, chosen for the task and the setting — water outdoors and where it can be managed, extraction indoors and where water would create another problem.",
};

export const SILICA: ProgramTemplate = {
  id: "silica",
  title: "Respirable Crystalline Silica",
  shortName: "Silica",
  requirementId: "silica",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(respirable crystalline )?silica( exposure)?( control)?( plan| program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.tasks,
      prompt: "Which of these do your crews do?",
      kind: "choice",
      required: true,
      options: [
        { id: "cutting_drilling", label: "Cutting, drilling or coring concrete and masonry" },
        { id: "grinding_chipping", label: "Grinding, chipping or breaking out" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.control,
      prompt: "How is the dust controlled at the tool?",
      help: "This is the control that protects everybody nearby, not just the operator.",
      kind: "choice",
      required: true,
      options: [
        { id: "water", label: "Water fed to the cutting point" },
        { id: "extraction", label: "On-tool extraction with a vacuum" },
        { id: "both", label: "Either, depending on the task" },
      ],
    },
    {
      id: Q.housekeeping,
      prompt: "How is the dust cleaned up afterwards?",
      help: "Dry sweeping puts it all back in the air.",
      kind: "choice",
      required: true,
      options: [
        { id: "vacuum", label: "A vacuum with a fine-dust filter" },
        { id: "wet", label: "Wet methods" },
        { id: "both_methods", label: "Either, depending on the setting" },
      ],
    },
    {
      id: Q.assessment,
      prompt: "How do you know the controls are enough?",
      kind: "choice",
      required: true,
      options: [
        { id: "specified_controls", label: "We follow the specified controls for each task" },
        { id: "air_monitoring", label: "We have had air monitoring done" },
      ],
    },
    {
      id: Q.medical,
      prompt: "Is medical surveillance offered to people doing this work?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where is the exposure control plan kept on site?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const medical = answers[Q.medical] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const cleanup =
      answers[Q.housekeeping] === "wet"
        ? "Dust is cleaned up wet — damped down and cleared rather than swept."
        : answers[Q.housekeeping] === "both_methods"
          ? "Dust is cleaned up with a vacuum fitted with a filter suited to fine dust, or wet where a vacuum is not practical."
          : "Dust is cleaned up with a vacuum fitted with a filter suited to fine dust.";

    const assessment =
      answers[Q.assessment] === "air_monitoring"
        ? `${company} has had air monitoring carried out for its tasks, and the results inform which controls are used for each. Monitoring is repeated when the work, the material, the equipment or the setting changes.`
        : `${company} follows the specified control method for each task as set out in the applicable standard, which removes the need to monitor for those tasks provided the control is used fully and correctly for the whole time the task lasts. Where a task is not covered, or the control cannot be used as specified, the ${role} arranges an assessment rather than proceeding on judgment.`;

    const body: Section[] = [
      {
        heading: "Why This Is Not Ordinary Dust",
        blocks: [
          {
            type: "paragraph",
            text: "Cutting, grinding, drilling and breaking concrete, stone, brick, mortar and engineered stone releases fine crystalline silica. The particles that reach the deep lung are too small to see.",
          },
          {
            type: "paragraph",
            text: "That is the part that matters. The visible cloud is the coarse fraction, and a crew who have waited for it to settle have not dealt with the hazard — they have watched the harmless part go away.",
          },
          {
            type: "paragraph",
            text: "Silicosis is permanent, gets worse after the exposure stops, and appears years later. There is no point during the work at which anybody feels anything wrong, which is why the controls in this program are not left to somebody's judgment on the day.",
          },
        ],
      },
      {
        heading: "Planning the Task",
        blocks: [
          {
            type: "paragraph",
            text: "Before work that will produce silica dust, the supervisor establishes whether it can be avoided altogether: material cut to size off site, an existing opening used, a fixing method that does not need drilling, or a different material.",
          },
          {
            type: "paragraph",
            text: "Where it cannot, the control is arranged before the crew arrives rather than improvised. That means the water kit or the vacuum on the truck, the consumables for it, and the respiratory protection where it is needed — with the people who will need it already fit tested.",
          },
          {
            type: "paragraph",
            text: "The task is also planned so that other people are not working in the dust. Where they will be, the work is rescheduled or the area separated.",
          },
        ],
      },
      {
        heading: "Controlling It at the Tool",
        blocks: [
          { type: "paragraph", text: CONTROL[answers[Q.control]] },
          {
            type: "paragraph",
            text: "The control is used for the whole task, not the first part of it. A water feed that runs dry halfway, or a vacuum that is switched off because it is noisy, produces the exposure the control was there to prevent — and the crew have no way of telling that it has happened.",
          },
          {
            type: "paragraph",
            text: "The control is checked as working before the task starts: water actually reaching the cutting point, extraction actually drawing, filters not blinded, hoses not blocked.",
          },
          {
            type: "paragraph",
            text: "Where the control cannot be used or fails during the task, the work stops. It does not continue with a respirator standing in for it, because everybody else in the area is then unprotected.",
          },
          { type: "paragraph", text: assessment },
        ],
      },
      {
        heading: "Respiratory Protection Is Second",
        blocks: [
          {
            type: "paragraph",
            text: "A respirator protects one person, only while it is worn, only if it fits, and only with the right filter. Water and extraction protect everybody in the area and do not depend on any of that.",
          },
          {
            type: "paragraph",
            text: `So respiratory protection is used in addition to the control at the tool where the task calls for it — never instead of it. Anybody wearing one has been medically cleared and fit tested first under the Company's respiratory protection program, which means it is arranged before the job rather than on the morning.`,
          },
          {
            type: "paragraph",
            text: "A dust mask taken from a box is not respiratory protection under this program.",
          },
        ],
      },
      {
        heading: "Cleaning Up",
        blocks: [
          { type: "paragraph", text: cleanup },
          {
            type: "paragraph",
            text: "Dry sweeping and compressed air are not used to clear silica dust. Both put back into the air the fraction that matters, and compressed air puts it there in a concentration far higher than the cutting did.",
          },
          {
            type: "paragraph",
            text: "Dust is cleared as work produces it rather than left to accumulate, since anybody walking through it later disturbs it again.",
          },
          {
            type: "paragraph",
            text: "Work clothing carrying dust is not shaken out, brushed down, or taken home to be washed with the family's laundry. Where clothing is heavily contaminated it is vacuumed or damped rather than beaten.",
          },
        ],
      },
    ];

    if (medical) {
      body.push({
        heading: "Medical Surveillance",
        blocks: [
          {
            type: "paragraph",
            text: "Medical surveillance is offered, at the Company's expense, to employees who do this work at the frequency the applicable standard sets. It is offered rather than imposed, and nobody is penalized for declining.",
          },
          {
            type: "paragraph",
            text: "The Company receives the provider's written opinion on fitness for the work and any recommended limitation. It does not receive, ask for, or hold the underlying findings.",
          },
          {
            type: "paragraph",
            text: "The point of it is early detection while something can still be done, and an employee who is told of a finding is told promptly and in writing, with the Company arranging whatever referral the provider recommends.",
          },
        ],
      });
    }

    body.push({
      heading: "The Plan on Site",
      blocks: [
        {
          type: "paragraph",
          text: `A copy of this plan is kept at: ${records}, and travels with the crew to any job producing silica dust.`,
        },
        {
          type: "paragraph",
          text: `The ${role} is the person responsible for it: for establishing which tasks produce silica dust, for making sure the controls and consumables are actually with the crew, and for going onto site to see the controls being used rather than assuming they are.`,
        },
        {
          type: "paragraph",
          text: "That last part is the one that decides whether this program works. A control that is inconvenient will be abandoned quietly, the crew will have no way of telling what it cost them, and nothing in the paperwork will show it.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company controls silica dust at the tool when work produces it, what is used in addition, how the dust is cleaned up, and who is responsible for checking it is actually being done.",
      policy: `It is the policy of ${company} that silica dust is controlled at the tool with water or extraction, that a respirator is used in addition and never instead, and that work stops if the control fails rather than continuing behind a mask.`,
      body,
      trainingPoints: [
        "That the dust that causes the disease is too small to see, and the visible cloud is the harmless part",
        "That silicosis is permanent, gets worse after exposure stops, and appears years later",
        "That the control has to run for the whole task — a water feed that runs dry produces the exposure",
        "That a respirator is used as well as the control at the tool, never instead of it",
        "Never to dry sweep or use compressed air on silica dust",
        "Not to shake out or take home clothing carrying the dust",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through arranging the control and its consumables before the crew leaves the yard, checking the control is running during the task rather than at the start, and stopping work when it fails.",
      reviewTrigger:
        "The review asks whether controls were used for the whole of each task rather than started and abandoned, since that is the failure that leaves no trace in the records.",
    });
  },
};
