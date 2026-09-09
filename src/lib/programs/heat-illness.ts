import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Heat Illness Prevention.
 *
 * ## The one where minutes decide the outcome
 *
 * Heat stroke is the only common industrial illness where the difference
 * between a scare and a death is how fast somebody starts cooling the person
 * down. Waiting for an ambulance before cooling is the standard mistake, and
 * it is fatal often enough that this program says the opposite explicitly:
 * start cooling now, call while cooling.
 *
 * ## Acclimatization is the part nobody has
 *
 * Most heat deaths are people in their first days on the job — a new hire, or
 * somebody back after a week off, put straight onto a full shift in the heat.
 * The body adapts over roughly a week and does not adapt at all if nobody
 * builds in the time. A program without an acclimatization schedule has
 * skipped the single most protective thing in the subject.
 *
 * ## What it will not do
 *
 * State a temperature at which anything is triggered. Heat illness depends on
 * humidity, radiant heat, air movement, workload, clothing and the individual,
 * and several states set their own thresholds that differ from each other. A
 * template printing one number would give a crew in Houston a threshold
 * written for somewhere else, and — worse — imply they are fine below it.
 */

const Q = {
  responsible: "responsible_role",
  workType: "work_setting",
  water: "water_supply",
  shade: "shade_provision",
  acclimatization: "acclimatization_buildup",
  buddy: "buddy_checks",
  records: "records_location",
} as const;

const WATER: Record<string, string> = {
  crew_supply:
    "The Company supplies drinking water to every work location, cool and in enough quantity for everybody to drink a cup every fifteen to twenty minutes across the whole shift. It is placed as close to the work as it can safely be — water fifty yards away is water people do not drink.",
  site_supply:
    "Drinking water is supplied by the site. Before work starts the supervisor confirms where it is, that it is cool, and that there is enough of it for the Company's crew as well as everybody else's. Where there is not, the Company brings its own.",
  individual:
    "Each employee is issued an insulated container and it is filled before the shift and refilled during it. The supervisor keeps a bulk supply at the work location so that refilling does not mean leaving the area.",
};

export const HEAT_ILLNESS: ProgramTemplate = {
  id: "heat_illness",
  title: "Heat Illness Prevention",
  shortName: "Heat Illness",
  requirementId: "heat-illness",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^heat (illness|stress)( prevention)?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.workType,
      prompt: "Where does the heat come from?",
      kind: "choice",
      required: true,
      options: [
        { id: "outdoor", label: "Outdoor work in hot weather" },
        { id: "indoor_process", label: "Hot process equipment, vessels, or enclosed spaces" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.water,
      prompt: "How does drinking water reach the crew?",
      kind: "choice",
      required: true,
      options: [
        { id: "crew_supply", label: "We bring it to the work area" },
        { id: "individual", label: "Personal containers, refilled from bulk on site" },
        { id: "site_supply", label: "The site provides it" },
      ],
    },
    {
      id: Q.shade,
      prompt: "Where do people cool off?",
      kind: "choice",
      required: true,
      options: [
        { id: "provided_shade", label: "Shade we set up at the work area" },
        { id: "vehicle_ac", label: "An air-conditioned vehicle or trailer" },
        { id: "site_facility", label: "A break area the site provides" },
      ],
    },
    {
      id: Q.acclimatization,
      prompt: "Do you build people up gradually in the heat?",
      help: "Most heat deaths are people in their first few days.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.buddy,
      prompt: "Do crews watch each other for symptoms?",
      help: "Somebody developing heat stroke usually cannot recognize it in themselves.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are acclimatization and training records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const acclimatization = answers[Q.acclimatization] === "yes";
    const buddy = answers[Q.buddy] === "yes";
    const indoor = answers[Q.workType] !== "outdoor";
    const records = (answers[Q.records] ?? "").trim();

    const shade =
      answers[Q.shade] === "vehicle_ac"
        ? "An air-conditioned vehicle or trailer is kept at the work area and is available throughout the shift, not only at break times."
        : answers[Q.shade] === "site_facility"
          ? "The site's break area is used. Before work starts the supervisor confirms it is close enough to reach quickly, is out of the sun, and is available to the Company's crew whenever somebody needs it rather than only on a schedule."
          : "Shade is set up at the work area — a canopy, an awning, or another structure that blocks direct sun and does not trap heat under it. It is up before the work starts and stays up.";

    const body: Section[] = [
      {
        heading: "Water",
        blocks: [
          { type: "paragraph", text: WATER[answers[Q.water]] },
          {
            type: "paragraph",
            text: "Employees are told to drink small amounts often rather than a lot at once, and to keep drinking whether or not they feel thirsty. Thirst arrives after dehydration has already started, and somebody working hard in heat can lose fluid faster than thirst reports it.",
          },
          {
            type: "paragraph",
            text: "Nobody is expected to work through to a scheduled break before drinking. Supervisors remind crews rather than waiting to be asked.",
          },
        ],
      },
      {
        heading: "Getting Out of the Heat",
        blocks: [
          { type: "paragraph", text: shade },
          {
            type: "paragraph",
            text: "Any employee may stop and cool off whenever they need to, without asking and without explaining. Somebody who has to justify a break will not take one, and heat illness gets worse quietly.",
          },
          {
            type: "paragraph",
            text: "As conditions get harder, the Company shortens the time spent working before a break rather than expecting people to last the same stretch. Where the work allows it, the heaviest tasks are moved to the cooler part of the day.",
          },
        ],
      },
    ];

    if (acclimatization) {
      body.push({
        heading: "Building Up to Full Shifts",
        blocks: [
          {
            type: "paragraph",
            text: "The body adapts to working in heat over about a week, and it does not adapt at all if nobody allows the time. Most people who die of heat are in their first days on a job.",
          },
          {
            type: "paragraph",
            text: "So somebody working in the heat for the first time, or returning after more than about a week away, builds up:",
          },
          {
            type: "bullets",
            items: [
              "Roughly half a normal workload on the first day, increasing over the following days to a full one by about the end of the first week",
              "Under the eye of a supervisor or their mentor throughout, watched rather than checked on",
              "With the build-up restarted after any absence of about a week or more, including holidays and sickness",
            ],
          },
          {
            type: "paragraph",
            text: "The same applies to everybody, including experienced people, in the first hot spell of the year and during a sudden heat wave. A crew that worked all last summer is not acclimatized to the first genuinely hot week of this one.",
          },
          {
            type: "paragraph",
            text: `Being short-handed is not a reason to skip this, and the ${role} is told rather than the schedule being met.`,
          },
        ],
      });
    }

    if (buddy) {
      body.push({
        heading: "Watching Each Other",
        blocks: [
          {
            type: "paragraph",
            text: "Somebody developing heat stroke commonly cannot recognize it in themselves — confusion is one of the symptoms, and it arrives before the person knows anything is wrong. They will often insist they are fine.",
          },
          {
            type: "paragraph",
            text: "So crews work in sight of each other in the heat, and everybody is expected to watch their crewmates rather than only themselves. Nobody works alone in high heat.",
          },
          {
            type: "paragraph",
            text: "Where an employee says somebody looks unwell, that is acted on immediately even if the person says otherwise. Their own assessment of themselves is the least reliable one available.",
          },
        ],
      });
    }

    body.push({
      heading: "The Signs",
      blocks: [
        {
          type: "paragraph",
          text: "Heat exhaustion and heat stroke are not two levels of the same thing, and the difference decides what to do:",
        },
        {
          type: "table",
          head: ["", "Heat exhaustion", "Heat stroke"],
          rows: [
            [
              "How they seem",
              "Weak, dizzy, nauseous, headache, cramps",
              "Confused, slurring, agitated, unsteady, unconscious",
            ],
            ["Skin", "Cool, pale, heavy sweating", "Hot; may be dry, may still be sweating"],
            ["Thinking", "Clear", "Not clear — this is the sign that matters"],
            [
              "What it is",
              "Serious, and gets worse if ignored",
              "A medical emergency — minutes matter",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "The reliable difference is how the person is thinking. Anybody who is confused, behaving oddly, slurring, or not making sense is treated as heat stroke, whatever their skin feels like and whatever they say about it.",
        },
        {
          type: "paragraph",
          text: "Nobody at the scene is expected to tell the two apart with confidence. Where there is any doubt, it is treated as heat stroke.",
        },
      ],
    });

    body.push({
      heading: "What to Do",
      blocks: [
        {
          type: "paragraph",
          text: "For somebody unwell in the heat but thinking clearly: stop work, get them into shade or air conditioning, loosen or remove heavy clothing and protective equipment, give them cool water to sip, cool them with wet cloths or a fan, and stay with them. They do not go back to work that shift, and they do not drive themselves anywhere.",
        },
        {
          type: "paragraph",
          text: "For anybody confused, unsteady, unconscious, or not making sense:",
        },
        {
          type: "numbered",
          items: [
            "Start cooling them immediately. Cold water over the whole body, immersion where that is possible, ice packs to the neck, armpits and groin, wet sheets, and air moving over them.",
            "Call emergency help while the cooling is going on. Somebody else makes the call — cooling does not pause for it.",
            "Keep cooling until help arrives and takes over.",
            "Never leave them alone, and never send them off in a vehicle with one person driving.",
          ],
        },
        {
          type: "paragraph",
          text: "Cooling first, calling second, is deliberate and is the most important sentence in this program. Waiting for an ambulance before starting to cool somebody is the standard mistake in heat stroke, and it is the one that turns a survivable emergency into a death or permanent injury.",
        },
        {
          type: "paragraph",
          text: `Before work starts at any location, the supervisor establishes how emergency help is called there and how they would describe the location to a dispatcher. On a large plant that is not obvious, and working it out during an emergency costs the minutes that matter.`,
        },
      ],
    });

    if (indoor) {
      body.push({
        heading: "Heat From the Work Itself",
        blocks: [
          {
            type: "paragraph",
            text: "Heat is not only weather. Work inside vessels, near furnaces or steam, in enclosed spaces, in protective suits, or in full protective equipment can produce heat illness on a mild day, and a crew that thinks of this as a summer problem will be caught out in spring.",
          },
          {
            type: "paragraph",
            text: "Where clothing or equipment prevents sweat evaporating, the body loses its main way of cooling itself. Work in that equipment is planned in shorter stretches with cooling in between, and the person is watched throughout.",
          },
          {
            type: "paragraph",
            text: "Where practical the source is dealt with first — equipment cooled before entry, ventilation, shielding from radiant heat, or the job moved to the coolest part of the day.",
          },
        ],
      });
    }

    body.push({
      heading: "Things That Make Somebody More Vulnerable",
      blocks: [
        {
          type: "paragraph",
          text: "Some medications, some medical conditions, alcohol the night before, an illness with fever or diarrhea, poor sleep, and simply getting older all reduce how well somebody handles heat. Two people doing identical work are not at identical risk.",
        },
        {
          type: "paragraph",
          text: `An employee who has been told by a doctor that something makes them more vulnerable to heat is encouraged to tell their supervisor or the ${role}. They do not have to say what the condition is, and what they do say goes no further than the person they told.`,
        },
        {
          type: "paragraph",
          text: "Nobody loses work for saying so. The point is to plan the job around it, and an employee who expects to be sent home will say nothing.",
        },
        {
          type: "paragraph",
          text: `Records under this program, including acclimatization schedules, are kept at: ${records}.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company protects employees working in heat: water, cooling, building up to full shifts, watching for the signs, and what is done immediately when somebody shows them.",
      policy: `It is the policy of ${company} that anybody may stop and cool off whenever they need to, without asking, and that somebody who may have heat stroke is cooled immediately rather than after help has been called.`,
      body,
      trainingPoints: [
        "To drink small amounts often, and not to wait until you are thirsty",
        "That you may stop and cool off at any time, without asking anybody",
        "The signs, and that confusion is the one that means heat stroke",
        "That somebody with heat stroke usually cannot tell, and will say they are fine",
        "To start cooling immediately and have somebody else make the call",
        "How emergency help is called at the site you are working on today",
      ],
      supervisorTraining:
        acclimatization
          ? "Supervisors are additionally taken through running an acclimatization build-up when the crew is short-handed, adjusting work and rest as conditions get harder, and acting on a report about somebody else even when that person insists they are fine."
          : "Supervisors are additionally taken through adjusting work and rest as conditions get harder, and acting on a report about somebody else even when that person insists they are fine.",
      reviewTrigger:
        "The review happens before the first hot spell of the year rather than after it.",
    });
  },
};
