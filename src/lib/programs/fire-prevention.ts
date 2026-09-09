import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Fire Prevention and Protection.
 *
 * ## The sentence most fire programs get wrong
 *
 * Most contractor fire programs read as though every employee is expected to
 * fight a fire. They are not, and a document that implies otherwise puts
 * somebody between a fire and the exit while they decide.
 *
 * So the rule here is stated in the order it has to be acted on: raise the
 * alarm, get people out, and only then, if the fire is small and somebody is
 * trained and the exit is behind them, consider an extinguisher. Nobody is
 * ever required to, and the document says that in the plainest words
 * available.
 *
 * ## The prevention half is where the value is
 *
 * A subcontractor is far more likely to start a fire than to be caught in
 * somebody else's. Hot work, temporary power, flammable storage, charging
 * batteries, and accumulated combustible waste are the five that do it, and
 * four of those are housekeeping.
 *
 * ## What it will not do
 *
 * Name an extinguisher rating, a travel distance, a storage quantity, or an
 * inspection interval beyond what a person can verify by looking. Those come
 * from the applicable code and the site, and printing one here would compete
 * with the tag on the extinguisher.
 */

const Q = {
  responsible: "responsible_role",
  extinguishers: "extinguisher_use",
  flammables: "flammable_storage",
  hotWork: "hot_work_done",
  waste: "waste_routine",
  charging: "battery_charging",
  records: "records_location",
} as const;

const FLAMMABLES: Record<string, string> = {
  approved_cabinet:
    "Flammable liquids are kept in approved containers inside a marked storage cabinet, in quantities no larger than the work needs. Nothing is decanted into an unmarked container, and nothing is stored in a walkway, a stairwell, or against an exit.",
  outside_store:
    "Flammable liquids are kept outside the building in a marked, ventilated store away from ignition sources and away from where people gather. Only what a shift needs comes to the work area, in approved containers.",
  site_provided:
    "Flammable liquids are stored in the facilities the site provides, on the site's terms, which the supervisor establishes before bringing anything on. Only what a shift needs comes to the work area, in approved containers.",
};

export const FIRE_PREVENTION: ProgramTemplate = {
  id: "fire_prevention",
  title: "Fire Prevention and Protection",
  shortName: "Fire Prevention",
  requirementId: "fire-prevention",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^fire (prevention|protection|safety)( ?(and|&) ?(prevention|protection))?( program| plan)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.extinguishers,
      prompt: "Are your people expected to use an extinguisher?",
      help: "Nobody should ever be required to. The question is whether they may.",
      kind: "choice",
      required: true,
      options: [
        { id: "evacuate_only", label: "No — get out and let the fire service handle it" },
        { id: "trained_may", label: "Those trained may, on a small fire, if the exit is clear" },
      ],
    },
    {
      id: Q.flammables,
      prompt: "Where are flammable liquids kept?",
      kind: "choice",
      required: true,
      options: [
        { id: "approved_cabinet", label: "An approved cabinet" },
        { id: "outside_store", label: "An outside store" },
        { id: "site_provided", label: "Wherever the site provides" },
      ],
    },
    {
      id: Q.hotWork,
      prompt: "Do your crews do hot work — welding, cutting, grinding?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.charging,
      prompt: "Do you charge tool or equipment batteries on site or in the yard?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.waste,
      prompt: "How is combustible waste dealt with?",
      kind: "choice",
      required: true,
      options: [
        { id: "end_of_shift", label: "Cleared at the end of every shift" },
        { id: "as_generated", label: "Cleared as it is produced" },
        { id: "site_skips", label: "Into the site's bins as we go" },
      ],
    },
    {
      id: Q.records,
      prompt: "Where are extinguisher checks and fire records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const mayFight = answers[Q.extinguishers] === "trained_may";
    const hotWork = answers[Q.hotWork] === "yes";
    const charging = answers[Q.charging] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const waste =
      answers[Q.waste] === "as_generated"
        ? "Combustible waste — offcuts, packaging, rags, sawdust, insulation — is cleared as it is produced rather than allowed to accumulate. A pile that has been there since Tuesday is fuel with an ignition source somewhere nearby."
        : answers[Q.waste] === "site_skips"
          ? "Combustible waste goes into the site's bins as work produces it, rather than accumulating at the work area and being moved at the end. Oily and solvent-soaked rags are kept separate, in a covered metal container, and are never left in a pile."
          : "Combustible waste is cleared from the work area at the end of every shift, and sooner where it is accumulating faster than that. Nothing combustible is left overnight next to where hot work or temporary power will be the next morning.";

    const body: Section[] = [
      {
        heading: "If There Is a Fire",
        blocks: [
          {
            type: "paragraph",
            text: "In this order, and the order is the point:",
          },
          {
            type: "numbered",
            items: [
              "Raise the alarm. Whatever the alarm is at that location — a call point, a shout, a radio, the site's system.",
              "Get people out, by the nearest safe route, to the assembly point for that location.",
              "Call the emergency number for that location, or have somebody else call while the area is cleared.",
              mayFight
                ? "Only then, and only if the fire is small, you know how to use the extinguisher, and your way out is behind you: consider using one."
                : "Stay out. Nobody employed by the Company fights a fire.",
            ],
          },
          {
            type: "paragraph",
            text: mayFight
              ? `No employee of ${company} is ever required to use an extinguisher, and nobody is questioned for choosing not to. Anybody who tries and finds the fire is not going out immediately leaves — an extinguisher gives seconds, not minutes.`
              : `No employee of ${company} is expected to fight a fire, and nobody is questioned for leaving one. Property is replaceable and the Company would rather lose all of it.`,
          },
          {
            type: "paragraph",
            text: "Nobody re-enters for tools, for a vehicle, or for anything else, and nobody re-enters until the person in charge of the location says it is safe.",
          },
          {
            type: "paragraph",
            text: `Before work starts at any location, the supervisor establishes what the alarm is there, where the exits and assembly point are, and how the emergency services are called. That is recorded with the site information under the Company's emergency action plan.`,
          },
        ],
      },
      {
        heading: "Keeping Ways Out Clear",
        blocks: [
          {
            type: "paragraph",
            text: "Exit routes, stairways, doors and the areas in front of them are kept clear. Not mostly clear, and not clear except for the delivery that arrived this morning.",
          },
          {
            type: "paragraph",
            text: "Nothing the Company brings onto a site blocks an exit, a fire door, an extinguisher, a call point, a hydrant, or a sprinkler head. Material and equipment are placed with that checked rather than noticed afterwards.",
          },
          {
            type: "paragraph",
            text: "Where the Company's work will obstruct a route — scaffolding across a stairwell, a cable across a doorway — the alternative route is agreed with the site before the work starts and everybody working there is told what it is.",
          },
          {
            type: "paragraph",
            text: "Fire doors are not wedged open, including for a task that will only take a minute.",
          },
        ],
      },
      {
        heading: "Fuel and Ignition",
        blocks: [
          { type: "paragraph", text: FLAMMABLES[answers[Q.flammables]] },
          { type: "paragraph", text: waste },
          {
            type: "paragraph",
            text: "Oily and solvent-soaked rags are the one most people underestimate: they can heat up on their own and catch fire with no ignition source at all. They go into a covered metal container, and are never left in a heap or in a general waste bag.",
          },
          {
            type: "paragraph",
            text: "Compressed gas cylinders are secured upright, kept away from heat and from the work, and stored with fuel gas apart from oxygen. Valve caps go on whenever a cylinder is not in use.",
          },
          {
            type: "paragraph",
            text: "Temporary power and extension cords are inspected before use, kept out of water and away from damage, and not overloaded or daisy-chained. Smoking is only where the site permits it, and never near stored fuel or where the Company's work has been done.",
          },
        ],
      },
    ];

    if (hotWork) {
      body.push({
        heading: "Hot Work",
        blocks: [
          {
            type: "paragraph",
            text: `Hot work is the most likely way ${company} would start a fire, and it is handled under the Company's hot work program: a permit, the area prepared, the atmosphere tested where flammable vapor could be present, and a fire watch that stays after the work stops.`,
          },
          {
            type: "paragraph",
            text: "The point worth repeating here is that these fires characteristically start after the work has finished. A spark travels, lodges somewhere out of sight, smoulders, and finds air later — which is why the fire watch outlasts the job and somebody returns to check again afterwards.",
          },
        ],
      });
    }

    if (charging) {
      body.push({
        heading: "Charging Batteries",
        blocks: [
          {
            type: "paragraph",
            text: "Tool and equipment batteries are charged in a clear area, away from combustible material, on a hard surface — not on a bench covered in rags, not in a truck bed, and not in a gang box among packaging.",
          },
          {
            type: "paragraph",
            text: "Only the charger made for the battery is used. A battery that is swollen, damaged, hot to the touch, or has been dropped hard is taken out of service and not charged again.",
          },
          {
            type: "paragraph",
            text: "Batteries are not left charging unattended overnight where that can be avoided, and where charging happens in the yard or an office, that area is covered by whatever detection the premises have.",
          },
        ],
      });
    }

    body.push({
      heading: "Extinguishers and Equipment",
      blocks: [
        {
          type: "paragraph",
          text: "Extinguishers are provided at the Company's own premises and are taken to jobs where the work calls for them — hot work in particular. Each is the right type for what is likely to burn there.",
        },
        {
          type: "paragraph",
          text: "They are kept where they can be reached, unobstructed, and clearly visible. An extinguisher behind a stack of material is not an extinguisher.",
        },
        {
          type: "paragraph",
          text: "Anybody can check the things that matter by looking: it is in its place, the pin and seal are intact, the pressure gauge is in the green, the hose and horn are undamaged, and the inspection tag is current. That check happens monthly and before any job the extinguisher is taken to.",
        },
        {
          type: "paragraph",
          text: `Servicing is done by whoever is qualified to do it, on the schedule the equipment requires. Any extinguisher that has been discharged — even briefly, even by accident — is taken out of service and recharged rather than put back. Records are kept at: ${records}.`,
        },
        {
          type: "paragraph",
          text: `On a client's site, the site's fire equipment and arrangements govern, and the supervisor establishes where the equipment is and how the alarm works before the crew starts. The ${role} is told where a site's provision looks inadequate for the work the Company is doing.`,
        },
      ],
    });

    body.push({
      heading: "After Any Fire",
      blocks: [
        {
          type: "paragraph",
          text: "Every fire is reported under the Company's incident reporting program, including one that went out on its own, one put out with an extinguisher, and one that never left a waste bin.",
        },
        {
          type: "paragraph",
          text: "The small ones are the useful ones. A fire that went out by itself is the same event as one that did not, minus the luck, and it is the cheapest warning the Company will get about how its work starts fires.",
        },
        {
          type: "paragraph",
          text: "The investigation asks what the fuel was, what the ignition source was, and which of the two the Company could most easily have removed — not who was holding the tool.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "what employees do if there is a fire, how the Company keeps ways out clear, and how it keeps fuel and ignition sources apart on the jobs it does.",
      policy: mayFight
        ? `It is the policy of ${company} that the alarm is raised and people are got out before anything else, and that no employee is ever required to use an extinguisher.`
        : `It is the policy of ${company} that the alarm is raised and everybody leaves. No employee is expected to fight a fire, and property is not worth anybody staying for.`,
      body,
      trainingPoints: [
        "The order: raise the alarm, get out, call — in that order",
        mayFight
          ? "That you are never required to use an extinguisher, and that you leave if the fire does not go out at once"
          : "That nobody here fights a fire, and nobody will be questioned for leaving one",
        "Never to block an exit, a fire door, an extinguisher or a call point",
        "That oily and solvent-soaked rags can catch fire on their own, and where they go",
        "Where the alarm, exits and assembly point are at the site you are on today",
        "To report every fire, including the ones that went out by themselves",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through establishing the alarm, exits and fire equipment at a new site before the crew starts, agreeing an alternative route when the Company's work will obstruct one, and checking that material has not been stacked against an exit or an extinguisher.",
      reviewTrigger:
        "The review reads the small fires together, since the same fuel or the same ignition source appearing twice is a pattern neither one shows alone.",
    });
  },
};
