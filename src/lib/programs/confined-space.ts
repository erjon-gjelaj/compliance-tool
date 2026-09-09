import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Permit-Required Confined Space Entry.
 *
 * ## The six elements, and the two that decide whether somebody dies
 *
 * The config's element set names six: a permit form, the order of atmospheric
 * tests, attendant duties, non-entry retrieval, who the rescue service is,
 * and how long they take to arrive.
 *
 * The last two are the ones that matter most and the ones most often waved
 * at. Most people who die in confined spaces are would-be rescuers, and a
 * program whose rescue plan is "call 911" has not planned a rescue — it has
 * named a phone number and hoped. So this document requires the rescue
 * arrangement to be established and written down *before* entry, requires a
 * response time to be known rather than assumed, and puts retrieval equipment
 * on the entrant so that a rescue can begin without anybody else going in.
 *
 * ## The test order is not a detail
 *
 * Oxygen, then flammable, then toxic — in that order, because a
 * combustible-gas reading taken in an oxygen-deficient atmosphere is not
 * reliable, and finding out afterwards is no use. It is a small, concrete,
 * checkable thing, which is exactly the kind of thing a reviewer looks for to
 * decide whether a program was written by somebody who has done the work.
 *
 * ## What it will not do
 *
 * Decide that a particular space is or is not permit-required. That is an
 * assessment of a real space by somebody standing in front of it, and a
 * template that pre-judged it would be inviting a crew to skip the only step
 * that matters.
 */

const Q = {
  responsible: "responsible_role",
  entersSpaces: "who_enters",
  rescue: "rescue_arrangement",
  responseTime: "response_time",
  hostPermit: "host_permit",
  monitor: "monitor_type",
  records: "records_location",
} as const;

const RESCUE: Record<string, string> = {
  host_team:
    "On sites where the host employer operates a rescue team, that team is the rescue service, and the supervisor confirms before each entry that the team is on site, is available for that entry, and knows the entry is taking place.",
  contracted:
    "The Company engages a rescue service. Before each entry the supervisor confirms that the service is available for that entry, has been given the details of the space, and can reach it within the time recorded on the permit.",
  own_team:
    "The Company maintains its own trained rescue team. Before each entry the supervisor confirms which members are on site and available, and that their equipment is present and serviceable.",
};

export const CONFINED_SPACE: ProgramTemplate = {
  id: "confined_space",
  title: "Permit-Required Confined Space Entry",
  shortName: "Confined Space",
  requirementId: "confined-space",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(permit[- ]required )?confined space( entry)?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.entersSpaces,
      prompt: "Who is allowed to enter a permit space?",
      kind: "choice",
      required: true,
      options: [
        { id: "named_list", label: "A named list the company keeps" },
        { id: "trained_only", label: "Anyone who has been through the training" },
      ],
    },
    {
      id: Q.rescue,
      prompt: "Who performs a rescue if something goes wrong inside?",
      help: "This is the question reviewers press hardest on.",
      kind: "choice",
      required: true,
      options: [
        { id: "host_team", label: "The site's own rescue team" },
        { id: "contracted", label: "A rescue service we engage" },
        { id: "own_team", label: "Our own trained rescue team" },
      ],
    },
    {
      id: Q.responseTime,
      prompt: "How is the rescue response time established?",
      kind: "choice",
      required: true,
      options: [
        { id: "confirmed_each_entry", label: "Confirmed and written on each permit" },
        { id: "standing_agreement", label: "A standing agreement, re-checked each entry" },
      ],
    },
    {
      id: Q.monitor,
      prompt: "Do you use your own gas monitor, or the site's?",
      kind: "choice",
      required: true,
      options: [
        { id: "own", label: "Our own, calibrated and bump-tested" },
        { id: "site", label: "Whatever the site provides" },
        { id: "both", label: "Ours, and the site's where they require it" },
      ],
    },
    {
      id: Q.hostPermit,
      prompt: "Do client sites issue their own entry permits?",
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
    const hostPermit = answers[Q.hostPermit] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const monitor =
      answers[Q.monitor] === "site"
        ? "Testing is done with the instrument the site provides. Before it is used, the supervisor confirms it is in calibration and has been bump-tested that day, and does not accept an instrument that cannot be shown to be either."
        : answers[Q.monitor] === "both"
          ? "Testing is done with the Company's own instrument, and additionally with the site's where the site requires it. The Company's instrument is calibrated to its manufacturer's schedule and bump-tested before each day's use, and a failed bump test takes it out of service."
          : "Testing is done with the Company's own instrument. It is calibrated to its manufacturer's schedule and bump-tested before each day's use, and a failed bump test takes it out of service rather than prompting a second attempt.";

    const body: Section[] = [
      {
        heading: "Identifying Spaces Before Anybody Goes Near One",
        blocks: [
          {
            type: "paragraph",
            text: "Before work begins at a location, the supervisor for the job identifies the spaces there that are large enough to enter, have limited means of entry or exit, and are not designed for continuous occupancy — tanks, vessels, pits, sumps, vaults, silos, excavations of depth, and the inside of process equipment.",
          },
          {
            type: "paragraph",
            text: "Each is then assessed for whether it holds, or could hold, a hazardous atmosphere, a material that could engulf somebody, an internal shape that could trap them, or any other serious hazard. A space with any of those is treated as permit-required.",
          },
          {
            type: "paragraph",
            text: "This program does not decide in advance which spaces are permit-required. That is a judgment about a real space, made by somebody looking at it. Where there is doubt, the space is treated as permit-required until somebody competent establishes otherwise, and that decision is written down.",
          },
          {
            type: "paragraph",
            text: `Spaces are marked or otherwise identified so that employees know not to enter without a permit, and ${company} tells the host employer where it identifies a space the site had not.`,
          },
        ],
      },
      {
        heading: "Nobody Enters Without a Permit",
        blocks: [
          {
            type: "paragraph",
            text: "No employee enters a permit-required space until a permit for that entry has been completed and signed by the entry supervisor. The permit covers one entry into one space for one shift, and it is displayed at the entrance for as long as the entry lasts.",
          },
          {
            type: "paragraph",
            text: "Entry means any part of the body breaking the plane of the opening. Leaning in to look, or reaching in with an arm, is entry.",
          },
          {
            type: "paragraph",
            text: "The permit is canceled when the work is finished, and immediately if any condition on it stops being true. Work under a canceled permit does not resume until a new permit is issued.",
          },
        ],
      },
      {
        heading: "Testing the Atmosphere",
        blocks: [
          {
            type: "paragraph",
            text: "The atmosphere is tested before entry and monitored throughout. Testing is done in this order, and the order matters:",
          },
          {
            type: "numbered",
            items: [
              "Oxygen content first. Every other reading depends on it — a combustible-gas sensor gives an unreliable reading in an atmosphere low in oxygen, so a flammable result taken first can be wrong in the direction that gets somebody hurt.",
              "Flammable gases and vapors second.",
              "Toxic contaminants third, for whatever the space and the work could produce.",
            ],
          },
          {
            type: "paragraph",
            text: "The space is tested at the top, the middle and the bottom, because gases stratify and a reading at the opening says nothing about the floor. Where the entrant will descend, testing goes ahead of them.",
          },
          { type: "paragraph", text: monitor },
          {
            type: "paragraph",
            text: "Results are written on the permit as numbers, with the time they were taken. \"Safe\" is not a reading.",
          },
          {
            type: "paragraph",
            text: "Where the atmosphere is not acceptable, the space is ventilated and re-tested. It is never entered on the strength of ventilation alone, and an entrant is never sent in to make it safe.",
          },
        ],
      },
      {
        heading: "The Attendant",
        blocks: [
          {
            type: "paragraph",
            text: "An attendant is stationed outside the space for the whole time anybody is inside. The entry does not begin without one and stops if the attendant has to leave.",
          },
          {
            type: "paragraph",
            text: "The attendant:",
          },
          {
            type: "bullets",
            items: [
              "Knows who is inside, by name, at every moment, and keeps a written count",
              "Stays outside and does nothing else — the attendant has no other task during the entry",
              "Maintains continuous contact with the entrants by voice, radio, or a signal agreed beforehand",
              "Watches conditions inside and outside, including anything happening nearby that could affect the space",
              "Orders everybody out immediately on any sign of trouble, including a symptom, an unexpected reading, or a feeling that something is wrong — and does not need to justify the order first",
              "Summons rescue and operates retrieval equipment from outside",
            ],
          },
          {
            type: "paragraph",
            text: "The attendant does not enter the space. This is the sentence that saves the attendant's life, and it holds even when somebody inside is in trouble — most people who die in confined spaces went in to help somebody else.",
          },
        ],
      },
      {
        heading: "Rescue",
        blocks: [
          {
            type: "paragraph",
            text: "The rescue arrangement is established and written on the permit before entry, not worked out during one.",
          },
          { type: "paragraph", text: RESCUE[answers[Q.rescue]] },
          {
            type: "paragraph",
            text:
              answers[Q.responseTime] === "standing_agreement"
                ? "The expected time for rescue to reach the space is set by standing agreement and is confirmed again before each entry, then written on the permit. An arrangement nobody re-checked is an assumption."
                : "The expected time for rescue to reach the space is confirmed before each entry and written on the permit as a number of minutes.",
          },
          {
            type: "paragraph",
            text: "Where the atmosphere or the work is such that somebody could be overcome faster than rescue could reach them, the entry does not proceed on that basis. The arrangement is changed, or the work is done another way.",
          },
          {
            type: "paragraph",
            text: "Calling the emergency services is not by itself a rescue plan. They may not arrive in time, may not be equipped for the space, and are not obliged to enter it.",
          },
        ],
      },
      {
        heading: "Retrieval Equipment",
        blocks: [
          {
            type: "paragraph",
            text: "Every entrant wears a full-body harness with a retrieval line attached, running to a mechanical device or anchor outside the space, so that a rescue can be started from outside without anybody entering.",
          },
          {
            type: "paragraph",
            text: "Where the space is entered vertically more than a short distance, the retrieval device is a mechanical one rather than a line held by hand.",
          },
          {
            type: "paragraph",
            text: "Retrieval equipment is used unless it would itself increase the risk — for example where the line would foul on internal obstructions — or would not actually help a rescue. Where it is not used, the reason is written on the permit and the entry supervisor signs it, so that the decision is a decision rather than an omission.",
          },
        ],
      },
      {
        heading: "The Entry Permit",
        blocks: [
          {
            type: "paragraph",
            text: "A permit is completed for each entry. It carries at least the following, and no entry begins with any part of it blank:",
          },
          {
            type: "table",
            head: ["Section", "What is recorded"],
            rows: [
              ["Space and location", "Which space, where, and on whose site"],
              ["Work and duration", "What is being done, and the shift the permit covers"],
              ["Entrants", "Everybody entering, by name"],
              ["Attendant", "By name, and who relieves them"],
              ["Entry supervisor", "By name, and their signature"],
              ["Hazards", "What the space holds, including anything introduced by the work"],
              ["Isolation", "Energy and material isolations proved before entry"],
              [
                "Atmospheric tests",
                "Oxygen, then flammable, then toxic — as numbers, with times, repeated through the entry",
              ],
              ["Ventilation", "What is running, and how it is confirmed to be working"],
              ["Equipment", "Instrument used, harness, retrieval device, lighting, communications"],
              ["Rescue", "Who, how they are called, and the expected minutes to reach the space"],
              ["Cancelation", "When and why the permit ended"],
            ],
          },
          {
            type: "paragraph",
            text: `Completed permits are kept at: ${records}. The ${role} reads them rather than filing them — a condition that repeatedly comes up on permits is telling the Company something no single entry does.`,
          },
        ],
      },
    ];

    if (hostPermit) {
      body.push({
        heading: "Where the Site Issues Its Own Permit",
        blocks: [
          {
            type: "paragraph",
            text: "On sites that operate their own permit system, the site's permit governs the entry and the Company works under it.",
          },
          {
            type: "paragraph",
            text: `Before the entry, the supervisor establishes what the site's permit requires, what the site's rescue arrangement is, and how long that rescue would take to reach the space. Where the site's permit records less than the list above, ${company} records the remainder alongside it.`,
          },
          {
            type: "paragraph",
            text: "Working under somebody else's permit does not transfer responsibility for the Company's own people. If the arrangement on the permit is one the Company would not accept on its own, the entry does not proceed.",
          },
        ],
      });
    }

    body.push({
      heading: "Stopping an Entry",
      blocks: [
        {
          type: "paragraph",
          text: "Any entrant, the attendant, the entry supervisor, or anybody else present may order an entry stopped and the space evacuated. No reason has to be given at the time and none has to turn out to be correct.",
        },
        {
          type: "paragraph",
          text: "Everybody leaves immediately on that order, on any unexpected instrument reading, on any symptom felt by anybody inside, on the failure of ventilation or communications, and on any condition not covered by the permit.",
        },
        {
          type: "paragraph",
          text: "Re-entry requires a new permit and fresh testing. Nobody is questioned or penalized for calling an evacuation that turns out to have been unnecessary.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how employees of the Company identify confined spaces, decide whether a permit is required, test and monitor the atmosphere, station an attendant, arrange rescue, and record all of it before anybody enters.",
      policy: `It is the policy of ${company} that nobody enters a permit-required space without a completed permit, an attendant outside, a proved atmosphere, and a rescue arrangement that is written down and known to be capable of reaching them in time.`,
      body,
      trainingPoints: [
        "That any part of the body past the opening is entry",
        "The test order — oxygen, flammable, toxic — and why oxygen has to be first",
        "That the attendant never enters, no matter what is happening inside",
        "That everybody leaves on any evacuation order, without waiting for a reason",
        "How the harness and retrieval line let a rescue start without anybody going in",
        "That most people who die in these spaces went in to help somebody else",
      ],
      supervisorTraining:
        "Entry supervisors are additionally taken through completing and canceling a permit, verifying isolations and test results before signing, confirming the rescue arrangement and its response time, and the conditions under which retrieval equipment may be omitted.",
      reviewTrigger:
        "The review reads the completed permits together, and re-checks that each rescue arrangement is still in place and still able to respond in the time recorded.",
    });
  },
};
