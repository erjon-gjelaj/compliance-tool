import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Scaffolding.
 *
 * ## Two roles the program has to keep apart
 *
 * A competent person inspects the scaffold and decides whether it may be
 * used. A qualified person designs it where it goes beyond what the
 * manufacturer's configuration covers. Contractors routinely collapse those
 * into "the foreman", and a reviewer reads that collapse as the company not
 * knowing the difference.
 *
 * ## The tag is the control that actually operates
 *
 * Everything else in this subject is decided by somebody at the point of use
 * looking at a tag. So the useful content is what the tag means, who may
 * change one, and the rule that an untagged scaffold is not used — which is
 * the version that survives contact with a busy morning.
 *
 * ## What it will not do
 *
 * State a height at which anything is triggered, a base-to-height ratio, a
 * design load, a plank overhang, or a distance from power lines. Those come
 * from the manufacturer's data for the specific system, from the designer,
 * and from the standard that applies — and a number printed here would
 * compete with the one on the actual equipment.
 */

const Q = {
  responsible: "responsible_role",
  role: "our_role",
  competent: "competent_person",
  tagging: "tag_system",
  inspection: "inspection_timing",
  design: "design_route",
  records: "records_location",
} as const;

const TAG: Record<string, string> = {
  three_colour:
    "A three-tag system is used. A green tag means the scaffold is complete and may be used as built. A yellow tag means it may be used only with additional precautions, which are written on the tag itself. A red tag, or no tag at all, means it must not be used.",
  green_red:
    "A two-tag system is used. A green tag means the scaffold is complete and may be used. A red tag, or no tag at all, means it must not be used. There is no middle state, and a scaffold that is not finished carries a red tag rather than a note.",
};

export const SCAFFOLDING: ProgramTemplate = {
  id: "scaffolding",
  title: "Scaffolding",
  shortName: "Scaffolding",
  requirementId: "scaffolding-safety",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^scaffold(ing)?( safety)?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.role,
      prompt: "What does your company do with scaffolds?",
      kind: "choice",
      required: true,
      options: [
        { id: "erect", label: "We erect, alter and dismantle them" },
        { id: "use_only", label: "We work from scaffolds others put up" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.competent,
      prompt: "Who decides a scaffold is fit to use?",
      help: "This is the competent person, and it must be a named individual.",
      kind: "choice",
      required: true,
      options: [
        { id: "named_list", label: "A named list the company keeps" },
        { id: "site_competent", label: "The site's competent person" },
      ],
    },
    {
      id: Q.tagging,
      prompt: "What tag system do you use?",
      kind: "choice",
      required: true,
      options: [
        { id: "three_colour", label: "Green, yellow and red" },
        { id: "green_red", label: "Green and red only" },
      ],
    },
    {
      id: Q.inspection,
      prompt: "When is a scaffold inspected?",
      kind: "choice",
      required: true,
      options: [
        { id: "each_shift", label: "Before each shift, and after anything that could affect it" },
        { id: "daily", label: "Daily, and after anything that could affect it" },
      ],
    },
    {
      id: Q.design,
      prompt: "What happens when a scaffold goes beyond a standard configuration?",
      kind: "choice",
      required: true,
      options: [
        { id: "engineer", label: "A qualified engineer designs it" },
        { id: "manufacturer", label: "We stay within the manufacturer's published configurations" },
      ],
    },
    {
      id: Q.records,
      prompt: "Where are inspection records and designs kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const erects = answers[Q.role] !== "use_only";
    const usesOthers = answers[Q.role] !== "erect";
    const records = (answers[Q.records] ?? "").trim();

    const competent =
      answers[Q.competent] === "site_competent"
        ? `On sites where the host employer provides the competent person for scaffolding, that person inspects and tags. The ${company} supervisor establishes who they are before work starts, and does not treat an untagged scaffold as usable because somebody said it was finished.`
        : `The ${role} keeps a written list, by name, of the employees designated as competent persons for scaffolding. It is a list of names rather than a job title, and somebody's presence on it reflects what they have been prepared for and what they can be seen to do — not their seniority.`;

    const design =
      answers[Q.design] === "engineer"
        ? "Where a scaffold goes beyond the configurations the manufacturer publishes — unusual heights, unusual loads, cantilevers, suspended arrangements, or anything supported by a structure rather than the ground — it is designed by a qualified engineer before it is built, and is built as designed."
        : `The Company builds only within the configurations the manufacturer publishes for the system in use. Anything outside them is not built, and the ${role} arranges an engineered design or a different approach rather than adapting a standard configuration on site.`;

    const body: Section[] = [
      {
        heading: "Two Different Roles",
        blocks: [
          {
            type: "paragraph",
            text: "These are separate, and the Company keeps them separate:",
          },
          {
            type: "table",
            head: ["Role", "What they decide"],
            rows: [
              [
                "Competent person",
                "Whether a scaffold is fit to use. They inspect it, tag it, and can stop its use. They are designated by the Company and can be seen to identify hazards and to act on them.",
              ],
              [
                "Qualified person",
                "How a scaffold outside a standard configuration is designed. This is an engineering judgment, and holding it is a matter of qualification rather than of experience on site.",
              ],
            ],
          },
          {
            type: "paragraph",
            text: "One person may hold both where they genuinely are both. Assuming that experience on scaffolds makes somebody qualified to design one is the mistake this section exists to prevent.",
          },
          { type: "paragraph", text: competent },
        ],
      },
      {
        heading: "The Tag",
        blocks: [
          { type: "paragraph", text: TAG[answers[Q.tagging]] },
          {
            type: "paragraph",
            text: "A scaffold with no tag is not used. Not for five minutes, not to fetch something, not because the crew watched it being built. An untagged scaffold is an incomplete one until somebody competent says otherwise.",
          },
          {
            type: "paragraph",
            text: "Only a competent person places, changes or removes a tag. Nobody else touches one, and a tag is never moved from one scaffold to another.",
          },
          {
            type: "paragraph",
            text: "The tag carries the date of the last inspection and who carried it out. A tag with no date on it records nothing.",
          },
        ],
      },
      {
        heading: "Inspection",
        blocks: [
          {
            type: "paragraph",
            text:
              answers[Q.inspection] === "each_shift"
                ? "A competent person inspects each scaffold before each shift on which it will be used, and re-tags it accordingly."
                : "A competent person inspects each scaffold daily on the days it is in use, and re-tags it accordingly.",
          },
          {
            type: "paragraph",
            text: "It is also inspected again after anything that could have affected it:",
          },
          {
            type: "bullets",
            items: [
              "High wind, heavy rain, snow, ice, or a freeze",
              "Any alteration, however small — a plank moved, a tie removed, a section added",
              "Impact from a vehicle, a load, or dropped material",
              "Any change to the ground or structure it bears on, including excavation nearby",
              "Any period during which it was left unattended and could have been altered",
            ],
          },
          {
            type: "paragraph",
            text: "The inspection covers the base and what it bears on, the standards and ledgers, the ties to the structure, the platform and planking, the guardrails and toeboards, the access, and anything loose or missing.",
          },
          {
            type: "paragraph",
            text: `Where a scaffold fails inspection it is tagged out of use immediately and access to it is physically blocked rather than only marked. Records are kept at: ${records}.`,
          },
        ],
      },
    ];

    if (erects) {
      body.push({
        heading: "Building and Dismantling",
        blocks: [
          {
            type: "paragraph",
            text: "Erecting, altering and dismantling are done under the supervision of a competent person, by employees prepared for that work. Nobody helps out on a scaffold crew for the afternoon.",
          },
          { type: "paragraph", text: design },
          {
            type: "paragraph",
            text: "Before building starts, the crew establishes what it will bear on, whether the ground or structure will take it, what it has to be tied to, what will be overhead, and how close it will come to any electrical equipment or overhead line.",
          },
          {
            type: "paragraph",
            text: "Base plates and mud sills go on firm, level ground. Nothing is packed under a leg to level it — no blocks, no bricks, no offcuts. Where the ground will not do, it is prepared or the scaffold goes somewhere else.",
          },
          {
            type: "paragraph",
            text: "Dismantling is the more dangerous half and is where crews are most often hurt. It proceeds from the top down, in the reverse of the order it was built, and no component that is still carrying load is removed. Ties come off as the level above them comes down, not before, and nothing is thrown down.",
          },
          {
            type: "paragraph",
            text: "The area below is barriered and kept clear for the whole time material is being handled above.",
          },
        ],
      });
    }

    if (usesOthers) {
      body.push({
        heading: "Working From Somebody Else's Scaffold",
        blocks: [
          {
            type: "paragraph",
            text: `Before any ${company} employee steps onto a scaffold the Company did not build, they check the tag: that there is one, that it is green, and that its date is current.`,
          },
          {
            type: "paragraph",
            text: "They also look at it. A tag records somebody's opinion at a point in time, and things change — a plank moved overnight, a guardrail taken out to land material, a tie removed by another trade.",
          },
          {
            type: "paragraph",
            text: `No ${company} employee alters a scaffold the Company did not build. Not a plank, not a guardrail, not a tie, not for a moment. Where the scaffold does not suit the work, the crew stops and it is raised with whoever owns it.`,
          },
          {
            type: "paragraph",
            text: "A guardrail removed to land material is put back before anybody works there, by whoever owns the scaffold, and the scaffold is re-inspected.",
          },
        ],
      });
    }

    body.push({
      heading: "Using a Scaffold",
      blocks: [
        {
          type: "bullets",
          items: [
            "Access by the means provided — a ladder, stair or integral access. Nobody climbs the frame, and nobody climbs across from another structure.",
            "Guardrails and toeboards in place before anybody works from a platform, and put back immediately if they are ever removed.",
            "Platforms fully planked where people are working, with no gaps to step through and no unsupported plank ends.",
            "Nothing stacked on a platform beyond what the scaffold is built to carry, and loads spread rather than concentrated in one place.",
            "Materials and tools kept back from the edge, and toeboards or netting used where anything could fall to a level below.",
            "The area below barriered where material is being handled above.",
            "Nobody rides a scaffold while it is being moved, and a mobile scaffold's wheels are locked before anybody climbs it.",
            "Work stops in high wind, in ice, and where the platform cannot be kept clear enough to stand on.",
          ],
        },
        {
          type: "paragraph",
          text: "Where a task cannot be done from inside the guardrails, that is a reason to change the scaffold rather than to lean out of it, and the Company's fall protection program applies to anybody exposed while a platform is incomplete.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        erects
          ? "how scaffolds are built, altered, dismantled, inspected and tagged, and what employees check before working from one."
          : "what employees check before working from a scaffold, what the tags mean, and why nobody alters a scaffold the Company did not build.",
      policy: `It is the policy of ${company} that a scaffold without a current tag is not used, and that only a competent person decides otherwise.`,
      body,
      trainingPoints: [
        "What the tags mean, and that no tag means the scaffold is not used",
        "That only a competent person places, changes or removes a tag",
        "Never to alter a scaffold the Company did not build — not a plank, not a guardrail, not a tie",
        "To look at the scaffold as well as the tag, since things change between inspections",
        "To access by the means provided and never to climb the frame",
        erects
          ? "That dismantling is the more dangerous half, and goes top down in reverse order"
          : "To stop and raise it with whoever owns the scaffold when it does not suit the work",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through the difference between the competent person and the qualified person, blocking access to a scaffold that has failed inspection rather than only tagging it, and re-inspecting after weather, impact or any alteration.",
      reviewTrigger:
        "The review checks that the competent person list still matches who is actually inspecting and tagging on site.",
    });
  },
};
