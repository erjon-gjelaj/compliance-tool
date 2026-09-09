import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Housekeeping.
 *
 * ## The program that sounds trivial and is not
 *
 * Slips, trips and falls on the level are the single largest category in most
 * contractors' injury logs, and a messy work area is behind a large share of
 * the fires, the struck-by injuries and the damaged tools as well. Clients
 * also read housekeeping as a proxy for everything else — a walk through a
 * contractor's area tells them more about how the company is run than the
 * paperwork does.
 *
 * ## What makes it work is that it is somebody's job
 *
 * "Everybody is responsible for housekeeping" is where these programs fail.
 * It sounds right and it assigns nothing, which is why the area at the end of
 * a shift is always somebody else's problem. So the document names who and
 * when, and makes clearing up part of the task rather than a thing done
 * afterwards if there is time.
 *
 * ## Deliberately concrete
 *
 * A housekeeping program full of words like "orderly" and "maintained" is
 * unactionable. The content here is what somebody can actually check by
 * walking the area.
 */

const Q = {
  responsible: "responsible_role",
  cleanupTiming: "cleanup_timing",
  walkways: "walkway_rule",
  materials: "material_storage",
  inspections: "area_inspections",
  records: "records_location",
} as const;

const TIMING: Record<string, string> = {
  as_you_go:
    "Clearing up is part of the work rather than something done at the end of it. Offcuts, packaging and waste go into the bin as they are produced, and a task is not finished until the area is.",
  end_of_task:
    "The area is cleared at the end of each task, before the crew moves on to the next one. Moving on and coming back later is how a work area accumulates, and it is not how the Company works.",
  end_of_shift:
    "The area is cleared before the end of each shift, and sooner where waste is accumulating faster than that. Nothing is left for the next crew or the next morning.",
};

export const HOUSEKEEPING: ProgramTemplate = {
  id: "housekeeping",
  title: "Housekeeping",
  shortName: "Housekeeping",
  requirementId: "housekeeping",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^housekeeping( ?(and|&) ?(material storage|storage))?( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.cleanupTiming,
      prompt: "When does the crew clear up?",
      help: "This is the whole program. Everything else follows from it.",
      kind: "choice",
      required: true,
      options: [
        { id: "as_you_go", label: "As they go — it's part of the task" },
        { id: "end_of_task", label: "At the end of each task" },
        { id: "end_of_shift", label: "Before the end of each shift" },
      ],
    },
    {
      id: Q.walkways,
      prompt: "What's the rule on blocking a walkway?",
      kind: "choice",
      required: true,
      options: [
        { id: "never", label: "Never — material goes somewhere else" },
        { id: "marked_alternative", label: "Only with a marked alternative route in place" },
      ],
    },
    {
      id: Q.materials,
      prompt: "Where does material go when it arrives on site?",
      kind: "choice",
      required: true,
      options: [
        { id: "designated_area", label: "A laydown area agreed before delivery" },
        { id: "near_work", label: "Near the work, in what the crew needs that day" },
        { id: "site_directs", label: "Wherever the site directs" },
      ],
    },
    {
      id: Q.inspections,
      prompt: "Does anyone walk the area and look?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are area inspection records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const inspections = answers[Q.inspections] === "yes";
    const neverBlock = answers[Q.walkways] === "never";
    const records = (answers[Q.records] ?? "").trim();

    const materials =
      answers[Q.materials] === "near_work"
        ? "Only what a crew needs for the work in hand comes to the work area. Bulk material is kept away from where people are working, so that the area does not fill up with what will be needed on Thursday."
        : answers[Q.materials] === "site_directs"
          ? "Material goes where the site directs, and the supervisor establishes that before anything is delivered rather than while a truck is waiting. Only what the crew needs that day comes to the work area."
          : "A laydown area is agreed before material is delivered, and deliveries go there rather than to wherever the truck could reach. Only what a crew needs for the work in hand comes to the work area.";

    const body: Section[] = [
      {
        heading: "Why This Is Not a Small Thing",
        blocks: [
          {
            type: "paragraph",
            text: "Slips, trips and falls on the level are the largest single category of injury in this kind of work. They are also the ones people find least worth writing down, which is part of why they keep happening.",
          },
          {
            type: "paragraph",
            text: `A cluttered work area is also behind a share of the fires, the struck-by injuries, the damaged tools, and the time spent looking for things. Clearing up is not tidying — it is removing hazards that have accumulated.`,
          },
          {
            type: "paragraph",
            text: `Clients read a walk through a contractor's area as a proxy for how the whole company is run, and they are usually right to.`,
          },
        ],
      },
      {
        heading: "Whose Job It Is",
        blocks: [
          {
            type: "paragraph",
            text: "The crew doing the work is responsible for the area they are working in. Not everybody in general — the crew whose work made the mess.",
          },
          { type: "paragraph", text: TIMING[answers[Q.cleanupTiming]] },
          {
            type: "paragraph",
            text: "Time to clear up is included when a job is planned and estimated. Where it is not, it is what gets dropped when a job runs late, and this program becomes a document rather than a practice.",
          },
          {
            type: "paragraph",
            text: "The supervisor for the job checks the area before the crew leaves it. A crew that has left is a crew that cannot be asked to come back.",
          },
        ],
      },
      {
        heading: "What Good Looks Like",
        blocks: [
          {
            type: "paragraph",
            text: "Concretely, so that it can be checked by walking the area rather than judged:",
          },
          {
            type: "bullets",
            items: [
              "Walkways, stairs and access routes clear from end to end — not mostly clear",
              "Nothing stored against an exit, a fire door, an extinguisher, a call point, an eyewash or an electrical panel",
              "Cords and hoses routed along edges or overhead, not across where people walk",
              "Spills cleaned up when they happen, and the area marked until they are",
              "Offcuts, packaging and waste in a bin rather than in a pile that will be dealt with later",
              "Tools back in the box or the truck when the task is done, not left where somebody will stand on them",
              "Material stacked so it will not slide, topple or roll, and stacked below the height it becomes unstable",
              "Protruding nails, screws and reinforcement bent over, removed, or capped",
              "Enough light to see the floor in every area people walk through",
            ],
          },
        ],
      },
      {
        heading: "Walkways and Access",
        blocks: [
          {
            type: "paragraph",
            text: neverBlock
              ? "A walkway, stairway or access route is not blocked. Material that will not fit anywhere else goes somewhere else — off site if necessary — rather than into the route people use to get out."
              : "Where the Company's work has to obstruct a walkway, stairway or access route, an alternative is marked and in place before the obstruction goes in, and everybody working in the area is told what it is. An obstruction is never left with people expected to work it out.",
          },
          {
            type: "paragraph",
            text: "Anything that has to sit temporarily where people walk is barriered and marked while it is there, and is moved as soon as the task allows rather than at the end of the job.",
          },
          {
            type: "paragraph",
            text: "Changes in level, trip edges, open penetrations and trailing services are the ones people are hurt by. They are covered, ramped, guarded or marked the moment they are created.",
          },
        ],
      },
      {
        heading: "Material and Storage",
        blocks: [
          { type: "paragraph", text: materials },
          {
            type: "paragraph",
            text: "Stacks are on a firm level base, are not leaned against a wall or a structure to keep them up, and are not stacked so high that the bottom of the stack is carrying more than it should. Round material is chocked so it cannot roll.",
          },
          {
            type: "paragraph",
            text: "Nothing is stored on top of a cabinet, a container or a structure where it could be knocked off onto somebody below, and nothing is stored where it obstructs a sprinkler head or a light.",
          },
          {
            type: "paragraph",
            text: "Waste is separated where the site requires it, and flammable and oily waste is kept apart from general waste in a covered container under the Company's fire prevention program.",
          },
        ],
      },
    ];

    if (inspections) {
      body.push({
        heading: "Walking the Area",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role}, or a supervisor, walks the Company's work areas regularly and looks at them against the list above. This is a walk rather than a form: the point is to see the area as somebody arriving would.`,
          },
          {
            type: "paragraph",
            text: "Anything found is dealt with there and then where that takes minutes. Anything that cannot be is recorded with who is doing it and by when, and is followed up rather than filed.",
          },
          {
            type: "paragraph",
            text: `Records are kept at: ${records}. They are read together rather than one at a time — the same finding appearing across several walks is a problem with how jobs are planned or resourced, not with the crew on the day.`,
          },
          {
            type: "paragraph",
            text: "Findings are not used as a basis for disciplining a crew. A walk that people learn to fear produces an area that is clean on Thursdays.",
          },
        ],
      });
    }

    body.push({
      heading: "Leaving a Client's Site",
      blocks: [
        {
          type: "paragraph",
          text: `${company} leaves a client's area in the condition it would want to find it. Material and waste generated by the Company's work are removed rather than left for the site, and anything the Company moved is put back.`,
        },
        {
          type: "paragraph",
          text: "Where the work is not finished, the area is left safe overnight: nothing that could fall, nothing blocking a route, nothing that another trade could walk into in poorer light.",
        },
        {
          type: "paragraph",
          text: "Where the Company inherits an area that is not safe to work in, that is raised with site control before work starts rather than worked around.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "who clears the work area and when, what a clear area actually looks like, and how material is stored so it does not become the hazard.",
      policy: `It is the policy of ${company} that clearing up is part of the work rather than something done afterwards if there is time, and that the crew whose work made the mess is the crew that clears it.`,
      body,
      trainingPoints: [
        "That slips and trips on the level are the biggest single category of injury in this work",
        "That your crew clears the area your work made, and that time for it is in the plan",
        "Never to store anything against an exit, an extinguisher, an eyewash or an electrical panel",
        "To route cords and hoses along edges or overhead rather than across a walkway",
        "To deal with a spill or a trip hazard when you see it rather than reporting it and walking on",
        "That an area is left safe overnight even when the work is not finished",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through including clean-up time when a job is planned, checking the area before a crew leaves it, and arranging an alternative route before the Company's work obstructs one.",
      reviewTrigger:
        "The review asks whether housekeeping is what gets dropped when jobs run late, since that is a planning finding rather than a housekeeping one.",
    });
  },
};
