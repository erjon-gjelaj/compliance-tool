import type { Answers, ProgramTemplate, Section } from "@/lib/programs/types";

/**
 * Incident Reporting and Investigation.
 *
 * Written by hand in this repo and assembled deterministically, as the other
 * three are. The voice is the company's own throughout, and nothing here
 * tells the reader what the law obliges them to do.
 *
 * ## What this programme is actually for
 *
 * `lib/requirements` reduces this one to a single sentence: check it says
 * "who is told, in what order, and what gets written down". That is the whole
 * document. A subcontractor does not fail on this because their prose about
 * safety culture is thin; they fail because the programme never names a
 * person, never puts the notifications in an order, and never lists the
 * fields that end up on the record.
 *
 * So the three load-bearing parts here are a numbered notification ladder, a
 * table of the fields every incident record carries, and a corrective action
 * that has an owner, a date, and a check that it was actually done.
 * Everything else is framing.
 *
 * ## Why the notification ladder names the client
 *
 * This is the part written for subcontractors specifically. When a crew is
 * injured on a host employer's site, the host usually has a contractual
 * window to be told, separate from anything else — and a programme that
 * describes an internal chain ending at the owner is describing a company
 * that works alone. The client sits in the ladder, in position, with the
 * site's own control room ahead of it.
 *
 * ## The timing commitment, and why it carries no numbers from a regulation
 *
 * Serious events are reportable to OSHA on a clock. This document does not
 * state that clock, because the numbers would be hand-written here, and a
 * hand-written regulatory deadline in a customer's document is exactly what
 * the project forbids. Instead the Company commits to something it can be
 * held to and that cannot be wrong in either direction: it reports on the
 * same day it learns of the event, and the responsible person confirms the
 * current requirement at the point of making the report. A commitment
 * stricter than any deadline stays true whatever the deadline turns out to
 * be.
 *
 * ## What it never asserts
 *
 * That any incident has been investigated, that any corrective action was
 * completed, that anybody has been trained in this procedure, or that the
 * Company's records satisfy anybody's recordkeeping obligations. Each is a
 * fact about a particular day that a questionnaire cannot establish.
 */

/** Answer ids, so the template and the questions cannot drift apart. */
const Q = {
  responsible: "responsible_role",
  reportTiming: "report_timing",
  hostSites: "host_sites",
  recordLocation: "record_location",
  investigationLead: "investigation_lead",
  oshaLog: "osha_log",
  postIncidentTesting: "post_incident_testing",
} as const;

const RESPONSIBLE_LABELS: Record<string, string> = {
  owner: "Owner",
  safety_manager: "Safety Manager",
  supervisor: "Site Supervisor",
  operations_manager: "Operations Manager",
};

function responsibleRole(answers: Answers): string {
  const chosen = answers[Q.responsible];
  return RESPONSIBLE_LABELS[chosen] ?? chosen;
}

/**
 * How quickly an employee is expected to report.
 *
 * Each wording keeps the same two commitments: an injury needing more than
 * on-the-spot first aid is reported straight away regardless of the general
 * expectation, and lateness is never a reason to leave something unreported.
 * A programme that punishes a late report buys silence.
 */
const TIMING_SENTENCE: Record<string, string> = {
  immediately:
    "An employee reports an incident to their supervisor as soon as it is safe to do so, without waiting for the end of the task or the end of the shift.",
  same_shift:
    "An employee reports an incident to their supervisor before the end of the shift on which it happened. An injury needing more than on-the-spot first aid, and any event that could have caused a serious injury, is reported straight away rather than held to the end of the shift.",
  same_day:
    "An employee reports an incident to their supervisor on the day it happens. An injury needing more than on-the-spot first aid, and any event that could have caused a serious injury, is reported straight away rather than held to the end of the day.",
};

const INVESTIGATION_LEAD_SENTENCE: Record<string, string> = {
  responsible_role:
    "Every investigation is led by the {ROLE}, who is independent of the crew involved and is not the person whose work is being examined.",
  supervisor_with_role:
    "The supervisor of the crew involved gathers the facts, and the {ROLE} reviews the investigation and decides what is done about it. The supervisor does not close out their own investigation.",
  owner:
    "Every investigation is led by the Owner, working with the supervisor of the crew involved. The Owner decides what is done about it and records that decision.",
};

/**
 * Where somebody goes when the person they report to is the problem.
 *
 * A no-retaliation commitment that routes back to the same person it is
 * protecting against says nothing. Where the responsible role IS the owner,
 * the escalation has to go somewhere else, so the sentence names the owner
 * once rather than twice.
 */
function escalation(answers: Answers): string {
  const role = responsibleRole(answers);
  return role === "Owner"
    ? "with the Owner directly"
    : `with the ${role}, or with the Owner directly where the ${role} is the person concerned`;
}

function investigationLead(answers: Answers): string {
  const wording = INVESTIGATION_LEAD_SENTENCE[answers[Q.investigationLead]];
  return wording.replace("{ROLE}", responsibleRole(answers));
}

export const INCIDENT: ProgramTemplate = {
  id: "incident_reporting",
  title: "Incident Reporting and Investigation Program",
  shortName: "Incident Reporting",
  requirementId: "incident-reporting",

  /*
   * Not offered until somebody reviews the prose. Same rule as every other
   * programme (docs/release-one.md): the flag is lifted per programme, by a
   * person, and the lift is recorded here with a date.
   */
  release: "internal_testing",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^incident reporting and investigation$/i.test(label.trim()),

  /*
   * Seven questions, none of them about the past.
   *
   * What is deliberately NOT asked: anything that would let the document
   * assert a fact about the Company's history. Nobody is asked how many
   * incidents they have had, what their EMR is, or whether past
   * investigations were closed out — a programme is a statement of what the
   * Company does from now on, and answers about the past would end up printed
   * as claims a hiring client could check.
   */
  questions: [
    {
      id: Q.responsible,
      prompt: "Who does an incident get reported to?",
      help: "A role rather than a name, so it stays right when people change.",
      kind: "choice",
      required: true,
      options: [
        { id: "owner", label: "The owner" },
        { id: "safety_manager", label: "A safety manager" },
        { id: "supervisor", label: "A site supervisor" },
        { id: "operations_manager", label: "An operations manager" },
      ],
    },
    {
      id: Q.reportTiming,
      prompt: "How soon do you expect your crew to report something?",
      kind: "choice",
      required: true,
      options: [
        { id: "immediately", label: "Straight away, as soon as it is safe" },
        { id: "same_shift", label: "Before the end of the shift" },
        { id: "same_day", label: "Some time the same day" },
      ],
    },
    {
      id: Q.hostSites,
      prompt: "Do your crews work on sites run by a client?",
      help: "The client normally has to be told, and reviewers look for it.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.recordLocation,
      prompt: "Where do the incident records get kept?",
      help: "For example: a folder in the office safe, or a shared drive the office manages.",
      kind: "text",
      required: true,
    },
    {
      id: Q.investigationLead,
      prompt: "Who looks into what happened?",
      kind: "choice",
      required: true,
      options: [
        { id: "responsible_role", label: "The same person it was reported to" },
        {
          id: "supervisor_with_role",
          label: "The crew's supervisor, reviewed by that person",
        },
        { id: "owner", label: "The owner" },
      ],
    },
    {
      id: Q.oshaLog,
      prompt: "Do you keep an OSHA 300 log?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.postIncidentTesting,
      prompt: "Does a client contract require drug or alcohol testing after an incident?",
      kind: "boolean",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const hostSites = answers[Q.hostSites] === "yes";
    const recordLocation = (answers[Q.recordLocation] ?? "").trim();
    const oshaLog = answers[Q.oshaLog] === "yes";
    const postIncidentTesting = answers[Q.postIncidentTesting] === "yes";

    /*
     * The ladder. Built as an array because the client rungs are conditional
     * and the numbering has to close up behind them — a document that jumps
     * from 3 to 5 looks like something was deleted out of it.
     */
    const ladder: string[] = [
      "The employee tells their supervisor, or the nearest person in charge if their own supervisor is not there.",
      `The supervisor tells the ${role}. This happens the same day, whatever the size of the incident.`,
    ];

    if (hostSites) {
      ladder.push(
        "Where the work is on a site run by somebody else, that site's control room or contact is told immediately, so the host can account for their own people and act on anything that affects the rest of the site.",
        `The ${role} notifies the client's contact for the job, in the manner and within the time the contract for that job sets out.`,
      );
    }

    ladder.push(
      `Where somebody has died, has been admitted to hospital as an in-patient, has lost a limb or part of one, or has lost an eye, the ${role} reports it to OSHA on the same day ${company} learns of it, and confirms at that point what OSHA currently asks of the report.`,
      `The ${role} notifies the Company's insurer where the incident may give rise to a claim.`,
    );

    const sections: Section[] = [
      {
        heading: "Purpose and Policy",
        blocks: [
          {
            type: "paragraph",
            text: `This program sets out how employees of ${company} report an incident, who is told and in what order, what gets written down, and how the Company looks into what happened afterwards.`,
          },
          {
            type: "paragraph",
            text: `It is the policy of ${company} that every incident is reported, including the ones where nobody was hurt. An investigation is carried out to find out why something happened and to stop it happening again, not to establish who to blame.`,
          },
          {
            type: "paragraph",
            text: `No employee of ${company} is disciplined, penalized, or treated any differently for reporting an incident, for reporting one late, or for reporting one that turns out to be nothing. An employee who is discouraged from reporting by anybody in the Company raises it ${escalation(answers)}.`,
          },
        ],
      },
      {
        heading: "Scope",
        blocks: [
          {
            type: "paragraph",
            text: `This program applies to every employee of ${company}, at every location where the Company performs work, and to anybody working under the Company's direction.`,
          },
        ],
      },
      {
        heading: "What Counts as an Incident",
        blocks: [
          {
            type: "paragraph",
            text: "For the purposes of this program, all of the following are incidents and all of them are reported:",
          },
          {
            type: "bullets",
            items: [
              "An injury or illness of any size, including one treated on the spot with first aid",
              "A near miss — something that did not cause an injury but could have, such as a dropped object, a tool failure, or a step somebody did not fall from",
              "Damage to equipment, a vehicle, or property, whether the Company's or somebody else's",
              "A spill or release of any substance outside the container or system meant to hold it",
              "A fire, however small, and any activation of an alarm caused by the Company's work",
              "Any event a client or host employer says is reportable under the contract for that job",
            ],
          },
          {
            type: "paragraph",
            text: "The near miss is the one most often left unreported, and it is the one worth the most: it is the only kind of incident that describes a serious injury without anybody having been hurt to produce it.",
          },
        ],
      },
      {
        heading: "Immediate Actions at the Scene",
        blocks: [
          {
            type: "paragraph",
            text: "Before anything is reported or recorded, the people at the scene:",
          },
          {
            type: "numbered",
            items: [
              "Make sure nobody else is in danger, and stop work in the area if they are",
              "Get first aid or medical help to anybody who needs it, and call the emergency number for that location where the injury may be serious",
              "Leave the scene as it is, as far as it is safe to do so, so that what happened can still be seen",
            ],
          },
          {
            type: "paragraph",
            text: "Nothing is moved, cleared, or repaired at the scene before the supervisor has seen it, unless leaving it would put somebody at risk. Where something has to be moved for safety, it is photographed first if that can be done safely.",
          },
        ],
      },
      {
        heading: "Reporting: Who Is Told, and in What Order",
        blocks: [
          { type: "paragraph", text: TIMING_SENTENCE[answers[Q.reportTiming]] },
          {
            type: "paragraph",
            text: "From that point the notifications are made in this order:",
          },
          { type: "numbered", items: ladder },
          {
            type: "paragraph",
            text: `A step in this list is never skipped because somebody assumes another person has already made it. Where an employee cannot reach their supervisor, they contact the ${role} directly.`,
          },
        ],
      },
      {
        heading: "What Gets Written Down",
        blocks: [
          {
            type: "paragraph",
            text: "An incident record is completed for every incident, however minor, and is completed on the day the incident is reported. The record carries at least the following:",
          },
          {
            type: "table",
            head: ["Recorded", "What goes in it"],
            rows: [
              [
                "Date, time, and location",
                "Including the site, the client, and the specific area or unit",
              ],
              [
                "Who was involved",
                "Names of anybody injured, and of anybody who saw what happened",
              ],
              [
                "What happened",
                "In plain sequence, in the words of the people who were there",
              ],
              [
                "Injury or damage",
                "What the injury was, what treatment was given, and by whom",
              ],
              [
                "Work being done",
                "The task in progress, the equipment in use, and the permit if the job was under one",
              ],
              [
                "Conditions",
                "Weather, lighting, access, and anything else about the place that bears on it",
              ],
              [
                "Who was notified",
                "Each person and organization told, and when each was told",
              ],
              [
                "Immediate action taken",
                "What was done at the time to make the area safe",
              ],
              [
                "Investigation findings",
                "Completed later, when the investigation is finished",
              ],
              [
                "Corrective actions",
                "What is being changed, who owns each item, and the date it is due",
              ],
              [
                "Closed out by",
                "Who confirmed each corrective action was actually done, and when",
              ],
            ],
          },
          {
            type: "paragraph",
            text: "The record is written for somebody who was not there. It states what was observed separately from what anybody concluded from it, and does not record opinion about fault.",
          },
          {
            type: "paragraph",
            text: `Incident records are kept at: ${recordLocation}. They are treated as confidential, and medical details are seen only by those who need them.`,
          },
        ],
      },
      {
        heading: "Investigation",
        blocks: [
          {
            type: "paragraph",
            text: "Every reported incident is looked into. How far the investigation goes is proportionate to what happened, or to what could have happened: a near miss that could have killed somebody is investigated as thoroughly as an injury that did.",
          },
          { type: "paragraph", text: investigationLead(answers) },
          {
            type: "paragraph",
            text: "The investigation establishes, in this order:",
          },
          {
            type: "numbered",
            items: [
              "What happened, as a sequence of events, from the accounts of those present and from the scene itself",
              "What conditions and decisions made it possible — the equipment, the method, the planning, the supervision, and the pressure people were working under",
              "Which of those, if changed, would have prevented it or made it less serious",
              "What is going to be changed, who owns each change, and by when",
            ],
          },
          {
            type: "paragraph",
            text: "An investigation that concludes an employee was careless has not finished. Carelessness describes what somebody did, not why the work allowed it to matter — and a finding that ends there produces no change that would stop the next person doing the same thing.",
          },
        ],
      },
      {
        heading: "Corrective Actions and Closing Out",
        blocks: [
          {
            type: "paragraph",
            text: `Each corrective action is written down with a named owner and a date it is due. The ${role} keeps the list of open actions and reviews it at least monthly.`,
          },
          {
            type: "paragraph",
            text: "An action is closed out only when somebody has confirmed it was actually done, and that confirmation is recorded against it with a date. An action marked complete without that check is not closed out.",
          },
          {
            type: "paragraph",
            text: "Where a corrective action changes how work is carried out, the crews affected are told what has changed and why, and the change is reflected in the Company's written programs and in how it plans the job.",
          },
        ],
      },
    ];

    if (hostSites) {
      sections.push({
        heading: "Incidents Involving a Client or Host Employer",
        blocks: [
          {
            type: "paragraph",
            text: `On a site run by somebody else, the host employer usually runs their own investigation, and ${company} cooperates with it fully — providing the facts it has gathered, making its people available, and sharing its own findings.`,
          },
          {
            type: "paragraph",
            text: `The Company's own investigation is carried out regardless of whether the host runs one. A host employer's report belongs to them, covers their site, and may not be shared; it does not replace the record ${company} keeps of what happened to its own crew.`,
          },
          {
            type: "paragraph",
            text: "Where the incident involved a hazard created by another party on the site, or by the condition of the site itself, that is stated in the Company's record and raised with the client contact rather than left as an internal finding.",
          },
        ],
      });
    }

    if (postIncidentTesting) {
      sections.push({
        heading: "Post-Incident Testing",
        blocks: [
          {
            type: "paragraph",
            text: `Certain client contracts require drug or alcohol testing following an incident. Where the contract for a job requires it, ${company} arranges testing on the terms that contract sets out, and the arrangement for that job is confirmed with the client before work begins rather than worked out after an incident.`,
          },
          {
            type: "paragraph",
            text: "Testing is never used as a response to somebody having made a report. Nobody is tested because they reported an incident, and no employee is discouraged from reporting by the prospect of a test.",
          },
          {
            type: "paragraph",
            text: "Getting medical treatment to an injured person always comes first, and is never delayed for a test.",
          },
        ],
      });
    }

    if (oshaLog) {
      sections.push({
        heading: "Injury and Illness Records",
        blocks: [
          {
            type: "paragraph",
            text: `${company} keeps an OSHA 300 log. The ${role} reviews each incident record against it and enters the incident on the log where it belongs there, so that the two are not maintained independently of one another.`,
          },
          {
            type: "paragraph",
            text: "An incident record is completed for every incident whether or not it goes on the log. The two serve different purposes: one is how the Company learns from what happened, the other is a record of injuries and illnesses of a particular kind.",
          },
        ],
      });
    }

    sections.push(
      {
        heading: "Trends",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} reviews the incident records together at least annually, and looks at them as a set rather than one at a time. The same near miss reported by three different crews is a pattern that none of the three records shows on its own.`,
          },
          {
            type: "paragraph",
            text: "What that review finds is acted on in the same way as any other finding: a change, an owner, a date, and a check that it was done.",
          },
        ],
      },
      {
        heading: "Instruction in This Program",
        blocks: [
          {
            type: "paragraph",
            text: `${company} goes through this program with an employee before they are first assigned work, and again when it changes. What an employee is expected to take from it is short: what counts as an incident, who they tell, and how quickly.`,
          },
          {
            type: "paragraph",
            text: `Supervisors are additionally taken through what they do at the scene, what goes on the record, and how an investigation is carried out. The ${role} records who was taken through the program, and on what date.`,
          },
        ],
      },
      {
        heading: "Availability of This Program",
        blocks: [
          {
            type: "paragraph",
            text: "This program is kept in writing and is available to any employee, or their designated representative, on request.",
          },
        ],
      },
      {
        heading: "Review and Revision",
        blocks: [
          {
            type: "paragraph",
            text: `The ${role} reviews this program at least annually, whenever the work of ${company} changes in a way that affects it, and after any incident that showed something in it did not work.`,
          },
          {
            type: "paragraph",
            text: "The revision date and version number on the cover of this document record when it was last reviewed.",
          },
        ],
      },
    );

    return sections;
  },
};
