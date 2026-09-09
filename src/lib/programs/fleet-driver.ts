import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Fleet and Driver Safety.
 *
 * ## The hazard that kills the most contractors and gets the least program
 *
 * Driving is where a small industrial contractor's people are most likely to
 * be killed, and it is almost always the thinnest document in their file. It
 * happens off site, between jobs, so it does not feel like work.
 *
 * The content that matters is therefore not vehicle inspection. It is the
 * three things that actually kill crews: phones, fatigue at the end of a long
 * shift, and the schedule that made somebody drive when they should not have.
 * The last is the company's decision rather than the driver's, and the
 * document says so.
 *
 * ## What it will not do
 *
 * State an hours-of-service limit, a license class, a following distance, or
 * any figure from the transport regulations. Commercial drivers sit under a
 * separate federal regime with its own numbers, most of these contractors are
 * not under it, and a template that printed either set would be wrong for
 * somebody in a way they would act on.
 */

const Q = {
  responsible: "responsible_role",
  vehicles: "vehicle_types",
  licenseChecks: "license_checks",
  phones: "phone_policy",
  fatigue: "fatigue_rule",
  inspections: "inspection_routine",
  records: "records_location",
} as const;

const PHONE: Record<string, string> = {
  no_use:
    "Nobody uses a phone while driving on Company business. Not handheld, not hands-free, not for a call from the office. The vehicle is stopped somewhere safe first.",
  hands_free_calls:
    "Handheld phone use while driving is not permitted under any circumstances. Hands-free calls are permitted, and drivers are expected to end one and stop somewhere safe if the conversation needs attention.",
};

export const FLEET_DRIVER: ProgramTemplate = {
  id: "fleet_driver",
  title: "Fleet and Driver Safety",
  shortName: "Fleet and Driver Safety",
  requirementId: "fleet-driver-safety",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(fleet ?(and|&) ?driver safety|driver safety|fleet safety|motor vehicle safety)( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.vehicles,
      prompt: "What do your people drive for work?",
      kind: "choice",
      required: true,
      options: [
        { id: "pickups", label: "Pickups and vans" },
        { id: "pickups_trailers", label: "Pickups and vans, towing trailers" },
        { id: "includes_cdl", label: "Some of it needs a commercial license" },
      ],
    },
    {
      id: Q.licenseChecks,
      prompt: "How do you know everyone's license is valid?",
      kind: "choice",
      required: true,
      options: [
        { id: "annual_check", label: "We check driving records once a year" },
        { id: "on_hire_and_annual", label: "On hiring, then once a year" },
        { id: "self_report", label: "Drivers must tell us of any change" },
      ],
    },
    {
      id: Q.phones,
      prompt: "What's the rule on phones while driving?",
      kind: "choice",
      required: true,
      options: [
        { id: "no_use", label: "No phone use at all — stop the vehicle" },
        { id: "hands_free_calls", label: "Hands-free calls only, never handheld" },
      ],
    },
    {
      id: Q.fatigue,
      prompt: "Can someone say they're too tired to drive home?",
      help: "After a long shift or a turnaround, this is the decision that matters.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.inspections,
      prompt: "How are vehicles checked?",
      kind: "choice",
      required: true,
      options: [
        { id: "daily_walkaround", label: "A walkaround before each day's driving" },
        { id: "weekly", label: "A weekly check, plus anything the driver notices" },
        { id: "scheduled_service", label: "Scheduled servicing, plus driver reports" },
      ],
    },
    {
      id: Q.records,
      prompt: "Where are driver records and vehicle checks kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const fatigue = answers[Q.fatigue] === "yes";
    const cdl = answers[Q.vehicles] === "includes_cdl";
    const trailers = answers[Q.vehicles] !== "pickups";
    const records = (answers[Q.records] ?? "").trim();

    const licenseChecks =
      answers[Q.licenseChecks] === "self_report"
        ? `Drivers are required to tell the ${role} immediately of any change to their license — a suspension, a restriction, points, or a medical condition affecting their ability to drive. The Company relies on that, so it is stated as a condition of driving for the Company rather than a courtesy.`
        : answers[Q.licenseChecks] === "on_hire_and_annual"
          ? `The ${role} checks each driver's record before they first drive for the Company and at least annually after that. Drivers additionally report any change immediately rather than waiting for the next check.`
          : `The ${role} checks each driver's record at least annually. Drivers additionally report any change immediately rather than waiting for the next check.`;

    const inspection =
      answers[Q.inspections] === "weekly"
        ? "Vehicles are checked weekly — tires and pressures, lights, brakes, mirrors, glass, wipers, fluid levels, load securing points, and the first aid and fire equipment carried. Anything a driver notices between checks is reported the same day."
        : answers[Q.inspections] === "scheduled_service"
          ? "Vehicles are serviced to the manufacturer's schedule, and drivers report anything they notice the same day rather than at the next service. A fault reported and not fixed is worse than one nobody mentioned, so reports are closed out and the driver told."
          : "Drivers walk around the vehicle before the day's driving — tires, lights, glass, mirrors, wipers, leaks under the vehicle, and anything loose in the bed or the load. It takes a minute and is the only check that happens often enough to catch a tire going down.";

    const body: Section[] = [
      {
        heading: "Why This Program Exists",
        blocks: [
          {
            type: "paragraph",
            text: `Driving is the most dangerous thing most employees of ${company} do. It does not feel that way, because it happens between jobs rather than on them, and because everybody has been doing it since they were seventeen.`,
          },
          {
            type: "paragraph",
            text: "Time on the road is work time and is treated as work. A crash on the way to a job is a workplace incident and is reported and investigated as one.",
          },
        ],
      },
      {
        heading: "Who May Drive",
        blocks: [
          {
            type: "paragraph",
            text: "Anybody driving on Company business holds a current license valid for the vehicle, and is authorized by the Company to drive it.",
          },
          { type: "paragraph", text: licenseChecks },
          {
            type: "paragraph",
            text: "Somebody whose license is suspended, restricted, or no longer valid for the vehicle does not drive for the Company until it is resolved. Saying so is not a disciplinary matter; driving anyway is.",
          },
        ],
      },
      {
        heading: "Phones",
        blocks: [
          { type: "paragraph", text: PHONE[answers[Q.phones]] },
          {
            type: "paragraph",
            text: `Nobody at ${company} is expected to answer a call, read a message, or reply to dispatch while driving. Anybody who calls a driver and hears they are on the road ends the call.`,
          },
          {
            type: "paragraph",
            text: "This is stated as an obligation on the office as much as on the driver. A rule that leaves somebody choosing between the policy and their supervisor's call is not a rule.",
          },
          {
            type: "paragraph",
            text: "Navigation is set before setting off, not adjusted while moving.",
          },
        ],
      },
      {
        heading: "Driving",
        blocks: [
          {
            type: "bullets",
            items: [
              "Seat belts are worn by everybody in the vehicle, on every journey, including short ones on site.",
              "Speed is chosen for the conditions, the load and the road, and the posted limit is a maximum rather than a target.",
              "Following distance is increased in rain, at night, when towing, and when loaded.",
              "Loads are secured before setting off, and checked again after the first few miles.",
              "Nobody rides in the bed of a pickup or on a trailer.",
              "Reversing is avoided where the vehicle can be parked to drive out forwards; where it cannot, somebody guides the driver.",
              "Journeys are planned to avoid the need to hurry, and a delay is reported rather than made up on the road.",
            ],
          },
        ],
      },
    ];

    if (fatigue) {
      body.push({
        heading: "Too Tired to Drive",
        blocks: [
          {
            type: "paragraph",
            text: "After a long shift, a turnaround, or a night call-out, driving home is often the most dangerous part of the day — and it is the part that gets the least thought.",
          },
          {
            type: "paragraph",
            text: `Any employee of ${company} may say they are too tired to drive. That is not a request and does not need justifying. The Company arranges a room, another driver, or a ride, and the cost of that is the Company's.`,
          },
          {
            type: "paragraph",
            text: "Nobody is questioned or penalized for saying so, and nobody is asked to prove it. An employee who expects an argument will drive.",
          },
          {
            type: "paragraph",
            text: `Supervisors are responsible for noticing, not only for agreeing when asked. Somebody who has worked eighteen hours is not well placed to judge their own fitness to drive, and the ${role} is told when a shift runs long enough that this becomes likely.`,
          },
          {
            type: "paragraph",
            text: "Where the Company's own scheduling has produced the situation, that is the Company's problem to fix and is raised at the review rather than absorbed by whoever was driving.",
          },
        ],
      });
    }

    body.push({
      heading: "Vehicles",
      blocks: [
        { type: "paragraph", text: inspection },
        {
          type: "paragraph",
          text: "A vehicle with a defect affecting safety — brakes, steering, tires, lights, wipers — is not driven until it is fixed. Nobody decides to make one more trip on it.",
        },
        {
          type: "paragraph",
          text: `Defects are reported to the ${role} the same day, and the driver is told what has been done. A reporting route that produces no visible response stops being used.`,
        },
        {
          type: "paragraph",
          text: "Vehicles carry a first aid kit, a fire extinguisher where appropriate, and whatever the season and the region make sensible. Tools and materials in a cab or an unsecured bed become projectiles in a crash and are stowed.",
        },
      ],
    });

    if (trailers) {
      body.push({
        heading: "Towing",
        blocks: [
          {
            type: "paragraph",
            text: "Before towing, the driver checks the coupling is properly engaged and secured, the safety chains are crossed and connected, the lights work, the tires are sound, and the load is secured and within the limits of both the trailer and the towing vehicle.",
          },
          {
            type: "paragraph",
            text: "Weights are checked against what the vehicle is rated to tow rather than what it will physically pull. The two are different, and the difference shows up when braking.",
          },
          {
            type: "paragraph",
            text: "The coupling and the load are checked again after the first few miles, when things settle. Speed is lower when towing, following distance longer, and reversing done with somebody guiding.",
          },
        ],
      });
    }

    if (cdl) {
      body.push({
        heading: "Commercial Driving",
        blocks: [
          {
            type: "paragraph",
            text: "Where a vehicle or a load requires a commercial license, those journeys sit under a separate federal regime with its own requirements for licensing, medical certification, hours, records and testing.",
          },
          {
            type: "paragraph",
            text: "Those requirements apply in addition to this program, and where the two differ the federal requirements govern for that driving. The Company maintains that separately and does not treat this document as covering it.",
          },
        ],
      });
    }

    body.push({
      heading: "Crashes and Near Misses",
      blocks: [
        {
          type: "paragraph",
          text: "Every crash, however minor, and every near miss is reported under the Company's incident reporting program — including single-vehicle incidents, damage found on a vehicle, and anything that happened on a site rather than a road.",
        },
        {
          type: "numbered",
          items: [
            "Stop, and check whether anybody is hurt.",
            "Make the scene safe where that can be done without standing in traffic.",
            "Call emergency services where anybody is injured or the road is blocked.",
            "Exchange details, and photograph the scene and the vehicles where it is safe to.",
            "Tell the supervisor the same day, whatever the time.",
            "Do not accept or assign blame at the scene.",
          ],
        },
        {
          type: "paragraph",
          text: `Records under this program — driver authorizations, license checks, vehicle checks and defect reports — are kept at: ${records}.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company decides who may drive on its business, what is expected of them on the road, how its vehicles are kept fit to drive, and what happens after a crash.",
      policy: `It is the policy of ${company} that time on the road is work time, that nobody is expected to answer a phone while driving, and that anybody may say they are too tired to drive without having to justify it.`,
      body,
      trainingPoints: [
        "That driving is the most dangerous thing most of us do for this company",
        "The phone rule, and that nobody at the office expects you to answer while moving",
        "Seat belts on every journey, including short ones on site",
        fatigue
          ? "That you may say you are too tired to drive, and the Company will sort out a ride or a room"
          : "To tell your supervisor if you do not feel fit to drive",
        "To report any vehicle defect the same day, and not to make one more trip on it",
        "What to do at the scene of a crash, and that it is reported the same day however minor",
      ],
      supervisorTraining:
        fatigue
          ? "Supervisors are additionally taken through noticing fatigue rather than waiting to be told, arranging a ride or a room, and raising scheduling that regularly produces long drives home."
          : "Supervisors are additionally taken through closing out reported defects and telling the driver, and raising scheduling that regularly produces long drives home.",
      reviewTrigger:
        "The review looks at journeys as well as crashes, since a route or a schedule that keeps producing long drives at the end of long shifts is a finding in itself.",
    });
  },
};
