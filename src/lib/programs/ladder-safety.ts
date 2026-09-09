import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Ladder Safety.
 *
 * ## The most-used piece of equipment and the least-planned
 *
 * Ladder falls are common, are usually from low heights, and are almost never
 * the result of anybody deciding to do something dangerous. They happen
 * because a ladder was the fastest thing to hand for a two-minute job.
 *
 * So the useful content is not a list of ladder parts. It is the decision
 * before the ladder comes off the truck — whether this job wants a ladder at
 * all — and the three or four specific things that account for most falls:
 * the wrong angle, the top not secured, reaching sideways, and carrying
 * something up.
 *
 * ## What it will not do
 *
 * State a duty rating, an angle in degrees, a height above the landing in
 * feet, or a maximum working height. Those come from the manufacturer's
 * markings and the standard that applies, and printing a number invented here
 * would be worse than useless on a ladder that says something different on
 * its own label.
 *
 * The four-to-one rule appears because it is a way of setting a ladder rather
 * than a regulatory figure, and the document presents it as the practical
 * method it is.
 */

const Q = {
  responsible: "responsible_role",
  types: "ladder_types",
  inspection: "inspection_route",
  damaged: "damaged_route",
  alternatives: "alternatives_first",
  records: "records_location",
} as const;

const DAMAGED: Record<string, string> = {
  destroyed:
    "A ladder taken out of service is destroyed or cut up so that it cannot be put back into use by somebody who does not know why it was set aside. A damaged ladder leaning in a corner will be used by somebody in a hurry.",
  tagged_and_removed:
    "A ladder taken out of service is tagged and removed from the work area the same day, and is not left where anybody could pick it up. It is repaired only where the manufacturer provides for that repair, and otherwise destroyed.",
};

export const LADDER_SAFETY: ProgramTemplate = {
  id: "ladder",
  title: "Ladder Safety",
  shortName: "Ladder Safety",
  requirementId: "ladder-safety",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) => /^ladder safety( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.types,
      prompt: "What do your crews use?",
      kind: "choice",
      required: true,
      options: [
        { id: "step_and_extension", label: "Step ladders and extension ladders" },
        { id: "step_only", label: "Step ladders and platform steps" },
        { id: "all_including_fixed", label: "Both, plus fixed ladders on plant" },
      ],
    },
    {
      id: Q.alternatives,
      prompt: "Do crews consider a lift or scaffold before reaching for a ladder?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.inspection,
      prompt: "How are ladders inspected?",
      kind: "choice",
      required: true,
      options: [
        { id: "before_use", label: "By the user, before each use" },
        { id: "before_use_and_periodic", label: "Before each use, plus a periodic documented check" },
      ],
    },
    {
      id: Q.damaged,
      prompt: "What happens to a damaged ladder?",
      kind: "choice",
      required: true,
      options: [
        { id: "destroyed", label: "Destroyed so it can't be used again" },
        { id: "tagged_and_removed", label: "Tagged and removed from the area" },
      ],
    },
    {
      id: Q.records,
      prompt: "Where are inspection records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const alternatives = answers[Q.alternatives] === "yes";
    const fixed = answers[Q.types] === "all_including_fixed";
    const extension = answers[Q.types] !== "step_only";
    const periodic = answers[Q.inspection] === "before_use_and_periodic";
    const records = (answers[Q.records] ?? "").trim();

    const body: Section[] = [];

    if (alternatives) {
      body.push({
        heading: "Before the Ladder Comes Off the Truck",
        blocks: [
          {
            type: "paragraph",
            text: "Most ladder falls are not from high up and are not from anybody deciding to take a risk. They happen because a ladder was the quickest thing to hand for a short job.",
          },
          {
            type: "paragraph",
            text: "So the question is asked first: does this job want a ladder at all? A lift, a scaffold, platform steps, a longer tool, or doing the work from the ground are all steadier than standing on a rung, and the time they cost is usually smaller than it looks from the truck.",
          },
          {
            type: "paragraph",
            text: "A ladder is the right answer for short-duration work, at modest height, where the person can keep their body between the rails and does not need both hands for a heavy task. Where the job is longer than that, or needs force, or needs reaching, something else is used.",
          },
        ],
      });
    }

    body.push({
      heading: "Choosing the Right Ladder",
      blocks: [
        {
          type: "paragraph",
          text: "The ladder is chosen for the job rather than taken because it is on the truck:",
        },
        {
          type: "bullets",
          items: [
            "Long enough that nobody has to stand on the top rungs or stretch. The label on the ladder states its own limits, and those are what apply — not a rule of thumb.",
            "Rated for the weight of the person plus their tools and materials, which is more than people estimate. The duty rating is on the label.",
            "Non-conductive where there is any chance of contact with electrical equipment or overhead lines. A metal ladder near a live conductor is the way somebody who is not an electrician is electrocuted.",
            "Suited to the surface it will stand on and to what it will lean against.",
          ],
        },
      ],
    });

    body.push({
      heading: "Checking It Before Use",
      blocks: [
        {
          type: "paragraph",
          text: "The person who is about to climb it checks it, every time, before they do:",
        },
        {
          type: "bullets",
          items: [
            "Rails and rungs — cracks, splits, bends, corrosion, anything loose",
            "Feet — present, not worn smooth, not missing a pad",
            "Steps, spreaders and locks on a step ladder — that they open fully and lock",
            "Rungs and shoes clear of mud, grease, ice and paint",
            "Labels present and legible, since they carry the limits the ladder is used within",
          ],
        },
        periodic
          ? {
              type: "paragraph",
              text: `In addition, every ladder the Company owns is inspected periodically by somebody other than its usual user, and the inspection is recorded. Records are kept at: ${records}.`,
            }
          : {
              type: "paragraph",
              text: `The ${role} keeps a record of the ladders the Company holds and of any taken out of service, at: ${records}.`,
            },
        { type: "paragraph", text: DAMAGED[answers[Q.damaged]] },
      ],
    });

    body.push({
      heading: "Setting It Up",
      blocks: [
        {
          type: "paragraph",
          text: "Most ladder falls come from how it was set rather than from what happened at the top.",
        },
        {
          type: "numbered",
          items: [
            "Stand it on firm, level ground. Not on a pallet, a plank, a box, a drum, or anything stacked to gain height. Where the ground is uneven, a leveling device made for the purpose is used — not packing under one foot.",
            extension
              ? "Set the angle by the four-to-one method: for every four feet of height to the point of support, the base sits one foot out from the wall. Too steep tips it backwards; too shallow slides the feet out."
              : "Open a step ladder fully and lock the spreaders. A step ladder leaned against a wall closed is not a ladder.",
            extension
              ? "Extend it well above the landing where somebody will step off, so there is something to hold while stepping across. Stepping off level with the top is where people go over sideways."
              : "Keep the ladder on its own feet and never lean it.",
            "Secure the top, or have somebody hold the base while it is used. An unsecured ladder is the single most common thing behind these falls.",
            "Keep it clear of doorways, or lock, block or guard the door. A door opening into a ladder happens more often than people expect.",
            "Keep it well away from overhead lines and electrical equipment.",
          ],
        },
      ],
    });

    body.push({
      heading: "Climbing and Working From It",
      blocks: [
        {
          type: "bullets",
          items: [
            "Face the ladder going up and coming down, and keep three points of contact — two hands and a foot, or two feet and a hand.",
            "Carry nothing in your hands while climbing. Tools go up on a belt, in a bag, or on a line. Carrying a bucket up a ladder is carrying a fall up a ladder.",
            "Keep your body between the rails. Reaching sideways until your belt buckle passes the rail is what tips a ladder over, and it happens because moving the ladder feels like a waste of a minute.",
            "Move the ladder rather than stretch. Every time.",
            "Do not stand on the top cap of a step ladder or on the top rungs of an extension ladder, whatever the reach.",
            "One person on a ladder at a time, unless it is designed for two.",
            "Do not use a ladder in high wind, or where the surface is icy, or where you cannot see what you are climbing to.",
          ],
        },
        {
          type: "paragraph",
          text: "Where a task genuinely needs both hands, force, or a reach beyond the rails, the ladder is the wrong equipment for it and something else is used.",
        },
      ],
    });

    if (fixed) {
      body.push({
        heading: "Fixed Ladders on Plant",
        blocks: [
          {
            type: "paragraph",
            text: "Fixed ladders belong to the site rather than to the Company. Before using one, the employee looks at it: rungs secure and not corroded, cage or fall protection intact where fitted, and the landing at the top sound.",
          },
          {
            type: "paragraph",
            text: "Anything that looks wrong is reported to site control and the ladder is not used until the site confirms it is fit. The Company does not repair another employer's fixed ladder.",
          },
          {
            type: "paragraph",
            text: "Where a fixed ladder is fitted with a fall arrest system, it is used, and the employee's harness and connector are compatible with it. Where the system is present but the crew has no compatible equipment, the climb does not happen until they do.",
          },
        ],
      });
    }

    body.push({
      heading: "After a Fall or a Near Miss",
      blocks: [
        {
          type: "paragraph",
          text: `Any fall from a ladder, and any occasion where a ladder slipped, tipped or moved without anybody being hurt, is reported under the Company's incident reporting program.`,
        },
        {
          type: "paragraph",
          text: "The near misses are the valuable ones. A ladder that slid an inch on a wet slab is the same event as a broken wrist, minus the luck, and it is the cheapest warning the Company will get about how its ladders are being set.",
        },
        {
          type: "paragraph",
          text: "A ladder involved in a fall is taken out of service and examined before it goes back, whether or not damage is visible.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "when a ladder is the right equipment for a job, how one is chosen, checked and set up, and how it is climbed and worked from.",
      policy: `It is the policy of ${company} that a ladder is used for short work at modest height where somebody can keep their body between the rails, and that anything else gets equipment that does not depend on balance.`,
      body,
      trainingPoints: [
        "That a ladder is for short jobs at modest height, and that a lift or scaffold is often quicker than it looks",
        "To check the ladder yourself every time before climbing it",
        "That the top has to be secured or the base held — this is behind most ladder falls",
        "Three points of contact, facing the ladder, with nothing in your hands",
        "To move the ladder rather than reach past the rails, every time",
        "To report a ladder that slipped or moved even when nobody was hurt",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through asking whether a job wants a ladder at all, checking how ladders have actually been set on site, and taking a damaged one out of service rather than leaning it somewhere.",
      reviewTrigger:
        "The review reads the ladder near misses together, since the same setting mistake appearing across several is a problem with how jobs are planned rather than with the people on the ladders.",
    });
  },
};
