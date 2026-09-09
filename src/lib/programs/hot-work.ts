import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Hot Work.
 *
 * ## Three elements, and the one that is nearly always too short
 *
 * The config names a permit form, a fire-watch duration, and gas testing.
 *
 * The fire watch is the one that gets written down as fifteen minutes and
 * then not done at all. Fires from hot work characteristically start well
 * after the work stops — a spark travels, lodges in insulation or a wall
 * cavity, smoulders, and finds air an hour later. So this program sets a
 * minimum, requires a second look after the watch ends, and names the fire
 * watch as a person with no other job, because a fire watch who is also
 * holding the ladder is not a fire watch.
 *
 * ## The customer sets the duration, within a floor
 *
 * A contractor whose clients require a longer watch should have their own
 * program say the longer number, or the program contradicts their own site
 * paperwork. So the duration is asked for — but the document says plainly
 * that the site's requirement governs where it is longer, and the questions
 * do not offer anything shorter than the industry's common floor.
 *
 * ## What it will not say
 *
 * That any particular work is exempt, or that a permit can be waived in a
 * designated area. Designated areas exist in real programs, but whether a
 * given shop bay qualifies is a judgement about a real place, and a template
 * that pre-approved one would be handing out an exemption it cannot assess.
 */

const Q = {
  responsible: "responsible_role",
  issuer: "permit_issuer",
  watchMinutes: "watch_minutes",
  gasTest: "gas_testing",
  hostPermit: "host_permit",
  records: "records_location",
} as const;

const WATCH: Record<string, { label: string; minutes: string }> = {
  "30": { label: "30 minutes", minutes: "30 minutes" },
  "60": { label: "60 minutes", minutes: "60 minutes" },
  "120": { label: "2 hours", minutes: "2 hours" },
};

const GAS_TEST: Record<string, string> = {
  always:
    "The atmosphere is tested before every hot work permit is issued, whatever the location, and the reading is written on the permit as a number.",
  flammable_risk:
    "The atmosphere is tested before any hot work in or near a space, line, vessel or area that has held a flammable material, and wherever flammable vapor could be present. The reading is written on the permit as a number.",
  host_requires:
    "The atmosphere is tested wherever the site requires it, and in every case where hot work is done in or near a space, line, vessel or area that has held a flammable material. The reading is written on the permit as a number.",
};

export const HOT_WORK: ProgramTemplate = {
  id: "hot_work",
  title: "Hot Work",
  shortName: "Hot Work",
  requirementId: "hot-work",

  release: "customer_available",
  templateVersion: "1.0.0",

  /*
   * The configured title pairs it with welding and cutting; older reference
   * data called it plain "Hot work". Both are accepted — a matcher that
   * misses means the customer is never offered a document we could write.
   */
  matchesLabel: (label) =>
    /^hot work( ?\/ ?welding ?(and|&) ?cutting| permit)?( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.issuer,
      prompt: "Who signs the hot work permit?",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisor", label: "The supervisor for the job" },
        { id: "responsible", label: "Whoever looks after safety" },
        { id: "host", label: "The site issues it, we work under theirs" },
      ],
    },
    {
      id: Q.watchMinutes,
      prompt: "How long does the fire watch stay after the work stops?",
      help: "Fires from hot work usually start after the work ends, not during it.",
      kind: "choice",
      required: true,
      options: [
        { id: "30", label: "30 minutes" },
        { id: "60", label: "60 minutes" },
        { id: "120", label: "2 hours" },
      ],
    },
    {
      id: Q.gasTest,
      prompt: "When do you test the atmosphere before hot work?",
      kind: "choice",
      required: true,
      options: [
        { id: "flammable_risk", label: "Wherever flammable vapor could be present" },
        { id: "always", label: "Before every permit, everywhere" },
        { id: "host_requires", label: "Where the site requires it, plus flammable areas" },
      ],
    },
    {
      id: Q.hostPermit,
      prompt: "Do client sites issue their own hot work permits?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where do completed permits end up?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const watch = WATCH[answers[Q.watchMinutes]] ?? WATCH["60"];
    const hostPermit = answers[Q.hostPermit] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const issuer =
      answers[Q.issuer] === "responsible"
        ? `The ${role} issues and signs the permit.`
        : answers[Q.issuer] === "host"
          ? `The site issues the permit and ${company} works under it. The Company's supervisor still checks every item below before work starts, and does not treat a signed permit as evidence that the checks were made.`
          : "The supervisor for the job issues and signs the permit, after checking the area themselves rather than being told it is clear.";

    const body: Section[] = [
      {
        heading: "What Counts as Hot Work",
        blocks: [
          {
            type: "paragraph",
            text: "Any work producing a flame, a spark, or enough heat to ignite something: welding, cutting, brazing, soldering, grinding, drilling into or through metal, thawing with a torch, and the use of any open flame or spark-producing tool.",
          },
          {
            type: "paragraph",
            text: "It is the source of ignition rather than the trade that decides. A grinder in a stairwell is hot work; so is a cutting torch in an empty yard.",
          },
        ],
      },
      {
        heading: "Doing the Work Another Way First",
        blocks: [
          {
            type: "paragraph",
            text: "Before a permit is issued, the supervisor asks whether the job can be done without hot work at all — mechanical cutting, a bolted connection, a part taken to a shop, or the work brought to a safe area.",
          },
          {
            type: "paragraph",
            text: "Where it can, it is. A permit is what the Company does when the work cannot reasonably be done another way, not the first step in planning it.",
          },
        ],
      },
      {
        heading: "The Permit",
        blocks: [
          {
            type: "paragraph",
            text: "No hot work starts without a permit for that work, in that place, on that shift. A permit covers one location and one period, and is displayed where the work is happening.",
          },
          { type: "paragraph", text: issuer },
          {
            type: "paragraph",
            text: "The permit is canceled when the work finishes, and immediately if anything on it stops being true — the area changes, ventilation stops, a neighboring operation starts. Work does not resume under a canceled permit.",
          },
        ],
      },
      {
        heading: "Preparing the Area",
        blocks: [
          {
            type: "paragraph",
            text: "Before work starts, the person issuing the permit checks the area themselves:",
          },
          {
            type: "numbered",
            items: [
              "Combustibles are moved away from the work. Where they cannot be moved, they are covered with fire-resistant material — not plastic sheet, not a tarpaulin.",
              "The floor is swept clear, and any combustible floor is wetted down or covered.",
              "Openings, cracks, gaps around pipework, and floor drains within reach of a spark are covered or sealed. Sparks travel far further than people expect, and fall further than they carry.",
              "The far side of any wall, floor or ceiling being worked on is checked, and where anything combustible is there, a second fire watch is stationed on that side.",
              "Flammable liquids, gases and their containers are removed from the area, and lines that carried them are drained, purged and isolated before any heat is applied.",
              "Fire extinguishing equipment suitable for what is nearby is in place, within reach, and checked as serviceable.",
              "Nearby operations that could release vapor or dust are stopped or the work is moved.",
              "Detection or suppression systems in the area are identified, and where one has to be isolated the isolation is recorded, is restored the moment the work ends, and is told to whoever monitors it.",
            ],
          },
        ],
      },
      {
        heading: "Testing the Atmosphere",
        blocks: [
          { type: "paragraph", text: GAS_TEST[answers[Q.gasTest]] },
          {
            type: "paragraph",
            text: "Testing is done with an instrument in calibration that has been bump-tested that day, and the result is recorded as a number with the time it was taken. A note saying \"clear\" records nothing.",
          },
          {
            type: "paragraph",
            text: "Where the reading shows flammable vapor, no hot work is done. The area is ventilated, or the source removed, and it is tested again — the permit is issued on the second reading, not on the intention to ventilate.",
          },
          {
            type: "paragraph",
            text: "Where the work is long, or where conditions could change, testing is repeated during the work at the interval written on the permit.",
          },
        ],
      },
      {
        heading: "The Fire Watch",
        blocks: [
          {
            type: "paragraph",
            text: "A fire watch is present throughout the work and has no other job. Somebody holding a ladder, passing tools, or doing the work themselves is not a fire watch.",
          },
          {
            type: "paragraph",
            text: "The fire watch has extinguishing equipment to hand, knows how to use it, knows how to raise the alarm for that location, and watches the area for sparks and smouldering rather than watching the welder.",
          },
          {
            type: "paragraph",
            text: `The fire watch stays for at least ${watch.minutes} after the work stops. Fires from hot work usually start after the work has ended: a spark travels, lodges out of sight in insulation or a cavity, smoulders, and breaks out later. Leaving when the torch goes off is leaving before the risk begins.`,
          },
          {
            type: "paragraph",
            text: `Somebody returns to check the area again at least 30 minutes after the fire watch ends, and that second check is recorded on the permit. Where the site requires a longer watch than ${watch.minutes}, the site's requirement applies.`,
          },
          {
            type: "paragraph",
            text: "Where a second fire watch is posted on the far side of a wall or floor, they stay for the same period.",
          },
        ],
      },
      {
        heading: "The Permit Form",
        blocks: [
          {
            type: "paragraph",
            text: "A permit is completed for each job. No work starts with any part of it blank:",
          },
          {
            type: "table",
            head: ["Section", "What is recorded"],
            rows: [
              ["Location and work", "Where, what, and on whose site"],
              ["Valid for", "Date, start time, and the time the permit expires"],
              ["Issued by", "Name and signature"],
              ["Doing the work", "Name of each person"],
              ["Fire watch", "Name, and the name of anybody relieving them"],
              ["Could it be done cold?", "Why hot work is necessary"],
              ["Area checks", "Each item of the preparation list, initialled"],
              ["Systems isolated", "Any detection or suppression isolated, and when it was restored"],
              ["Gas test", "The reading as a number, the instrument, and the time"],
              ["Extinguishing equipment", "What is present, and that it was checked"],
              ["Fire watch ended", "Time the work stopped, and the time the watch ended"],
              ["Final check", "Time of the check after the watch, and by whom"],
              ["Canceled", "When, and by whom"],
            ],
          },
          {
            type: "paragraph",
            text: `Completed permits are kept at: ${records}.`,
          },
        ],
      },
    ];

    if (hostPermit) {
      body.push({
        heading: "Where the Site Issues the Permit",
        blocks: [
          {
            type: "paragraph",
            text: "On sites operating their own hot work permit system, the site's permit governs and the Company works under it.",
          },
          {
            type: "paragraph",
            text: `The Company's supervisor still walks the area and confirms the preparation list before work starts. A permit signed by somebody else is not evidence that the checks behind it were made, and ${company} remains responsible for its own crew.`,
          },
          {
            type: "paragraph",
            text: `Where the site's fire watch period is shorter than ${watch.minutes}, the Company keeps its own watch for the longer period. Where the site's is longer, the site's applies.`,
          },
        ],
      });
    }

    body.push({
      heading: "Compressed Gas and Equipment",
      blocks: [
        {
          type: "paragraph",
          text: "Cylinders are secured upright, kept away from the work and from any source of heat, and moved with their valve caps on. Fuel gas and oxygen cylinders are stored apart when not in use.",
        },
        {
          type: "paragraph",
          text: "Hoses, regulators, torches and leads are checked before each use, and equipment found damaged is taken out of service rather than used carefully.",
        },
        {
          type: "paragraph",
          text: "Cylinder valves are closed and the lines are bled when the work stops for a break as well as at the end of the job. Equipment is never left charged and unattended.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how employees of the Company prepare an area for work that produces flame, sparks or heat, what has to be on the permit before it starts, and how long somebody watches the area afterwards.",
      policy: `It is the policy of ${company} that hot work is done only where the job cannot reasonably be done another way, only under a permit, and never without somebody watching the area afterwards for long enough to catch what starts late.`,
      body,
      trainingPoints: [
        "What counts as hot work — the ignition source decides, not the trade",
        "That the job is done cold wherever it reasonably can be",
        "That no hot work starts without a permit for that place and that shift",
        `That the fire watch has no other job, and stays at least ${watch.minutes} after the work stops`,
        "That sparks travel and fall much further than people expect, and start fires out of sight",
        "How to raise the alarm at the location you are working on",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through walking the area themselves before issuing a permit, reading and recording a gas test, isolating and restoring detection systems, and posting a second fire watch on the far side of a wall or floor.",
      reviewTrigger:
        "The review reads the completed permits together, and checks in particular that the fire watch end times were recorded rather than left blank.",
    });
  },
};
