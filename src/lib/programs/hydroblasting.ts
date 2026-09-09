import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * High-Pressure Water Blasting.
 *
 * ## The injury that gets somebody killed by looking minor
 *
 * A high-pressure water jet can inject through skin leaving a mark like a pin
 * prick. The person walks away, the wound closes, and the damage underneath —
 * contamination driven deep into tissue — develops over hours. People lose
 * limbs to injuries they described at the time as nothing.
 *
 * So the load-bearing content is not the equipment. It is that *any* contact
 * with the jet goes to hospital immediately, that the person is told to say
 * it was a high-pressure injection injury, and that nobody accepts "I'm
 * fine". A contractor's program that treats this as a laceration is the one
 * that costs somebody a hand.
 *
 * ## The other one is the dump valve
 *
 * The control that stops the jet has to be one the operator holds and
 * releases, so that letting go stops it. Everything about how the work is
 * organised — the barrier, the dry shot, the communications — follows from
 * the fact that a jet does not care what it is pointed at.
 *
 * ## What it will not do
 *
 * State a pressure, a flow rate, a standoff distance, a barrier distance, or
 * a hose test interval. Those come from the equipment manufacturer and the
 * industry practice document the customer works to, and a number printed here
 * would compete with the one on the machine.
 */

const Q = {
  responsible: "responsible_role",
  work: "work_type",
  control: "dump_control",
  barrier: "exclusion_route",
  comms: "communication_method",
  medical: "medical_briefing",
  records: "records_location",
} as const;

const COMMS: Record<string, string> = {
  radio: "Operators and the pump attendant stay in contact by radio, and the pump is shut down immediately if contact is lost.",
  line_of_sight:
    "The pump attendant keeps the operator in sight for the whole time the pump is running, and shuts it down the moment they lose sight of them.",
  signals:
    "Hand signals agreed before the work starts are used, and the pump attendant keeps the operator in sight. The pump is shut down the moment sight is lost.",
};

export const HYDROBLASTING: ProgramTemplate = {
  id: "hydroblasting",
  title: "High-Pressure Water Blasting",
  shortName: "Water Blasting",
  requirementId: "hydroblasting",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(hydro ?blasting|high[- ]pressure water (blasting|jetting)|water ?jetting)( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.work,
      prompt: "What do you blast?",
      kind: "choice",
      required: true,
      options: [
        { id: "surfaces", label: "Surfaces, structures and equipment externally" },
        { id: "tubes_lines", label: "Tubes, lines and heat exchangers" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.control,
      prompt: "How does the operator stop the jet?",
      help: "It has to stop when they let go, not when they press something.",
      kind: "choice",
      required: true,
      options: [
        { id: "dead_man", label: "A dead-man control they hold open" },
        { id: "foot_control", label: "A foot control they hold down" },
      ],
    },
    {
      id: Q.barrier,
      prompt: "How is everybody else kept out of the area?",
      kind: "choice",
      required: true,
      options: [
        { id: "hard_barrier", label: "Physical barriers and signs" },
        { id: "barrier_and_watch", label: "Barriers, signs and somebody watching the boundary" },
      ],
    },
    {
      id: Q.comms,
      prompt: "How do the operator and the pump attendant stay in contact?",
      kind: "choice",
      required: true,
      options: [
        { id: "radio", label: "Radio" },
        { id: "line_of_sight", label: "Line of sight" },
        { id: "signals", label: "Agreed hand signals" },
      ],
    },
    {
      id: Q.medical,
      prompt: "Do crews carry a card explaining injection injury to a doctor?",
      help: "Emergency staff who have not seen one often underestimate it.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are equipment and inspection records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const card = answers[Q.medical] === "yes";
    const tubes = answers[Q.work] !== "surfaces";
    const watch = answers[Q.barrier] === "barrier_and_watch";
    const records = (answers[Q.records] ?? "").trim();

    const control =
      answers[Q.control] === "foot_control"
        ? "The operator works through a foot control that has to be held down. Releasing it dumps the pressure. It is never blocked, weighted, tied or wedged."
        : "The operator works through a dead-man control that has to be held open. Releasing it dumps the pressure. It is never tied back, taped, wedged or defeated in any way.";

    const body: Section[] = [
      {
        heading: "What the Hazard Actually Is",
        blocks: [
          {
            type: "paragraph",
            text: "A high-pressure water jet cuts. It does not need to touch skin for long, it does not slow down for protective clothing, and it will go through a boot.",
          },
          {
            type: "paragraph",
            text: "The dangerous part is what it leaves behind. A jet can inject through the skin leaving a mark the size of a pin prick, driving water, debris and whatever was on the surface deep into the tissue. The wound closes. The person says they are fine. The damage develops over the following hours, and people have lost limbs to injuries they described at the time as nothing.",
          },
          {
            type: "paragraph",
            text: "That is why the medical rule in this program is written the way it is, and why it is not left to the person who was hit to decide.",
          },
        ],
      },
      {
        heading: "Any Contact Goes to Hospital",
        blocks: [
          {
            type: "paragraph",
            text: "Anybody who has been struck by the jet — however small the mark, however fine they feel, however certain they are it was nothing — goes to hospital immediately. Not at the end of the shift, and not if it still hurts tomorrow.",
          },
          {
            type: "numbered",
            items: [
              "Shut the pump down and make the area safe.",
              "Do not probe, squeeze or try to clean out the wound.",
              "Get them to emergency care straight away, and do not let them drive themselves.",
              "Tell the medical staff, in these words, that it is a high-pressure water injection injury, what pressure the equipment runs at, and what was on the surface being cleaned.",
              `Tell the supervisor, who tells the ${role} immediately.`,
            ],
          },
          {
            type: "paragraph",
            text: card
              ? "Every crew carries a card explaining injection injury, which is handed to the medical staff on arrival. Emergency staff who have not seen one of these before can reasonably read a pin-prick mark as trivial, and the card exists to prevent that."
              : "Whoever takes them explains the mechanism to the medical staff rather than leaving it to the injured person. Emergency staff who have not seen an injection injury before can reasonably read a pin-prick mark as trivial.",
          },
          {
            type: "paragraph",
            text: `Nobody at ${company} is questioned or penalized for going to hospital over a mark that turns out to be nothing. That is the outcome the Company wants every time.`,
          },
        ],
      },
      {
        heading: "Before the Pump Starts",
        blocks: [
          {
            type: "numbered",
            items: [
              "The job is planned and gone through with everybody on it: what is being cleaned, what is on it, where the operator will stand, and where everybody else will be.",
              "What is being cleaned is isolated, drained and depressurized under the Company's lockout/tagout program, and the isolation is proved.",
              "The exclusion area is set up and everybody outside it before any pressure is raised.",
              "Equipment is inspected — hoses, connections, lances, guns, nozzles, the dump control and the pressure relief.",
              "A dry run is done at low pressure to confirm the controls work, the connections hold and everybody is where they should be.",
              "Only then is working pressure raised.",
            ],
          },
          { type: "paragraph", text: control },
          {
            type: "paragraph",
            text: "A dead-man control that has been defeated is the single most common factor in serious injury with this equipment, and it is always defeated because holding it is tiring. A control found tied, taped or wedged takes that equipment out of service and is treated as a serious matter under the Company's accountability program.",
          },
        ],
      },
      {
        heading: "The Exclusion Area",
        blocks: [
          {
            type: "paragraph",
            text: "A jet does not care what it is pointed at, and it reflects off surfaces in ways nobody predicts. So the area is cleared rather than managed.",
          },
          {
            type: "paragraph",
            text: watch
              ? "Physical barriers and signs mark the area, and somebody watches the boundary for the whole time the pump is running. Their only job is that boundary — they are not also tending the pump or handling hose."
              : "Physical barriers and signs mark the area, positioned to account for reflection off the surface being cleaned rather than only for the direct line of the jet.",
          },
          {
            type: "paragraph",
            text: "Only the people doing the work are inside it. Anybody who enters stops the job — the pump is shut down first and the conversation happens afterwards.",
          },
          {
            type: "paragraph",
            text: "Where the work is above or below other people, or near an area that cannot be cleared, the Company talks to the site before the work is scheduled rather than working around it on the day.",
          },
          { type: "paragraph", text: COMMS[answers[Q.comms]] },
        ],
      },
      {
        heading: "Protective Equipment",
        blocks: [
          {
            type: "paragraph",
            text: "Protective equipment for this work is chosen for the pressure being used, from what the equipment supplier specifies. It reduces injury; it does not make anybody safe to point a jet at.",
          },
          {
            type: "paragraph",
            text: "That distinction matters and is stated to every operator. Somebody who believes their equipment will stop the jet will take a risk they would not otherwise take, and the equipment will not stop it.",
          },
          {
            type: "paragraph",
            text: "Face and eye protection, hearing protection, and protection for the body, hands and feet are worn for the whole time pressure is up — including during a lull, because a lull is when somebody walks past with a lance in their hands.",
          },
          {
            type: "paragraph",
            text: "Where the surface being cleaned carries a chemical, a coating or a residue, the Company's hazard communication program applies to it and respiratory protection is arranged before the job rather than on the morning.",
          },
        ],
      },
    ];

    if (tubes) {
      body.push({
        heading: "Tubes, Lines and Exchangers",
        blocks: [
          {
            type: "paragraph",
            text: "Rigid lances and flexible hoses fed into tubes bring a hazard the operator cannot see: the end of the tool is somewhere they are not looking.",
          },
          {
            type: "paragraph",
            text: "A flexible lance is fitted with a device that prevents the nozzle backing out of the tube under pressure, and the pressure is dumped before the lance is withdrawn. A jet that emerges from the tube it went into is pointed at whoever is feeding it.",
          },
          {
            type: "paragraph",
            text: "The far end of anything being cleaned through is treated as part of the exclusion area, whether or not anybody can see it from the operating position. Somebody standing at the other side of an exchanger is in the line of the jet.",
          },
          {
            type: "paragraph",
            text: "Where the work is done from a rigid setup or a machine, the operator stays outside the line of the lance and the equipment is set so it cannot move under reaction force.",
          },
        ],
      });
    }

    body.push({
      heading: "Equipment",
      blocks: [
        {
          type: "paragraph",
          text: "Hoses, connections, lances, guns and nozzles are inspected before every use and are taken out of service on any sign of damage, wear, distortion or a repair that was not made by the manufacturer.",
        },
        {
          type: "paragraph",
          text: "Hoses are not kinked, dragged over sharp edges, driven over, or used to pull equipment. A hose failure at working pressure is a whip and a jet at once.",
        },
        {
          type: "paragraph",
          text: "Connections are made up correctly and restrained where the equipment provides for it. Nothing is adjusted, tightened or disconnected while the system is under pressure, and pressure is dumped and confirmed to be down before any part of the system is opened.",
        },
        {
          type: "paragraph",
          text: `Equipment is used within the pressure the manufacturer states for it, and the Company does not exceed a rating to get a job done faster. Records are kept at: ${records}.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how high-pressure water blasting is set up and controlled, who is kept out of the area, and what happens the moment anybody is struck by the jet.",
      policy: `It is the policy of ${company} that the control stopping the jet is one the operator holds and is never defeated, and that anybody struck by the jet goes to hospital immediately whatever the mark looks like and whatever they say about it.`,
      body,
      trainingPoints: [
        "That a jet can inject through skin leaving a mark like a pin prick, and that the damage develops over hours",
        "That any contact means hospital immediately, and that the words to use are \"high-pressure injection injury\"",
        "That nobody is questioned for going over a mark that turns out to be nothing",
        "That the dead-man control is never tied, taped or wedged, however tiring it is",
        "That protective equipment reduces injury and does not make anybody safe to point a jet at",
        "That anybody entering the exclusion area stops the job before anything is said",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through setting the exclusion area for reflection rather than the direct line, running the low-pressure dry check before working pressure, and taking equipment out of service when a control has been defeated.",
      reviewTrigger:
        "The review asks specifically whether any dead-man control has been found defeated, since that is the failure that precedes the serious injuries in this work.",
    });
  },
};
