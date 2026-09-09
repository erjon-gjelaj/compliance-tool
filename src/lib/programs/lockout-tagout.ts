import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Control of Hazardous Energy (Lockout/Tagout).
 *
 * ## The five things a reviewer looks for
 *
 * The config's element set names them, and they are the five most commonly
 * missing: equipment-specific procedures, group lockout, continuity across a
 * shift change, coordination with other employers, and an annual inspection
 * carried out by somebody other than the authorized employee.
 *
 * The last of those is not a guess. A scaffolding contractor's rejection note,
 * pasted into an intake and sitting in the database since July, reads:
 * "Lockout/tagout program does not include periodic inspection requirements."
 * It is the only first-hand rejection this project holds, and this program is
 * written so it could not attract the same one.
 *
 * ## The equipment-specific procedure is a form, not prose
 *
 * A written program cannot contain the isolation points of machines it has
 * never seen. Trying would produce either uselessly generic text or invented
 * specifics, and the second is far worse. So the program ends with a blank
 * equipment procedure — the same design as the Emergency Action Plan's site
 * record — and commits to one being completed per machine before it is worked
 * on. The blank is explained in the document so a reviewer reads it as a
 * deliberate control rather than an unfinished draft.
 *
 * ## What it never says
 *
 * Which standard applies. Construction and general industry are treated
 * differently on this subject and the project has deliberately never verified
 * a one-to-one counterpart, so the document states what the Company does and
 * leaves the legal question where it belongs.
 */

const Q = {
  responsible: "responsible_role",
  whoIsolates: "who_isolates",
  groupWork: "group_work",
  shiftChange: "shift_change",
  otherEmployers: "other_employers",
  inspector: "annual_inspector",
  storage: "records_location",
} as const;

const INSPECTOR: Record<string, string> = {
  responsible_person:
    "The inspection is carried out by the person responsible for this program, who does not themselves apply locks in the course of the work being inspected.",
  other_supervisor:
    "The inspection is carried out by a supervisor other than the one who supervised the work, and never by the authorized employee whose procedure is being inspected.",
  external:
    "The inspection is carried out by somebody from outside the Company, engaged for the purpose, who has no part in the work being inspected.",
};

export const LOCKOUT_TAGOUT: ProgramTemplate = {
  id: "loto",
  title: "Control of Hazardous Energy (Lockout/Tagout)",
  shortName: "Lockout/Tagout",
  requirementId: "lockout-tagout",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(control of hazardous energy( \(lockout ?\/ ?tagout\))?|lockout ?\/? ?tagout|loto)( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.whoIsolates,
      prompt: "Who is allowed to apply a lock?",
      help: "Only named, prepared people should be — that is the point of the program.",
      kind: "choice",
      required: true,
      options: [
        { id: "named_list", label: "A named list the company keeps" },
        { id: "supervisors", label: "Supervisors only" },
        { id: "trained_crew", label: "Any crew member who has been through the training" },
      ],
    },
    {
      id: Q.groupWork,
      prompt: "Do several people ever work under one isolation?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.shiftChange,
      prompt: "Does work under isolation ever carry across a shift change?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.otherEmployers,
      prompt: "Do you isolate equipment on sites where other contractors work?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.inspector,
      prompt: "Who checks the procedures each year?",
      help: "It cannot be the person whose own work is being checked — reviewers look at this.",
      kind: "choice",
      required: true,
      options: [
        { id: "responsible_person", label: "Whoever looks after the program" },
        { id: "other_supervisor", label: "A different supervisor" },
        { id: "external", label: "Somebody from outside the company" },
      ],
    },
    {
      id: Q.storage,
      prompt: "Where are the equipment procedures and inspection records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const group = answers[Q.groupWork] === "yes";
    const shift = answers[Q.shiftChange] === "yes";
    const others = answers[Q.otherEmployers] === "yes";
    const storage = (answers[Q.storage] ?? "").trim();

    const authorized =
      answers[Q.whoIsolates] === "supervisors"
        ? "Only supervisors apply locks and tags. Other employees work under an isolation applied by a supervisor and are told what has been isolated and how it was proved."
        : answers[Q.whoIsolates] === "trained_crew"
          ? `Only employees who have been through this program's instruction apply locks and tags. The ${role} keeps the list of who those employees are, and it is a list of names rather than a job title.`
          : `The ${role} keeps a written list, by name, of the employees authorized to apply locks and tags. Nobody not on that list applies one, and the list is reviewed whenever somebody joins or leaves.`;

    const body: Section[] = [
      {
        heading: "Who May Apply a Lock",
        blocks: [
          { type: "paragraph", text: authorized },
          {
            type: "paragraph",
            text: "Every other employee is expected to recognize a lock or tag, to understand that it means the equipment must not be operated, and never to remove or bypass one applied by somebody else.",
          },
          {
            type: "paragraph",
            text: `A lock applied by an employee of ${company} is removed by that employee. The one exception is set out below, and it is deliberately difficult.`,
          },
        ],
      },
      {
        heading: "Isolating Equipment",
        blocks: [
          {
            type: "paragraph",
            text: "Before any employee works on equipment where unexpected start-up or stored energy could injure them, the equipment is isolated in this sequence:",
          },
          {
            type: "numbered",
            items: [
              "Establish what energy the equipment holds and where it comes from — electrical, hydraulic, pneumatic, mechanical, thermal, chemical, gravity, or stored pressure. The equipment-specific procedure says what it is; where none exists yet, one is written before the work starts.",
              "Tell everybody affected that the equipment is being shut down, before it is.",
              "Shut the equipment down by its normal stopping method.",
              "Operate each energy-isolating device so that the equipment is isolated from every source. A control switch or a start button is not an isolating device.",
              "Apply a lock, and a tag, to each isolating device. Each authorized employee applies their own lock.",
              "Release, restrain, or otherwise make safe any stored or residual energy — springs, raised parts, capacitors, air, hydraulic pressure, heat.",
              "Prove the isolation worked. Attempt to start the equipment by its normal controls, then return the controls to off. Where a test is not possible, verify by another means recorded in the procedure.",
            ],
          },
          {
            type: "paragraph",
            text: "Step seven is the one that is skipped and the one that kills people. An isolation nobody proved is a belief about the equipment, not a control on it.",
          },
        ],
      },
      {
        heading: "Returning Equipment to Service",
        blocks: [
          {
            type: "numbered",
            items: [
              "Check the work area: tools accounted for, guards back on, parts reassembled.",
              "Check that everybody is clear of the equipment, by looking rather than by assuming.",
              "Each employee removes their own lock and tag.",
              "Tell everybody affected before the equipment is re-energized.",
              "Re-energize and confirm the equipment behaves as expected.",
            ],
          },
        ],
      },
      {
        heading: "Removing Somebody Else's Lock",
        blocks: [
          {
            type: "paragraph",
            text: `A lock is removed by the person who applied it. Where that person cannot be reached and the lock must come off, only the ${role} may authorize its removal, and only after all of the following:`,
          },
          {
            type: "bullets",
            items: [
              "Every reasonable attempt has been made to contact the employee, and those attempts are recorded",
              "It has been verified that the employee is not on site",
              "The equipment and the area have been checked and are safe to re-energize",
              "Arrangements are in place to tell the employee, before they resume work, that their lock was removed",
            ],
          },
          {
            type: "paragraph",
            text: "Each removal is recorded with the reason, who authorized it, and what was checked. A removal that is easy to authorize will be authorized when it should not be, so this is written to be difficult on purpose.",
          },
        ],
      },
      {
        heading: "Equipment-Specific Procedures",
        blocks: [
          {
            type: "paragraph",
            text: "This program describes the method. What it cannot describe is the equipment, because the isolation points of a machine are particular to that machine.",
          },
          {
            type: "paragraph",
            text: "So a written procedure is completed for each piece of equipment before it is worked on under this program, and is used by the employee doing the isolation rather than kept in a file:",
          },
          {
            type: "table",
            head: [
              "Equipment / location",
              "Energy sources",
              "Isolating devices and where they are",
              "Stored energy and how it is released",
              "How isolation is proved",
              "Written by / date",
            ],
            rows: [
              ["", "", "", "", "", ""],
              ["", "", "", "", "", ""],
              ["", "", "", "", "", ""],
            ],
          },
          {
            type: "paragraph",
            text: `A blank row is not an oversight. ${company} does not know the isolation points of equipment it has not yet been shown, and this program does not pretend otherwise — the row is completed before the work, from the equipment itself.`,
          },
        ],
      },
    ];

    if (group) {
      body.push({
        heading: "Several People Under One Isolation",
        blocks: [
          {
            type: "paragraph",
            text: "Where more than one person works under a single isolation, each of them applies their own personal lock. Nobody relies on somebody else's lock for their own protection.",
          },
          {
            type: "paragraph",
            text: "Where the isolating device cannot take that many locks, a group lockout device is used: the isolation is locked, its key is placed in a lock box, and every employee working under it applies their personal lock to the box. The isolation cannot be released until the last personal lock is removed.",
          },
          {
            type: "paragraph",
            text: "One employee is named as being in charge of the group isolation. They verify the isolation before anybody starts and confirm everybody is clear before it is released — but their lock does not substitute for anybody else's.",
          },
        ],
      });
    }

    if (shift) {
      body.push({
        heading: "Shift Change",
        blocks: [
          {
            type: "paragraph",
            text: "Where work under isolation continues past the end of a shift, the isolation stays in place throughout. It is never released and re-applied to hand over.",
          },
          {
            type: "paragraph",
            text: "The handover happens at the equipment: the arriving employee applies their lock before the leaving employee removes theirs, so that at no moment is the equipment unlocked. The arriving employee verifies the isolation themselves rather than accepting that it was verified earlier.",
          },
          {
            type: "paragraph",
            text: "Where a lock box is in use, the same rule applies to it. The box stays locked across the change.",
          },
        ],
      });
    }

    if (others) {
      body.push({
        heading: "Working Alongside Other Employers",
        blocks: [
          {
            type: "paragraph",
            text: `Before isolating anything on a site run by somebody else, the supervisor for the job establishes the site's own energy control arrangements and tells site control what ${company} intends to isolate, and when.`,
          },
          {
            type: "paragraph",
            text: "Where the host employer's procedure is stricter, theirs applies. Where the Company's people work under an isolation applied by somebody else, each of them still applies their own personal lock — a host's lock protects the host's people, and the Company does not delegate its own crew's protection to a lock it did not apply.",
          },
          {
            type: "paragraph",
            text: "Where another contractor may be affected by an isolation the Company applies, they are told before it is applied and before it is released.",
          },
        ],
      });
    }

    body.push({
      heading: "Annual Inspection of the Procedures",
      blocks: [
        {
          type: "paragraph",
          text: "Each equipment-specific procedure is inspected at least once a year, and the inspection looks at the procedure being used rather than at the paper it is written on.",
        },
        { type: "paragraph", text: INSPECTOR[answers[Q.inspector]] },
        {
          type: "paragraph",
          text: "The inspector observes an isolation being carried out where that is practical, and otherwise goes through the procedure step by step with the authorized employee. The point is to find out whether the procedure as written matches what people actually do, and to correct whichever of the two is wrong.",
        },
        {
          type: "paragraph",
          text: "The inspection record states the equipment, the date, who inspected it, which authorized employees were included, what was found, and what was changed as a result.",
        },
        {
          type: "paragraph",
          text: `Records are kept at: ${storage}.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how employees of the Company isolate equipment from its energy sources before working on it, prove the isolation, and return the equipment to service afterwards.",
      policy: `It is the policy of ${company} that nobody works on equipment that could start up or release stored energy unless it has been isolated, locked, and proved dead by the person relying on it.`,
      scopeNote:
        "It applies wherever an employee could be injured by unexpected start-up or by energy released from equipment being worked on, including on sites the Company does not control.",
      body,
      trainingPoints: [
        "The seven-step isolation sequence, and that proving the isolation is part of it",
        "That your own protection comes from your own lock and never from somebody else's",
        "Never to remove or bypass a lock or tag applied by another person",
        "That a control switch or start button is not an energy-isolating device",
        group
          ? "How a lock box works, and why the isolation cannot release until your lock is off it"
          : "What to do if you find equipment locked and need it",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through writing an equipment-specific procedure, the conditions under which a lock may be removed in somebody's absence, and coordinating an isolation with other employers on site.",
      reviewTrigger:
        "The annual inspection findings are read together at the review, since a step being missed on several procedures is a problem with the program rather than with the people.",
    });
  },
};
