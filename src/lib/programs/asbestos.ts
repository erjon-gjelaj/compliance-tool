import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Asbestos Awareness and Control.
 *
 * ## Two completely different documents, and the questionnaire picks
 *
 * A contractor who removes asbestos is doing licensed work under a regime of
 * its own — accreditation, notification, negative pressure enclosures,
 * clearance monitoring, medical surveillance. Nothing generated from a
 * questionnaire could serve as their program, and pretending otherwise would
 * be dangerous.
 *
 * A contractor who does *not* remove asbestos but works in buildings and
 * plant that contain it — insulators, mechanical, electrical, demolition
 * support — needs something quite different: recognize it, do not disturb it,
 * stop and report. That document is genuinely writable and it is the one
 * almost every customer of this product actually needs.
 *
 * So the first question decides which, and where the answer is "we remove
 * it", the document says plainly that this is not their program and refers
 * them to their licensed procedures. Refusing to produce the wrong document
 * is the whole value of asking.
 *
 * ## The load-bearing sentence for everybody else
 *
 * Assume it is asbestos until somebody establishes it is not. In older plant
 * and buildings, the material that looks like ordinary lagging usually is,
 * and the person who finds out otherwise is the one who already cut through
 * it.
 *
 * ## What it will not do
 *
 * Name an exposure limit, a fiber count, a control level, a class of work, a
 * notification period, or a removal method. Those belong to the licensed
 * regime and to the applicable standard.
 */

const Q = {
  responsible: "responsible_role",
  removes: "we_remove",
  survey: "survey_route",
  found: "on_discovery",
  training: "awareness_training",
  records: "records_location",
} as const;

export const ASBESTOS: ProgramTemplate = {
  id: "asbestos",
  title: "Asbestos Awareness and Control",
  shortName: "Asbestos",
  requirementId: "asbestos",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^asbestos( awareness| management| control)?( ?(and|&) ?control)?( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    {
      id: Q.removes,
      prompt: "Does your company remove or abate asbestos?",
      help: "That is licensed work with its own regime. This program is for everyone else.",
      kind: "boolean",
      required: true,
    },
    RESPONSIBLE_QUESTION,
    {
      id: Q.survey,
      prompt: "How do you find out whether asbestos is present before a job?",
      kind: "choice",
      required: true,
      showWhen: (answers) => answers[Q.removes] === "no",
      options: [
        { id: "ask_client", label: "We ask the client for their survey or register" },
        { id: "written_confirmation", label: "We require written confirmation before starting" },
        { id: "assume_present", label: "We assume it's present in older buildings and plant" },
      ],
    },
    {
      id: Q.found,
      prompt: "What happens when someone finds suspect material mid-job?",
      kind: "choice",
      required: true,
      showWhen: (answers) => answers[Q.removes] === "no",
      options: [
        { id: "stop_and_report", label: "Stop, leave it, report — work doesn't resume until it's identified" },
        { id: "stop_and_isolate", label: "Stop, isolate the area, report" },
      ],
    },
    {
      id: Q.training,
      prompt: "Do crews get awareness training so they can recognize it?",
      kind: "boolean",
      required: true,
      showWhen: (answers) => answers[Q.removes] === "no",
    },
    {
      id: Q.records,
      prompt: "Where are surveys and reports kept?",
      kind: "text",
      required: true,
      showWhen: (answers) => answers[Q.removes] === "no",
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const removes = answers[Q.removes] === "yes";

    /*
     * The refusal branch. A generated document cannot serve as the program for
     * licensed abatement work, and producing something that looked like one
     * would be worse than producing nothing: it would sit in a file where a
     * reviewer, or a crew, might take it for the real thing.
     */
    if (removes) {
      return assembleWithSpine({
        company,
        role,
        purpose:
          "the position of the Company on asbestos work, and where its actual working procedures for that work are held.",
        policy: `${company} carries out licensed asbestos work. The procedures governing that work are not contained in this document.`,
        body: [
          {
            heading: "This Document Is Not the Company's Asbestos Program",
            blocks: [
              {
                type: "paragraph",
                text: `${company} removes or abates asbestos. That is licensed work, carried out under an accreditation, and it is governed by procedures written for the Company's specific methods, equipment, enclosures, monitoring and medical surveillance.`,
              },
              {
                type: "paragraph",
                text: "Those procedures are held separately and are the ones that govern the work. This document does not replace, summarize or supplement them, and nothing in it should be read as describing how the Company carries out abatement.",
              },
              {
                type: "paragraph",
                text: "It exists so that anybody who finds it in the Company's files knows where the real procedures are, and does not mistake this for them.",
              },
            ],
          },
          {
            heading: "Where the Real Procedures Are",
            blocks: [
              {
                type: "paragraph",
                text: `The ${role} holds the Company's licensed asbestos procedures, its accreditation, its notification records, its air monitoring and clearance records, and the medical surveillance records for the employees who do that work.`,
              },
              {
                type: "paragraph",
                text: "Any request from a hiring client, a regulator or an employee about the Company's asbestos work is answered from those records rather than from this document.",
              },
            ],
          },
          {
            heading: "What Applies to Everybody Else",
            blocks: [
              {
                type: "paragraph",
                text: `Employees of ${company} who are not part of the licensed work do not enter an enclosure, do not handle asbestos-containing material, and do not work in an area under abatement.`,
              },
              {
                type: "paragraph",
                text: "Anybody who finds material they suspect contains asbestos on any other job stops work, leaves it alone, keeps others away, and tells their supervisor immediately. Work in that area does not resume until the material has been identified by somebody competent to identify it.",
              },
              {
                type: "paragraph",
                text: "That rule holds however experienced the person is and however confident they are about what the material is.",
              },
            ],
          },
        ],
        trainingPoints: [
          "That the Company's licensed asbestos procedures are separate from this document",
          "That nobody outside the licensed work enters an enclosure or handles the material",
          "To stop, leave it, keep others away and report if you find suspect material on any job",
          "That the stop-and-report rule holds however sure you are about what the material is",
        ],
        supervisorTraining:
          "Supervisors are additionally taken through keeping employees who are not part of the licensed work away from areas under abatement.",
      });
    }

    const survey =
      answers[Q.survey] === "written_confirmation"
        ? `Before work starts at a location, ${company} requires written confirmation from the client about whether asbestos-containing material is present in the area, and where. Work does not start without it.`
        : answers[Q.survey] === "assume_present"
          ? `Before work starts, ${company} asks the client for their asbestos survey or register. Where none is produced, material in older buildings and plant is treated as containing asbestos until somebody competent establishes otherwise.`
          : `Before work starts at a location, ${company} asks the client for their asbestos survey or register, and for the specific areas the Company will be working in. What comes back is read rather than filed.`;

    const training = answers[Q.training] === "yes";
    const records = (answers[Q.records] ?? "").trim();
    const isolate = answers[Q.found] === "stop_and_isolate";

    const body: Section[] = [
      {
        heading: "What This Company Does and Does Not Do",
        blocks: [
          {
            type: "paragraph",
            text: `${company} does not remove, repair, encapsulate or otherwise disturb asbestos-containing material. That is licensed work and the Company does not hold itself out as able to do it.`,
          },
          {
            type: "paragraph",
            text: "What the Company does do is work in buildings and plant where asbestos may be present. This program is about not disturbing it, and about what happens when somebody comes across it.",
          },
          {
            type: "paragraph",
            text: "Nobody is asked to remove a small amount, to move a section out of the way, or to work around it. Where the work cannot proceed without disturbing the material, the work stops.",
          },
        ],
      },
      {
        heading: "Assume It Is Asbestos",
        blocks: [
          {
            type: "paragraph",
            text: "In older buildings and plant, material that looks like ordinary lagging, board, gasket, rope, cement sheet, floor tile or fireproofing may contain asbestos. It cannot be identified by looking at it, however experienced somebody is.",
          },
          {
            type: "paragraph",
            text: "So the Company's rule is that any such material is treated as containing asbestos until somebody competent to identify it establishes that it does not. The person who finds out otherwise by cutting into it has already been exposed.",
          },
          {
            type: "paragraph",
            text: "Asbestos causes disease decades later, with no symptom at the time and no way of knowing afterwards which exposure did it. There is no moment during the work at which anybody can tell that something has gone wrong, which is why the rule is written as an absolute rather than as a judgment call.",
          },
        ],
      },
      {
        heading: "Before a Job Starts",
        blocks: [
          { type: "paragraph", text: survey },
          {
            type: "paragraph",
            text: "The supervisor establishes, for the specific area the crew will work in: whether asbestos-containing material has been identified there, where exactly it is, and what the client's own rules are about working near it.",
          },
          {
            type: "paragraph",
            text: "A survey covering a building is not the same as knowing what is behind the panel the crew is about to open. Where the work involves opening up a structure, breaking into insulation, or going into a void, that is raised with the client specifically rather than assumed to be covered.",
          },
          {
            type: "paragraph",
            text: `Where the answer is unclear, the ${role} is told and the work does not start until it is clear.`,
          },
        ],
      },
      {
        heading: "If Somebody Finds Suspect Material",
        blocks: [
          {
            type: "numbered",
            items: [
              "Stop work immediately. Not at the end of the task.",
              "Leave the material completely alone. Do not touch it, move it, sweep it up, or take a piece to show somebody.",
              isolate
                ? "Keep everybody out of the area — physically, with barriers or by closing it off — and stay out yourself."
                : "Keep everybody out of the area and stay out yourself.",
              `Tell the supervisor immediately, who tells the client and the ${role}.`,
              "Do not resume work in that area until the material has been identified by somebody competent, and the Company has been told in writing what it is.",
            ],
          },
          {
            type: "paragraph",
            text: "Where material has already been disturbed before anybody realized, everybody leaves the area straight away and does not brush themselves down or shake out clothing. That is reported immediately as an incident, and the client is told at once so the area can be assessed.",
          },
          {
            type: "paragraph",
            text: `Anybody who may have been exposed is told what happened, in writing, and what the Company knows about the material. A record is kept of who was present, what the work was, and how long it lasted — because that record may matter to them many years from now, and nobody else will keep it.`,
          },
          {
            type: "paragraph",
            text: `Nobody at ${company} is questioned or penalized for stopping a job over material that turns out not to contain asbestos. That is the outcome the Company wants every time it is stopped.`,
          },
        ],
      },
    ];

    if (training) {
      body.push({
        heading: "Recognizing It",
        blocks: [
          {
            type: "paragraph",
            text: "Employees who work in buildings and plant where asbestos may be present are given awareness training before they are assigned to that work, and it is repeated as the applicable standard requires.",
          },
          {
            type: "paragraph",
            text: "What it covers: where asbestos was commonly used and in what forms, what it looks like in the places this Company's people actually work, why it cannot be identified by eye, what disturbing it does, and exactly what to do on finding it.",
          },
          {
            type: "paragraph",
            text: "The training is explicitly not preparation to work with the material. Its purpose is recognition and stopping — and it says so, because somebody who has been through an awareness course can otherwise come away believing they are qualified to handle a small amount.",
          },
        ],
      });
    }

    body.push({
      heading: "Records",
      blocks: [
        {
          type: "paragraph",
          text: `Surveys and confirmations obtained from clients, reports of suspect material, and records of anybody who may have been exposed are kept at: ${records}.`,
        },
        {
          type: "paragraph",
          text: "Exposure records are kept for as long as the applicable standard requires, which is a very long time, and are not discarded when somebody leaves. The disease appears decades later and the person will have no other way of establishing where they were.",
        },
        {
          type: "paragraph",
          text: "An employee may see their own record at any time, and is given a copy when they leave.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company finds out whether asbestos is present before starting work, what employees do if they come across material they suspect contains it, and what is recorded.",
      policy: `It is the policy of ${company} that it does not disturb asbestos-containing material, that suspect material is treated as asbestos until somebody competent establishes otherwise, and that work stops rather than proceeding around it.`,
      body,
      trainingPoints: [
        "That the Company does not remove or disturb asbestos, and nobody will be asked to",
        "That it cannot be identified by looking, however experienced you are",
        "To stop, leave it alone, keep others out, and report — in that order",
        "Never to sweep it up, move it, or take a piece to show somebody",
        "That nobody will be questioned for stopping over material that turns out to be nothing",
        "That if it has already been disturbed, you leave without brushing yourself down",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through establishing what is present in the specific area before a crew starts, raising work that involves opening up a structure or entering a void, and recording who was present when material has been disturbed.",
      reviewTrigger:
        "The review checks that a survey or written confirmation was actually obtained for the jobs run since the last one, rather than assumed.",
    });
  },
};
