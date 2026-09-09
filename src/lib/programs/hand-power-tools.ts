import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Hand and Power Tools.
 *
 * ## The injuries are small, constant, and entirely preventable
 *
 * This program will not save anybody's life the way the confined space one
 * might. What it prevents is the steady stream of hands, eyes and fingers
 * that make up most of a contractor's actual injury log — and those are what
 * a hiring client sees when they look at the numbers.
 *
 * ## The two that account for most of it
 *
 * A guard removed because it was in the way, and a damaged tool used because
 * replacing it would have cost twenty minutes. Both are decisions made under
 * time pressure by somebody who knew better, which means the useful content
 * is about making the safe choice the fast one: spares on the truck, a
 * replacement route that works the same day, and nobody having to explain
 * why they binned a cracked grinder.
 *
 * ## What it will not do
 *
 * Name a guard type, a wheel speed, a tool-specific inspection interval, or
 * an air pressure. Those come from the manufacturer's instructions for the
 * tool in hand, and a number printed here would compete with the label on the
 * tool itself.
 */

const Q = {
  responsible: "responsible_role",
  toolSource: "tool_source",
  inspection: "inspection_routine",
  damaged: "damaged_route",
  cords: "cord_protection",
  guards: "guard_rule",
  records: "records_location",
} as const;

const TOOL_SOURCE: Record<string, string> = {
  company_issued:
    "Tools are issued by the Company. Nobody brings their own onto a job, because the Company cannot maintain, inspect or vouch for a tool it did not supply.",
  company_and_personal:
    "Tools are normally issued by the Company. Where an employee uses their own, it is inspected to the same standard before it goes on a job, and anything that would take a Company tool out of service takes theirs out too.",
  mixed_with_site:
    "Tools are issued by the Company, and site-supplied tools are used where the site requires it. A site tool is inspected before use exactly as a Company one is, and is not used on the assumption that somebody else checked it.",
};

export const HAND_POWER_TOOLS: ProgramTemplate = {
  id: "hand_power_tools",
  title: "Hand and Power Tools",
  shortName: "Hand and Power Tools",
  requirementId: "hand-power-tools",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^hand ?(and|&) ?power tools?( safety)?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.toolSource,
      prompt: "Where do the tools come from?",
      kind: "choice",
      required: true,
      options: [
        { id: "company_issued", label: "The company issues all of them" },
        { id: "company_and_personal", label: "Company tools, plus some personal ones" },
        { id: "mixed_with_site", label: "Company tools, plus site-supplied where required" },
      ],
    },
    {
      id: Q.inspection,
      prompt: "How are tools checked?",
      kind: "choice",
      required: true,
      options: [
        { id: "before_use", label: "By the user, before each use" },
        { id: "before_use_and_periodic", label: "Before use, plus a periodic documented check" },
      ],
    },
    {
      id: Q.damaged,
      prompt: "What happens when someone finds a damaged tool?",
      help: "The real question is how quickly they get a working one.",
      kind: "choice",
      required: true,
      options: [
        { id: "spare_on_truck", label: "Swap it for a spare on the truck, same day" },
        { id: "tagged_and_returned", label: "Tag it, return it, get a replacement issued" },
      ],
    },
    {
      id: Q.guards,
      prompt: "What's the rule on removing a guard?",
      kind: "choice",
      required: true,
      options: [
        { id: "never", label: "Never — the tool goes out of service instead" },
        { id: "responsible_approves", label: "Only with approval, and only for a task that needs it" },
      ],
    },
    {
      id: Q.cords,
      prompt: "Do crews use ground fault protection on temporary power?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are tool records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const gfci = answers[Q.cords] === "yes";
    const periodic = answers[Q.inspection] === "before_use_and_periodic";
    const neverRemove = answers[Q.guards] === "never";
    const records = (answers[Q.records] ?? "").trim();

    const damaged =
      answers[Q.damaged] === "spare_on_truck"
        ? "Spares are carried so that a damaged tool can be swapped the same hour. That is deliberate: the reason damaged tools get used is that replacing one costs the crew time, and the Company removes that cost rather than relying on people to absorb it."
        : `A damaged tool is tagged, taken out of service, and returned to the ${role}, who issues a replacement the same day. Nobody waits until the end of a job to raise it, and nobody is asked to justify taking a tool out of service.`;

    const body: Section[] = [
      {
        heading: "Where the Tools Come From",
        blocks: [
          { type: "paragraph", text: TOOL_SOURCE[answers[Q.toolSource]] },
          {
            type: "paragraph",
            text: "Tools are used for what they were made for. A screwdriver is not a chisel, a wrench is not a hammer, and a grinder is not a cutting saw. Most tool injuries involve a tool being used for something adjacent to its purpose.",
          },
          {
            type: "paragraph",
            text: "The right tool for a job is provided rather than improvised. Where a crew does not have it, they say so and the job waits.",
          },
        ],
      },
      {
        heading: "Checking a Tool Before Using It",
        blocks: [
          {
            type: "paragraph",
            text: "The person about to use it checks it, every time:",
          },
          {
            type: "bullets",
            items: [
              "Guards present, secure, and moving freely where they are meant to",
              "Cord, plug and hose intact — no cuts, no tape over a repair, ground pin present",
              "Switch works properly, and does not stick on",
              "Handles, grips and auxiliary handles secure",
              "Blades, bits, wheels and discs sound, correctly fitted, and rated for the tool's speed",
              "No cracks in the body or the housing, and nothing loose or rattling",
              "Air tools: hose, fittings and couplings sound, and connections secured",
            ],
          },
          periodic
            ? {
                type: "paragraph",
                text: `In addition, the Company's tools are inspected periodically by somebody other than the usual user and the inspection is recorded. Records are kept at: ${records}.`,
              }
            : {
                type: "paragraph",
                text: `The ${role} keeps a record of the Company's tools and of any taken out of service, at: ${records}.`,
              },
        ],
      },
      {
        heading: "Damaged Tools",
        blocks: [
          {
            type: "paragraph",
            text: "A tool that fails any part of that check is taken out of service on the spot. Not at the end of the task, and not after one more cut.",
          },
          { type: "paragraph", text: damaged },
          {
            type: "paragraph",
            text: `Nobody at ${company} is questioned for taking a tool out of service, and nobody is asked whether it could have lasted the day. Somebody who expects that conversation will use the damaged tool.`,
          },
          {
            type: "paragraph",
            text: "Tools are not repaired with tape, wire or improvised parts. A cord repaired with tape is a cord that failed and is still in use.",
          },
        ],
      },
      {
        heading: "Guards",
        blocks: [
          {
            type: "paragraph",
            text: neverRemove
              ? "Guards are not removed, adjusted out of position, or wedged back. A tool whose guard is in the way of the task is the wrong tool for the task, and something else is used."
              : `Guards are not removed or defeated. Where a task genuinely cannot be done with the guard in place, the ${role} approves the arrangement in advance, in writing, with whatever additional protection replaces it — and the approval is for that task rather than standing.`,
          },
          {
            type: "paragraph",
            text: "A guard removed because it was slowing the work is the most common serious tool injury there is, and it is always a decision somebody made knowing better, under time pressure.",
          },
          {
            type: "paragraph",
            text: "A guard found removed on a tool is treated as the tool being out of service until it is back on and working.",
          },
        ],
      },
      {
        heading: "Using Them",
        blocks: [
          {
            type: "bullets",
            items: [
              "Eye protection whenever a tool cuts, grinds, drills, drives or produces chips or dust. Nearly every eye injury in this trade is somebody who was about to put glasses on.",
              "Hearing protection where the tool is loud, which is most powered tools in an enclosed space.",
              "Cut-resistant gloves for handling material — and no loose gloves, sleeves, jewelry or anything that can be caught in a rotating tool.",
              "Secure the work rather than holding it. A hand holding a piece is a hand in the path of the tool when it slips.",
              "Both hands on a tool designed for two, and the auxiliary handle fitted rather than in the box.",
              "Disconnect from power or air before changing a blade, bit, wheel or disc — and before clearing a jam.",
              "Let a tool stop before setting it down, and never carry one by its cord or hose.",
              "Stand out of the line the tool will travel if it binds and kicks back.",
            ],
          },
        ],
      },
    ];

    if (gfci) {
      body.push({
        heading: "Temporary Power",
        blocks: [
          {
            type: "paragraph",
            text: "Ground fault protection is used for tools on temporary power, on any job where the supply is not known to be permanently protected. It is checked before use rather than assumed to be working.",
          },
          {
            type: "paragraph",
            text: "A ground fault device that trips is telling the crew something. It is not reset repeatedly to get through a task — the tool and the cord are checked, and where the reason is not found, both come out of service.",
          },
          {
            type: "paragraph",
            text: "Cords are protected from traffic, from sharp edges, and from standing water. They are not run through doorways that close on them, and they are not hung on anything that could damage the sheath.",
          },
        ],
      });
    }

    body.push({
      heading: "Dust, Silica and Fumes",
      blocks: [
        {
          type: "paragraph",
          text: "Cutting, grinding, drilling and chasing produce dust, and dust from concrete, stone, brick and engineered stone carries silica. That is a serious health hazard rather than a nuisance, and the damage is permanent.",
        },
        {
          type: "paragraph",
          text: "Dust is controlled at the tool: water suppression, on-tool extraction, or a tool designed to capture it. Sweeping up dry and working in a cloud are not controls.",
        },
        {
          type: "paragraph",
          text: `Where dust cannot be controlled at the tool, respiratory protection is used under the Company's respiratory program — which means the person has to have been medically cleared and fit tested first, so it is arranged before the job rather than on the morning.`,
        },
        {
          type: "paragraph",
          text: "Petrol and diesel tools are not run indoors or in enclosed spaces. Carbon monoxide gives no warning, and people are killed by generators and saws running in spaces that felt open enough.",
        },
      ],
    });

    body.push({
      heading: "Cartridge and Powder-Actuated Tools",
      blocks: [
        {
          type: "paragraph",
          text: "Only employees specifically prepared and authorized for the particular tool use one. Being competent with power tools generally does not carry over.",
        },
        {
          type: "paragraph",
          text: "The tool is never loaded until immediately before use, is never left loaded and unattended, and is never pointed at anybody whether or not it is loaded. It is not fired into material that could let the fastener pass through, or near an edge that could break away.",
        },
        {
          type: "paragraph",
          text: "A tool that misfires is held against the work for the manufacturer's stated wait before it is opened. Cartridges are kept secure and away from heat.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how tools are provided, checked before use, taken out of service when damaged, and used — including the dust and fumes some of them produce.",
      policy: `It is the policy of ${company} that a damaged tool comes out of service immediately and is replaced without anybody having to justify it, and that a guard is never the thing that gets removed to make a job quicker.`,
      body,
      trainingPoints: [
        "To check the tool yourself before every use, including cord, guard and switch",
        "That a damaged tool comes out of service on the spot, and nobody will question you for it",
        "That guards are not removed — a tool whose guard is in the way is the wrong tool",
        "To disconnect from power or air before changing a blade or clearing a jam",
        "To secure the work rather than hold it",
        "That dust from concrete and stone is a permanent health hazard, and is controlled at the tool",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through keeping spares available so replacing a tool is not a delay, checking that guards are still on partway through a job, and arranging respiratory protection before a dusty job rather than on the morning of it.",
      reviewTrigger:
        "The review looks at what tools have been taken out of service, since a type that keeps failing is a purchasing decision rather than a series of accidents.",
    });
  },
};
