import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Management of Change.
 *
 * ## What a subcontractor's version of this actually is
 *
 * Management of change comes from process industries, where it governs
 * changes to plant and chemistry. A scaffolding or welding contractor is not
 * running a process unit, and a document written as though they were is one
 * they will never use.
 *
 * Their version is the change that happens at ten in the morning: the method
 * changed, the equipment is different, half the crew was swapped, the
 * sequence moved. Those are exactly the conditions under which the job plan
 * stops describing the work — and the incident reports say that is when
 * people get hurt.
 *
 * So this is written as the discipline of noticing a change and re-planning
 * for it, not as a formal engineering process. That is both more honest and
 * more useful, and it is still recognizably management of change to a
 * reviewer.
 *
 * ## The load-bearing idea
 *
 * A change that seems small is the dangerous one. Nobody skips re-planning a
 * change they think is significant; what gets waved through is the
 * substitution that looked equivalent — a different anchor point, a
 * substitute chemical, one person swapped for another.
 */

const Q = {
  responsible: "responsible_role",
  approver: "who_approves",
  temporary: "temporary_changes",
  personnel: "crew_changes",
  client: "client_driven",
  records: "records_location",
} as const;

export const MANAGEMENT_OF_CHANGE: ProgramTemplate = {
  id: "moc",
  title: "Management of Change",
  shortName: "Management of Change",
  requirementId: "management-of-change",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^management of change( \(moc\))?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.approver,
      prompt: "Who approves a change to how a job is being done?",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisor", label: "The supervisor for the job" },
        { id: "responsible", label: "Whoever looks after safety" },
        { id: "supervisor_then_responsible", label: "The supervisor for small ones, otherwise safety" },
      ],
    },
    {
      id: Q.temporary,
      prompt: "Do temporary fixes ever stay in place longer than intended?",
      help: "An honest yes gets you a section that deals with it.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.personnel,
      prompt: "Do you treat a change of crew as a change?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.client,
      prompt: "Do clients change the scope mid-job?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are change records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const temporary = answers[Q.temporary] === "yes";
    const personnel = answers[Q.personnel] === "yes";
    const client = answers[Q.client] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const approver =
      answers[Q.approver] === "responsible"
        ? `The ${role} approves any change to how a job is being done, before the changed work starts.`
        : answers[Q.approver] === "supervisor"
          ? `The supervisor for the job approves a change, before the changed work starts, and tells the ${role} where the change affects how the Company works generally rather than only this job.`
          : `The supervisor for the job approves a change where it stays within the hazards already assessed. Anything that introduces a hazard the plan did not cover goes to the ${role} first, however small it looks.`;

    const body: Section[] = [
      {
        heading: "What This Means Here",
        blocks: [
          {
            type: "paragraph",
            text: `Management of change comes from process plants, where it governs changes to equipment and chemistry. ${company} is not running a process unit, and this program is written for the change that actually happens on its jobs.`,
          },
          {
            type: "paragraph",
            text: "That is the change at ten in the morning: the method turns out not to work, the equipment on the truck is not the equipment that was planned for, half the crew got moved to another job, the sequence changed because another trade is late.",
          },
          {
            type: "paragraph",
            text: "The job was planned for what was expected. Once any of that changes, the plan describes work nobody is doing — and that is when people are hurt.",
          },
        ],
      },
      {
        heading: "What Counts as a Change",
        blocks: [
          {
            type: "paragraph",
            text: "Anything that makes the work different from what was planned:",
          },
          {
            type: "bullets",
            items: [
              "A different method, or the same steps in a different order",
              "Different equipment, tools, or materials — including a substitute that looks equivalent",
              "A different chemical or product, whatever the label says it replaces",
              "A change of crew, including somebody joining part-way through",
              "A different location, or the same work in a different part of the site",
              "Conditions changing — weather, light, temperature, another trade starting nearby",
              "Something found that was not expected: a live line, damage, a space not as drawn",
              "A change to scope or schedule that compresses how the work will be done",
            ],
          },
          {
            type: "paragraph",
            text: "A change that seems small is the one to watch. Nobody skips re-planning something they think is significant. What gets waved through is the substitution that looked equivalent, and \"it is basically the same\" is the sentence that precedes most of these incidents.",
          },
        ],
      },
      {
        heading: "What Happens When Something Changes",
        blocks: [
          {
            type: "numbered",
            items: [
              "Work stops. Not at the end of the task — at the point the change is noticed.",
              "The supervisor and the crew look at the job plan against what is now actually happening.",
              "They establish what the change brings with it: a hazard the plan did not cover, a control that no longer works, protective equipment that is now the wrong choice, a permit that no longer describes the work.",
              "The plan is changed, or the work is done a different way, or it waits until it can be done as planned.",
              "Everybody working on it is told what changed, including anybody arriving later in the shift.",
              "It is written down.",
            ],
          },
          { type: "paragraph", text: approver },
          {
            type: "paragraph",
            text: "Where the work is under a permit — hot work, confined space, energized work — the permit is reviewed and reissued rather than annotated. A permit describing the morning's work does not cover the afternoon's.",
          },
          {
            type: "paragraph",
            text: `Stopping to re-plan takes minutes and can be done standing in the same place. What it may not be is skipped because the crew are most of the way through.`,
          },
        ],
      },
    ];

    if (personnel) {
      body.push({
        heading: "A Change of Crew Is a Change",
        blocks: [
          {
            type: "paragraph",
            text: "Somebody joining a job part-way through has not been through the plan, has not heard what has already gone wrong, and does not know what the crew has agreed among themselves.",
          },
          {
            type: "paragraph",
            text: "So they are taken through the job plan and anything that has changed since it was written, before they start — not told to watch what everybody else is doing.",
          },
          {
            type: "paragraph",
            text: "Where somebody with a particular role leaves the job — a permit holder, an attendant, a fire watch, a mentor to a short service employee — that role is reassigned by name before the work continues. A role that quietly becomes nobody's is how an attendant ends up being whoever happens to be nearest.",
          },
        ],
      });
    }

    if (temporary) {
      body.push({
        heading: "Temporary Arrangements",
        blocks: [
          {
            type: "paragraph",
            text: "Some changes are meant to last a shift and last a month. A temporary support, a bypassed alarm, a hose run across a walkway, a guard left off for one task.",
          },
          {
            type: "paragraph",
            text: "So a temporary arrangement is recorded with an end date at the point it is put in, and the record says who is responsible for removing it. Something with no end date on it will not be removed.",
          },
          {
            type: "paragraph",
            text: `The ${role} reviews the temporary arrangements in place at least monthly. Anything past its date is either removed or reconsidered as a permanent change — and a permanent change gets planned as one rather than inherited.`,
          },
          {
            type: "paragraph",
            text: "Where a temporary arrangement is on a client's site, they are told when it goes in and when it comes out, and it is not left behind when the Company leaves.",
          },
        ],
      });
    }

    if (client) {
      body.push({
        heading: "Changes the Client Makes",
        blocks: [
          {
            type: "paragraph",
            text: "A client adding to the scope, moving the work, or compressing the schedule is a change, and it is treated as one even though it arrives as an instruction rather than a decision.",
          },
          {
            type: "paragraph",
            text: `The supervisor establishes what the change means for how the work will actually be done before agreeing to it, rather than agreeing and working it out afterwards. Where it cannot be done safely as asked, the ${role} is told and the Company says so to the client.`,
          },
          {
            type: "paragraph",
            text: "A schedule change is a change to the work. Compressing a job so that it has to be done in parallel rather than in sequence alters the hazards, and it is re-planned rather than absorbed.",
          },
        ],
      });
    }

    body.push({
      heading: "Writing It Down",
      blocks: [
        {
          type: "paragraph",
          text: `A short record is made for each change: what the job was, what changed, why, what it meant for the hazards and controls, who approved it, and who was told. Records are kept at: ${records}.`,
        },
        {
          type: "paragraph",
          text: "It is deliberately short. A form long enough to be a nuisance is a form crews learn to fill in after the fact, and a record written afterwards records what people wish had happened.",
        },
        {
          type: "paragraph",
          text: `The ${role} reads them together. The same change appearing across several jobs usually means the Company's planning is consistently missing something, which is a finding worth having and one no single record shows.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "what employees do when a job turns out differently from the way it was planned: what counts as a change, who approves one, and what is recorded.",
      policy: `It is the policy of ${company} that work stops when it stops matching the plan, and that a change which looks small is re-planned exactly as carefully as one that looks significant.`,
      body,
      trainingPoints: [
        "That a plan which no longer matches the job is stopped rather than followed",
        "What counts as a change — including a substitute that looks equivalent",
        "That \"it's basically the same\" is the sentence that precedes most of these incidents",
        "That a permit is reissued rather than annotated when the work changes",
        personnel
          ? "That somebody joining part-way through is taken through the plan before they start"
          : "To tell whoever joins the job part-way through what has already changed",
        temporary
          ? "That a temporary arrangement gets an end date and a name against it"
          : "To raise anything left in place longer than it was meant to be",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through recognizing a change that looks equivalent, reissuing rather than annotating permits, and reassigning a named role when the person holding it leaves the job.",
      reviewTrigger:
        temporary
          ? "The review also lists the temporary arrangements still in place, since that list is the one that grows quietly."
          : "The review reads the change records together, since a change recurring across jobs is a planning finding rather than a series of surprises.",
    });
  },
};
