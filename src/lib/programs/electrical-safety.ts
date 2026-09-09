import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Electrical Safety.
 *
 * ## The PPE table is deliberately blank
 *
 * The config's element set asks for a PPE category table. Reproducing the
 * consensus standard's tables is not an option: they are copyrighted, and
 * transcribing arc ratings from memory into a document a contractor will rely
 * on in front of a live panel is exactly the kind of invented specific this
 * project refuses to produce.
 *
 * The better answer is also the more accurate one. Arc flash PPE is
 * determined per item of equipment, from that equipment's own study and its
 * label — which is why equipment carries labels at all. So the program
 * carries a blank table the company completes from the labels on the
 * equipment they actually work on, in the same shape as the Lockout/Tagout
 * equipment procedure and the Emergency Action Plan's site record. A reviewer
 * gets a table; the contractor gets one that is true for their own equipment
 * rather than a generic one that may not be.
 *
 * ## The load-bearing sentence
 *
 * De-energize. Almost everything that kills electricians happens on
 * equipment that could have been turned off, and the honest program says the
 * conditions under which working live is permitted are narrow and require a
 * signature — rather than describing live work as a normal activity with
 * gloves.
 *
 * ## What it will not say
 *
 * Any boundary distance, incident energy value, arc rating, glove class, or
 * PPE category number. Every one of those is equipment-specific and
 * standard-specific, and a wrong one is worse than none.
 */

const Q = {
  responsible: "responsible_role",
  workType: "work_type",
  qualified: "qualified_basis",
  liveWork: "live_work",
  labels: "label_source",
  testEquipment: "test_equipment",
  records: "records_location",
} as const;

const QUALIFIED: Record<string, string> = {
  named_list:
    "The Company keeps a written list, by name, of the employees qualified for electrical work, and what each of them is qualified for. Being an electrician by trade does not by itself put somebody on the list for a particular task or piece of equipment.",
  license_plus_task:
    "Employees hold the license their work requires, and are additionally established as qualified for the specific equipment and task before being assigned to it. A license establishes trade knowledge, not familiarity with a particular installation.",
};

export const ELECTRICAL_SAFETY: ProgramTemplate = {
  id: "electrical_safety",
  title: "Electrical Safety",
  shortName: "Electrical Safety",
  requirementId: "electrical-safety",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^electrical safety( ?\/ ?nfpa ?70e)?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.workType,
      prompt: "What electrical work do your crews do?",
      kind: "choice",
      required: true,
      options: [
        { id: "installation", label: "Installation and wiring, de-energized" },
        { id: "maintenance", label: "Maintenance and troubleshooting on live plant" },
        { id: "incidental", label: "Mostly non-electrical work near electrical equipment" },
      ],
    },
    {
      id: Q.qualified,
      prompt: "How do you establish who is qualified for electrical work?",
      kind: "choice",
      required: true,
      options: [
        { id: "named_list", label: "A named list, by task" },
        { id: "license_plus_task", label: "License, plus sign-off for the specific equipment" },
      ],
    },
    {
      id: Q.liveWork,
      prompt: "Do your crews ever work on equipment while it is energized?",
      help: "Including troubleshooting and taking readings.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.labels,
      prompt: "Where does arc flash information come from?",
      kind: "choice",
      required: true,
      options: [
        { id: "site_labels", label: "Labels on the client's equipment" },
        { id: "our_study", label: "A study we have had done" },
        { id: "not_available", label: "Often it isn't available" },
      ],
    },
    {
      id: Q.testEquipment,
      prompt: "Do crews carry their own test instruments?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are the qualified list and permits kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const liveWork = answers[Q.liveWork] === "yes";
    const testEquipment = answers[Q.testEquipment] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const labelSource =
      answers[Q.labels] === "our_study"
        ? "The Company holds an engineering study for the equipment it maintains, and the arc flash information for a given item is taken from that study and its label."
        : answers[Q.labels] === "not_available"
          ? `Arc flash information is often not available on the equipment ${company} is sent to. Where a label is missing or illegible, the equipment is treated as though the hazard were present and the work is not done energized — the crew does not estimate the boundary or select protection by judgment.`
          : "Arc flash information is taken from the label on the equipment. The supervisor confirms a label is present and legible before the work is planned, and where it is not, the work is not done energized.";

    const body: Section[] = [
      {
        heading: "De-Energize First",
        blocks: [
          {
            type: "paragraph",
            text: "Work is done on equipment that has been de-energized, isolated, locked out and proved dead. That is the Company's normal method and not an exception to it.",
          },
          {
            type: "paragraph",
            text: "Equipment is proved dead by testing at the point of work with an instrument, and the instrument is proved on a known live source before and after the test. Testing dead with an instrument that was already faulty is how people are killed by equipment they believe is isolated.",
          },
          {
            type: "paragraph",
            text: `Isolation follows the Company's lockout/tagout program. Each person working on the equipment applies their own lock.`,
          },
          {
            type: "paragraph",
            text: "Deadline pressure, inconvenience to the client, and the difficulty of arranging an outage are not reasons to work energized. They are the reasons people give afterwards.",
          },
        ],
      },
      {
        heading: "Who May Do Electrical Work",
        blocks: [
          { type: "paragraph", text: QUALIFIED[answers[Q.qualified]] },
          {
            type: "paragraph",
            text: "Somebody qualified for this work can identify the live parts, knows the voltages involved, understands the approach distances that apply to the equipment, and can use the test instruments and protective equipment the task needs.",
          },
          {
            type: "paragraph",
            text: `Everybody else — including experienced tradespeople in other trades — stays outside the limits set for the job and does not open enclosures, operate disconnects for the purpose of the work, or remove covers.`,
          },
        ],
      },
      {
        heading: "Arc Flash and Shock",
        blocks: [
          {
            type: "paragraph",
            text: "There are two hazards and they are not the same. Shock depends on contact with a live part, and the protection is distance and insulation. Arc flash depends on the energy the equipment can release, and the protection is distance and arc-rated clothing. A task can be safe from one and not the other.",
          },
          { type: "paragraph", text: labelSource },
          {
            type: "paragraph",
            text: "Boundaries, incident energy and the protection required are particular to the equipment. This program does not state them, because a number written here would be about equipment nobody has seen — and a wrong boundary is more dangerous than no boundary, since it is acted on.",
          },
          {
            type: "paragraph",
            text: "The Company records what applies to the equipment it works on, taken from that equipment's own label or study:",
          },
          {
            type: "table",
            head: [
              "Equipment / location",
              "Voltage",
              "Arc flash boundary from label",
              "Incident energy or category from label",
              "Protection required",
              "Recorded by / date",
            ],
            rows: [
              ["", "", "", "", "", ""],
              ["", "", "", "", "", ""],
              ["", "", "", "", "", ""],
            ],
          },
          {
            type: "paragraph",
            text: `The rows are blank on purpose. ${company} does not know the arc flash values of equipment it has not yet been shown, and this program does not invent them — the row is completed from the equipment's own label before the work is planned.`,
          },
        ],
      },
    ];

    if (liveWork) {
      body.push({
        heading: "The Narrow Case for Working Energized",
        blocks: [
          {
            type: "paragraph",
            text: "Work is done energized only where de-energizing would itself introduce a greater hazard, or where the task genuinely cannot be done any other way — diagnostic testing and troubleshooting that requires the circuit live are the usual examples.",
          },
          {
            type: "paragraph",
            text: "Wanting to avoid an outage is not one of those. Neither is the client's schedule.",
          },
          {
            type: "paragraph",
            text: "Where the case is genuine, a permit is completed and signed before the work starts. It records:",
          },
          {
            type: "table",
            head: ["Section", "What is recorded"],
            rows: [
              ["Equipment and location", "What, where, and on whose site"],
              ["Work to be done", "The specific task requiring energized conditions"],
              ["Why energized", "Why de-energizing is not possible, or is more hazardous"],
              ["Hazard information", "Voltage, and boundaries and energy from the equipment label"],
              ["Protection", "Arc-rated clothing, insulating equipment, tools, shields"],
              ["People", "Who is doing the work, and who is standing by"],
              ["Boundaries and barriers", "How others are kept out of the area"],
              ["Job briefing", "That it was held, and who attended"],
              ["Emergency", "How help is summoned and by whom"],
              ["Approved by", "Signature, and the date and time"],
            ],
          },
          {
            type: "paragraph",
            text: `The ${role} approves the permit. A supervisor under schedule pressure does not approve their own energized work.`,
          },
          {
            type: "paragraph",
            text: "A job briefing is held at the equipment before the work, covering the hazards, the procedure, the protection and what to do if something goes wrong. Nobody works energized alone.",
          },
        ],
      });
    }

    if (testEquipment) {
      body.push({
        heading: "Test Instruments and Tools",
        blocks: [
          {
            type: "paragraph",
            text: "Test instruments are rated for the voltage and the environment they are used in, and are inspected before each use — leads, insulation, probes, and the instrument body.",
          },
          {
            type: "paragraph",
            text: "An instrument is proved on a known live source immediately before and immediately after any test for absence of voltage. Anything found damaged is taken out of service rather than used with care.",
          },
          {
            type: "paragraph",
            text: "Insulated tools are used where the task requires them, are inspected before use, and are withdrawn on any nick, crack or embedded swarf in the insulation.",
          },
        ],
      });
    }

    body.push({
      heading: "Working Near Electrical Equipment",
      blocks: [
        {
          type: "paragraph",
          text: "Most of the Company's people are not doing electrical work but do work near it. Before any work near electrical equipment or overhead lines, the supervisor establishes what is live, where it is, and how far everybody has to stay from it.",
        },
        {
          type: "paragraph",
          text: "Overhead lines are treated as live and uninsulated unless the owner has confirmed otherwise in writing. Scaffolds, ladders, lifts, cranes, poles and long materials are the usual way somebody who is not an electrician is electrocuted.",
        },
        {
          type: "paragraph",
          text: "Panels and enclosures are kept closed, and the space in front of them kept clear so that somebody can operate a disconnect quickly. Temporary power and cords are inspected before use, protected from damage and traffic, and taken out of service if the ground pin is missing or the sheath is broken.",
        },
      ],
    });

    body.push({
      heading: "If Somebody Is Injured",
      blocks: [
        {
          type: "paragraph",
          text: "Nobody touches a person in contact with a live conductor. The supply is isolated first — anybody who reaches out becomes the second casualty, and this happens often enough that it is written here rather than assumed.",
        },
        {
          type: "paragraph",
          text: "Once the supply is isolated, emergency help is summoned and first aid given by whoever is prepared to give it.",
        },
        {
          type: "paragraph",
          text: "Anybody who has received an electric shock is taken for medical attention even where they appear unhurt and say they are fine, because the effects on the heart can appear later. That is not their decision to make at the scene.",
        },
        {
          type: `paragraph`,
          text: `Records under this program — the qualified list, permits, briefings and equipment information — are kept at: ${records}.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how employees of the Company work on and near electrical equipment: proving it dead before working on it, who is qualified to do the work, what the equipment's own labels say about the hazard, and the narrow conditions under which anything is done energized.",
      policy: `It is the policy of ${company} that electrical work is done on de-energized equipment that has been proved dead, and that no schedule, client or inconvenience is a reason to work on it live.`,
      body,
      trainingPoints: [
        "That equipment is proved dead with an instrument, and the instrument proved live before and after",
        "That being a tradesperson does not make somebody qualified for a particular piece of equipment",
        "That shock and arc flash are different hazards with different protection",
        "That the hazard values come from the equipment's own label and are never estimated",
        "To stay outside the limits set for a job if you are not doing the electrical work",
        "Never to touch somebody in contact with a live conductor before the supply is isolated",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through confirming labels before planning work, recognizing when a claimed case for energized work is really a schedule problem, and holding a job briefing at the equipment.",
      reviewTrigger:
        "The review reads any energized work permits issued since the last one, and asks in each case whether de-energizing was genuinely impossible.",
    });
  },
};
