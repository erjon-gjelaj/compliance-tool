import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Fall Protection.
 *
 * ## Four elements, and the one nobody plans for
 *
 * The config names anchorage criteria, suspended-worker rescue, equipment
 * inspection cadence, and leading-edge or controlled-access work.
 *
 * Rescue is the one written last and thought about least. A harness stops the
 * fall and then becomes the problem: suspension with the legs still can cut
 * off return blood flow, and somebody hanging motionless in a harness is on a
 * much shorter clock than most crews assume. A program whose rescue plan is
 * "call the fire department" has planned for a body recovery. So this
 * requires the rescue method to be settled before anybody is exposed, and
 * requires it to be capable of getting somebody down in minutes.
 *
 * ## Anchorage is where the arithmetic goes wrong
 *
 * Crews tie off to what is reachable rather than to what will hold, and the
 * fall clearance calculation — free fall, plus deceleration, plus the height
 * of the person below the anchor, plus a margin — is the one people do not do
 * at all. A lanyard that arrests a fall six feet above a concrete floor and
 * two feet below where the person started has not saved them. The document
 * therefore states the criteria and the clearance arithmetic in plain terms.
 *
 * ## What it will not do
 *
 * State a trigger height. It differs by the kind of work and the standard
 * that applies, this project has deliberately never verified a universal
 * counterpart across construction and general industry, and a template that
 * printed one number would be wrong for somebody. The program instead ties
 * protection to the assessment of the actual work, which is both honest and
 * stricter.
 */

const Q = {
  responsible: "responsible_role",
  primaryMethod: "primary_method",
  rescue: "rescue_method",
  inspection: "inspection_cadence",
  leadingEdge: "leading_edge",
  anchorEngineered: "anchor_source",
  records: "records_location",
} as const;

const RESCUE: Record<string, string> = {
  own_equipment:
    "The Company carries its own rescue equipment to any job where somebody could be left suspended, and the crew is prepared to use it. The plan is to bring the person down themselves, promptly, rather than to wait.",
  site_team:
    "On sites with a rescue team able to reach a suspended person quickly, that team is the plan, and the supervisor confirms before work starts that they are on site, are available, and know the work is happening.",
  aerial_lift:
    "A lift is kept at the work area, positioned so it can reach anybody who could be left suspended, with somebody present who can operate it.",
};

const INSPECTION: Record<string, string> = {
  before_each_use:
    "Each person inspects their own harness, lanyard and connectors before every use, looking at webbing, stitching, D-rings, buckles, the energy absorber and every snap hook.",
  before_use_and_monthly:
    "Each person inspects their own equipment before every use, and a documented inspection of every item is carried out monthly by somebody other than its usual user.",
  before_use_and_quarterly:
    "Each person inspects their own equipment before every use, and a documented inspection of every item is carried out every three months by somebody other than its usual user.",
};

export const FALL_PROTECTION: ProgramTemplate = {
  id: "fall_protection",
  title: "Fall Protection",
  shortName: "Fall Protection",
  requirementId: "fall-protection",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^fall protection( program| plan)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.primaryMethod,
      prompt: "What do you mostly rely on to stop a fall?",
      kind: "choice",
      required: true,
      options: [
        { id: "guardrails", label: "Guardrails and covers where we can" },
        { id: "personal_arrest", label: "Harness and lanyard" },
        { id: "restraint", label: "Restraint — keeping people back from the edge" },
      ],
    },
    {
      id: Q.anchorEngineered,
      prompt: "Where do anchor points come from?",
      help: "This is where crews improvise, and where reviewers look.",
      kind: "choice",
      required: true,
      options: [
        { id: "site_provided", label: "Anchors the site provides and certifies" },
        { id: "our_assessment", label: "We identify them, and a competent person signs off" },
        { id: "engineered", label: "Engineered anchors specified for the job" },
      ],
    },
    {
      id: Q.rescue,
      prompt: "If someone is left hanging in a harness, how do you get them down?",
      help: "Minutes matter here — suspension itself is dangerous.",
      kind: "choice",
      required: true,
      options: [
        { id: "own_equipment", label: "Our own rescue equipment, used by the crew" },
        { id: "aerial_lift", label: "A lift kept at the work area" },
        { id: "site_team", label: "The site's rescue team" },
      ],
    },
    {
      id: Q.inspection,
      prompt: "How often is fall protection equipment inspected?",
      kind: "choice",
      required: true,
      options: [
        { id: "before_use_and_monthly", label: "Before each use, plus a monthly documented check" },
        { id: "before_use_and_quarterly", label: "Before each use, plus a quarterly documented check" },
        { id: "before_each_use", label: "Before each use" },
      ],
    },
    {
      id: Q.leadingEdge,
      prompt: "Do crews ever work at an edge that moves as the work progresses?",
      help: "Decking, roofing, steel — anywhere the edge is not where it was an hour ago.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are inspection records and rescue plans kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const leadingEdge = answers[Q.leadingEdge] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const anchors =
      answers[Q.anchorEngineered] === "site_provided"
        ? "Anchor points are those the site provides and certifies. The supervisor establishes which they are before work starts, and does not accept a point identified by pointing at it."
        : answers[Q.anchorEngineered] === "engineered"
          ? "Anchor points are specified for the job by somebody qualified to do so, and are installed and used as specified."
          : `Anchor points are identified for each job by a competent person, who records what was chosen and why. Where no suitable anchor can be identified, the work does not proceed on a harness — the ${role} is told and another method is used.`;

    const body: Section[] = [
      {
        heading: "Deciding What Protects People",
        blocks: [
          {
            type: "paragraph",
            text: "Before work begins at height, the supervisor for the job establishes where somebody could fall — over an edge, through an opening, into equipment, from a ladder or platform — and what will protect them.",
          },
          {
            type: "paragraph",
            text: "The order is settled and is not a matter of preference:",
          },
          {
            type: "numbered",
            items: [
              "Remove the need to be there at all. Work done from the ground, from a platform, or prefabricated below is the only method that cannot fail.",
              "Guardrails, covers and barriers. These protect everybody in the area, including somebody who was not briefed and somebody who is not paying attention.",
              "Restraint — a harness and lanyard set short enough that the person cannot reach the edge. Nobody falls, so nothing has to arrest a fall and nobody has to be rescued.",
              "Fall arrest. The fall happens and is stopped. This is the last option, not the default, and it is the only one that needs a rescue plan behind it.",
            ],
          },
          {
            type: "paragraph",
            text:
              answers[Q.primaryMethod] === "guardrails"
                ? "The Company uses guardrails, covers and barriers wherever the work allows, and treats a harness as what is used when they do not."
                : answers[Q.primaryMethod] === "restraint"
                  ? "The Company works in restraint wherever it can — set so that nobody can reach the edge — and treats fall arrest as what is used when restraint is not possible."
                  : "The Company commonly works in a harness. That places real weight on the anchor, the clearance and the rescue plan, and each of those is settled before anybody is exposed rather than worked out at the edge.",
          },
          {
            type: "paragraph",
            text: "Openings and holes are covered as soon as they are created. Covers are secured so they cannot be moved by accident and are marked so that nobody has to guess what they are.",
          },
        ],
      },
      {
        heading: "Anchor Points",
        blocks: [
          { type: "paragraph", text: anchors },
          {
            type: "paragraph",
            text: "An anchor used for fall arrest is selected to hold the forces a fall generates, which are far larger than the weight of the person. What is chosen must be:",
          },
          {
            type: "bullets",
            items: [
              "Independent of any anchor supporting a work platform",
              "Positioned above the point of attachment wherever possible, so the free fall is as short as it can be",
              "Positioned to keep the person from swinging into anything if they fall — a pendulum into a column injures as reliably as a floor",
              "Structural. Guardrails, pipework, conduit, ductwork, ladders and vessels are not anchors unless somebody competent has established that this one is",
            ],
          },
          {
            type: "paragraph",
            text: "Where an anchor is chosen because it is within reach rather than because it will hold, it is not an anchor. That is the most common way a fall protection system fails while looking correct.",
          },
        ],
      },
      {
        heading: "Clearance Below",
        blocks: [
          {
            type: "paragraph",
            text: "A fall arrest system that stops somebody after they have already hit the floor has not protected them. Before a harness is relied on, the clearance below the working position is worked out:",
          },
          {
            type: "bullets",
            items: [
              "The free fall — how far the person drops before the system starts to take load",
              "The distance the energy absorber or self-retracting device takes to stop them",
              "The height of the person below their own attachment point",
              "A margin so that the lowest part of them still clears the surface below",
            ],
          },
          {
            type: "paragraph",
            text: "Where the clearance is not sufficient, the system is changed — a higher anchor, a shorter connector, a self-retracting device — or fall arrest is not used and another method is chosen. The clearance is worked out before the work rather than estimated at the edge.",
          },
          {
            type: "paragraph",
            text: "Lower levels, projections, equipment and anything else somebody could strike on the way down are part of that assessment.",
          },
        ],
      },
      {
        heading: "Rescuing Somebody Left Suspended",
        blocks: [
          {
            type: "paragraph",
            text: "A harness stops the fall and then becomes the hazard. Somebody hanging still in a harness — unconscious, injured, or simply unable to move — can deteriorate quickly, and the clock is far shorter than most crews assume.",
          },
          {
            type: "paragraph",
            text: "So the rescue method is settled before anybody is exposed to a fall, and is written down for that job:",
          },
          { type: "paragraph", text: RESCUE[answers[Q.rescue]] },
          {
            type: "paragraph",
            text: "Whichever it is, the plan has to bring somebody down in minutes rather than tens of minutes. Waiting for an emergency service that must be called, must travel, and must then rig for the rescue is not a plan for this hazard.",
          },
          {
            type: "paragraph",
            text: "Nobody works in a harness alone where a fall could leave them suspended. Somebody has to be there to raise the alarm and start the rescue.",
          },
          {
            type: "paragraph",
            text: "Anybody who has been suspended is taken for medical attention even where they appear unhurt, and is not left to make that decision for themselves at the scene.",
          },
        ],
      },
      {
        heading: "Inspecting the Equipment",
        blocks: [
          { type: "paragraph", text: INSPECTION[answers[Q.inspection]] },
          {
            type: "paragraph",
            text: "Equipment is taken out of service and destroyed rather than repaired where any of the following is found: cuts, fraying, burns, chemical damage, broken or pulled stitching, a deployed energy absorber, distorted or cracked hardware, a snap hook that does not lock, or an illegible label.",
          },
          {
            type: "paragraph",
            text: "Any equipment that has arrested a fall is removed from service permanently and destroyed, whether or not damage can be seen. It has done the job it was designed to do once.",
          },
          {
            type: "paragraph",
            text: `Equipment is stored out of sunlight, away from chemicals and heat, and dry. Inspection records are kept at: ${records}.`,
          },
        ],
      },
    ];

    if (leadingEdge) {
      body.push({
        heading: "Edges That Move",
        blocks: [
          {
            type: "paragraph",
            text: "Where the edge changes as the work progresses — decking, roofing, steel erection — the protection has to move with it, and the plan for the day says how.",
          },
          {
            type: "paragraph",
            text: "Equipment used at a leading edge is equipment rated for it: a lifeline dragged over a sharp edge can be cut through in a fall, and a device anchored at foot level sees a much longer free fall than one anchored overhead. Connectors and lifelines are selected for that, and edge protection is used where the line could bear on an edge.",
          },
          {
            type: "paragraph",
            text: "Where an area is worked without conventional protection because the protection itself would create a greater hazard, that area is controlled: its limits are marked, only the people doing that work enter it, somebody is responsible for keeping others out, and the arrangement is written down for that job and that day.",
          },
          {
            type: "paragraph",
            text: `The ${role} approves any such arrangement before it is used, and it is never a standing arrangement — it is approved for the work in front of them.`,
          },
        ],
      });
    }

    body.push({
      heading: "Wearing It Properly",
      blocks: [
        {
          type: "paragraph",
          text: "A harness protects the person wearing it only if it fits and is connected correctly. Straps are adjusted so the chest strap sits at mid-chest and the leg straps are snug, and the dorsal D-ring sits between the shoulder blades.",
        },
        {
          type: "paragraph",
          text: "Connections are made to the correct attachment point for what is being done, snap hooks are closed and locked, and nothing is connected back onto the lanyard itself unless it is designed for that.",
        },
        {
          type: "paragraph",
          text: "A person who is connected but connected to the wrong point, or connected slack enough to fall past their anchor, is in more danger than they believe. Supervisors check connections rather than checking that a harness is being worn.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how employees of the Company are protected from falls: what protection is chosen and in what order, how anchor points are selected, how much clearance is needed below, how somebody left suspended is brought down, and how the equipment is inspected.",
      policy: `It is the policy of ${company} that a fall is prevented wherever it can be prevented, that a harness is what remains after that rather than the first answer, and that nobody is exposed to a fall until it is settled how they would be brought down.`,
      body,
      trainingPoints: [
        "The order of protection, and that a harness is the last option rather than the default",
        "What makes something an anchor, and that being within reach is not one of the criteria",
        "That the clearance below has to be worked out before the harness is relied on",
        "How to inspect your own harness and lanyard, and what takes a piece out of service for good",
        "That anything that has arrested a fall is destroyed, not reused",
        "That somebody left hanging in a harness is on a short clock, and how the rescue for this job works",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through selecting and recording anchor points, working out fall clearance, writing the rescue plan for a job, and checking connections rather than checking that harnesses are worn.",
      reviewTrigger:
        "The review checks that rescue arrangements written for recent jobs were actually capable of being carried out in the time assumed.",
    });
  },
};
