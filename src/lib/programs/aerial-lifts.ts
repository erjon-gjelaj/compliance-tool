import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Aerial Lifts and Elevating Work Platforms.
 *
 * ## The distinction most programs get wrong
 *
 * A harness in a boom lift protects against being catapulted out — booms
 * whip, and that is what kills people in them. A harness in a scissor lift
 * does not do the same job, because a scissor lift does not whip; it tips,
 * and being tethered to something that is going over is not protection.
 *
 * Contractor programs routinely write "wear a harness in a lift" as one rule,
 * which is wrong in one direction or the other depending on the machine. This
 * one keeps them apart and says why, because the reasoning is what makes the
 * rule stick.
 *
 * ## The other killer is overhead
 *
 * The two ways people die in these machines are being catapulted from a boom
 * and being electrocuted by contacting an overhead line. Both are decided
 * before anybody goes up, and both are about where the machine is placed.
 *
 * ## What it will not do
 *
 * State a clearance distance from power lines, a wind speed limit, a load
 * rating, or an inspection interval. Those come from the machine's own manual
 * and plate and from the applicable standard, and a number here would compete
 * with the one on the machine.
 */

const Q = {
  responsible: "responsible_role",
  types: "lift_types",
  authorized: "who_operates",
  inspection: "inspection_routine",
  rescue: "rescue_plan",
  overhead: "overhead_check",
  records: "records_location",
} as const;

export const AERIAL_LIFTS: ProgramTemplate = {
  id: "aerial_lifts",
  title: "Aerial Lifts and Elevating Work Platforms",
  shortName: "Aerial Lifts",
  requirementId: "aerial-lifts",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(aerial lifts?|elevating work platforms?|mewps?|aerial lifts? ?(and|&) ?elevating work platforms?)( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.types,
      prompt: "What kind of lifts do your crews use?",
      help: "The harness rule is different for each, so this matters.",
      kind: "choice",
      required: true,
      options: [
        { id: "boom", label: "Boom lifts — articulating or telescopic" },
        { id: "scissor", label: "Scissor lifts" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.authorized,
      prompt: "Who is allowed to operate one?",
      kind: "choice",
      required: true,
      options: [
        { id: "named_list", label: "A named list, by machine type" },
        { id: "card_holders", label: "Anyone holding a current operator card for that type" },
      ],
    },
    {
      id: Q.inspection,
      prompt: "How are lifts checked?",
      kind: "choice",
      required: true,
      options: [
        { id: "each_shift", label: "By the operator before each shift" },
        { id: "shift_and_periodic", label: "Before each shift, plus a documented periodic inspection" },
      ],
    },
    {
      id: Q.overhead,
      prompt: "How do crews establish what's overhead before positioning a lift?",
      kind: "choice",
      required: true,
      options: [
        { id: "planned", label: "It's part of planning the job, before the machine arrives" },
        { id: "on_arrival", label: "The operator walks the area before setting up" },
      ],
    },
    {
      id: Q.rescue,
      prompt: "Do you have a plan for getting someone down if the lift fails?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are inspection and operator records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const boom = answers[Q.types] !== "scissor";
    const scissor = answers[Q.types] !== "boom";
    const rescue = answers[Q.rescue] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const authorized =
      answers[Q.authorized] === "card_holders"
        ? `Only employees holding a current operator card for that type of machine operate one. The ${role} keeps copies and checks they are current, since a card that expired is treated exactly as no card.`
        : `The ${role} keeps a written list, by name, of who is authorized to operate each type of machine. Being authorized on a scissor lift does not authorize somebody on a boom, and the list says which.`;

    const body: Section[] = [
      {
        heading: "Harnesses: Not the Same Rule for Both",
        blocks: [
          {
            type: "paragraph",
            text: "This is the part contractor programs most often get wrong, by writing one rule for every machine.",
          },
          {
            type: "table",
            head: ["Machine", "What is worn", "Why"],
            rows: [
              [
                "Boom lift",
                "A full body harness with a short lanyard, attached to the anchor point inside the platform",
                "A boom whips. Contact with a structure, a sudden stop, or driving over a hole can catapult somebody clean out of the basket, and the harness is what keeps them in it.",
              ],
              [
                "Scissor lift",
                "Guardrails, kept closed. A harness only where the manufacturer or the site requires one",
                "A scissor lift does not whip; it tips. Being tethered to a machine that is going over does not help, and the protection is keeping it upright and staying inside the rails.",
              ],
            ],
          },
          {
            type: "paragraph",
            text: boom
              ? "In a boom lift the lanyard is attached to the anchor point the manufacturer provides inside the platform — never to a structure outside it. Somebody attached to a building while the machine moves away from it is in more danger than somebody attached to nothing."
              : "Where a scissor lift is fitted with an anchor point and the manufacturer or the site requires a harness, it is worn and attached to that point.",
          },
          {
            type: "paragraph",
            text: "The lanyard is short enough that nobody can get out of the platform while attached. A long lanyard in a basket lets somebody climb the rails, which is the thing it is meant to prevent.",
          },
        ],
      },
      {
        heading: "Who May Operate One",
        blocks: [
          { type: "paragraph", text: authorized },
          {
            type: "paragraph",
            text: "Authorization is per machine type, and per machine where the controls differ meaningfully. Somebody who has operated one manufacturer's boom is not thereby familiar with another's, and the few minutes spent reading the controls before going up is time this program expects to be taken.",
          },
          {
            type: "paragraph",
            text: "Nobody operates a machine they have not been authorized on, including to move it a few feet, including to get it off a truck.",
          },
        ],
      },
      {
        heading: "Before It Goes Up",
        blocks: [
          {
            type: "paragraph",
            text:
              answers[Q.overhead] === "planned"
                ? "What is overhead is established when the job is planned, before the machine is even ordered — power lines, structures, pipework, ducting, and anything the platform could contact at height."
                : "The operator walks the area before setting up and establishes what is overhead — power lines, structures, pipework, ducting, and anything the platform could contact at height.",
          },
          {
            type: "paragraph",
            text: "Overhead lines are treated as live and uninsulated unless their owner has confirmed otherwise in writing. Electrocution from contact with a line is one of the two ways people are killed in these machines, and it is decided entirely by where the machine is put.",
          },
          {
            type: "paragraph",
            text: "The ground is checked as well: that it will take the machine's weight, that it is level enough, and that there are no holes, covers, drains, trenches or soft ground where a wheel will go. On a suspended floor or a slab over a void, what it will carry is established before the machine is driven onto it.",
          },
          {
            type: "paragraph",
            text: "The area around and below the machine is barriered so that nobody walks under the platform or into the path of the machine, and traffic is kept away from it.",
          },
        ],
      },
      {
        heading: "Checking the Machine",
        blocks: [
          {
            type: "paragraph",
            text: "The operator checks the machine before each shift, at ground level first and then through a function test:",
          },
          {
            type: "bullets",
            items: [
              "Tires, wheels and — where fitted — outriggers and stabilizers",
              "Hydraulic hoses, fittings and rams, and the ground beneath the machine for leaks",
              "Guardrails, gate and toeboards secure, and the gate closing properly",
              "Anchor points, where fitted, sound and undamaged",
              "Controls at the platform and at ground level, including the emergency stop and the ground-level override",
              "Alarms, lights, horn and the tilt alarm where fitted",
              "The load and capacity plate present and legible, and the manual on the machine",
              "A function test through the full range before anybody goes up to work",
            ],
          },
          {
            type: "paragraph",
            text: `A machine that fails any of it is tagged out of service and not used. Records are kept at: ${records}.`,
          },
        ],
      },
      {
        heading: "Operating It",
        blocks: [
          {
            type: "bullets",
            items: [
              "Stay inside the platform, with both feet on the floor. Nobody climbs, sits or stands on the rails, and nobody uses a ladder or a box in the basket to gain height.",
              "The gate is closed and latched before the platform moves.",
              "The platform is not overloaded — people, tools and material together, against the plate on the machine rather than an estimate.",
              "Loads are kept inside the platform, not slung from the rails or carried outside them.",
              "The machine is not used to lift or drag material, or as a crane.",
              "Nobody transfers from a platform to a structure, or back, unless the machine and the site both provide for it.",
              "Drive with the platform lowered wherever the work allows, and travel at a speed suited to the ground.",
              "Watch for the tail swing on a boom — it goes the other way and is where people on the ground are crushed.",
              "Stop work in wind, and follow whatever the machine's manual says about it rather than judging by feel.",
            ],
          },
          {
            type: "paragraph",
            text: "Nobody works alone in an elevated platform. Somebody at ground level is present who knows how to use the ground-level controls and can bring the platform down.",
          },
        ],
      },
    ];

    if (rescue) {
      body.push({
        heading: "Getting Somebody Down",
        blocks: [
          {
            type: "paragraph",
            text: "Before anybody goes up, it is settled how they would be brought down if the machine failed, if the operator became unwell, or if somebody in a boom lift ended up suspended in their harness.",
          },
          {
            type: "paragraph",
            text: "Somebody at ground level knows how to operate the ground-level controls for that machine, and has been shown on that machine rather than told about it in general.",
          },
          {
            type: "paragraph",
            text: "Where the machine has an emergency lowering system, the person at ground level knows where it is and how it works, and it is checked as part of the pre-use inspection.",
          },
          {
            type: "paragraph",
            text: "Where somebody in a boom is left suspended in their harness after being thrown from the platform, that is a suspension emergency and the Company's fall protection program applies: they are brought down in minutes, not after the emergency services have been called and have arrived.",
          },
        ],
      });
    }

    if (scissor && boom) {
      body.push({
        heading: "Choosing Between Them",
        blocks: [
          {
            type: "paragraph",
            text: "The machine is chosen for the work rather than for what is on the yard. A scissor lift reaches straight up and needs a level surface; a boom reaches out and over and can work from rougher ground.",
          },
          {
            type: "paragraph",
            text: "Using a scissor lift where a boom is needed is what leads to somebody leaning out over the rails, which is the most common way people fall from one.",
          },
        ],
      });
    }

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company decides who may operate an elevating work platform, what is established before one is positioned, how the machine is checked, and what is worn in it.",
      policy: `It is the policy of ${company} that a lift is positioned only after what is overhead and underneath has been established, and that nobody works from an elevated platform without somebody at ground level who can bring them down.`,
      body,
      trainingPoints: [
        boom
          ? "That a harness in a boom lift keeps you in the basket, and is attached to the platform and never to a structure"
          : "That the guardrails are the protection in a scissor lift, and the gate stays closed",
        "That authorization is per machine type, and per machine where the controls differ",
        "That overhead lines are live until their owner says otherwise in writing",
        "To stay inside the platform with both feet on the floor — never on the rails, never on a ladder in the basket",
        "That somebody at ground level has to be there who can bring the platform down",
        "To check the ground for holes, covers, drains and soft spots before positioning",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through establishing what is overhead when the job is planned rather than on the morning, checking the machine matches the work, and confirming somebody on the ground has been shown the emergency lowering on that machine.",
      reviewTrigger:
        "The review checks that operator authorizations still match the machine types actually in use, since a hire fleet changes without anybody deciding it should.",
    });
  },
};
