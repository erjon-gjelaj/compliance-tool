import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Stop Work Authority.
 *
 * ## A short document about one sentence
 *
 * Every safety program in this library mentions stop-work authority. Clients
 * ask for it as its own document because they want to see that the company
 * has thought about the part nobody writes down: what happens *after*
 * somebody stops a job.
 *
 * Granting the authority is easy and costs nothing. What decides whether it
 * is real is the twenty minutes afterwards — whether the person is asked what
 * they saw or told they have cost the crew a day, and whether the job
 * restarts because the hazard was dealt with or because somebody senior
 * overruled them. So most of this document is about that, not about the
 * grant.
 *
 * ## The unfounded stop is the load-bearing case
 *
 * A stop that turns out to be unnecessary is the one that decides whether
 * anybody stops again. If it is treated as a mistake, the program is over —
 * everybody learns to be sure first, and being sure takes long enough that
 * the moment passes. So the document says plainly that an unfounded stop is a
 * success, and it says why.
 *
 * ## Deliberately short
 *
 * A twelve-page document about one sentence would bury it.
 */

const Q = {
  responsible: "responsible_role",
  restartDecision: "restart_decision",
  disagreement: "disagreement_route",
  otherContractors: "other_contractors",
  recorded: "stops_recorded",
} as const;

export const STOP_WORK: ProgramTemplate = {
  id: "stop_work",
  title: "Stop Work Authority",
  shortName: "Stop Work Authority",
  requirementId: "stop-work-authority",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^stop work( authority| policy)?( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.restartDecision,
      prompt: "Who decides the job can restart?",
      kind: "choice",
      required: true,
      options: [
        { id: "mutual", label: "The supervisor and the person who stopped it, together" },
        { id: "supervisor", label: "The supervisor" },
        { id: "responsible", label: "Whoever looks after safety" },
      ],
    },
    {
      id: Q.disagreement,
      prompt: "What if they don't agree it's safe to restart?",
      help: "This is the question that decides whether the authority is real.",
      kind: "choice",
      required: true,
      options: [
        { id: "stays_stopped", label: "It stays stopped until the owner decides" },
        { id: "escalate_safety", label: "Whoever looks after safety decides" },
      ],
    },
    {
      id: Q.otherContractors,
      prompt: "Can your people stop work being done by someone else's crew?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.recorded,
      prompt: "Do you write down every stop, including the ones that turned out to be nothing?",
      kind: "boolean",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const others = answers[Q.otherContractors] === "yes";
    const recorded = answers[Q.recorded] === "yes";

    const restart =
      answers[Q.restartDecision] === "supervisor"
        ? "The supervisor for the job decides that the work may restart, after speaking with the person who stopped it and satisfying themselves that the concern has been dealt with."
        : answers[Q.restartDecision] === "responsible"
          ? `The ${role} decides that the work may restart, after speaking with the person who stopped it.`
          : "The supervisor and the person who stopped the work decide together that it may restart. The person who raised the concern is part of the decision rather than told the outcome of it.";

    const disagreement =
      answers[Q.disagreement] === "escalate_safety"
        ? `Where they do not agree, the ${role} decides, and the work stays stopped until they have. Nobody senior overrules a stop on the spot.`
        : "Where they do not agree, the work stays stopped and the Owner decides. Nobody overrules a stop on the spot, whatever their position, and no exception is made because the job is nearly finished.";

    const body: Section[] = [
      {
        heading: "The Authority",
        blocks: [
          {
            type: "paragraph",
            text: `Any employee of ${company} may stop any work they believe is unsafe. At any time, on any site, without asking permission first and without needing to explain themselves before the work stops.`,
          },
          {
            type: "paragraph",
            text: "It applies from somebody's first shift. It does not depend on seniority, on trade, on having been with the Company a while, or on being certain.",
          },
          {
            type: "paragraph",
            text: "It covers their own work, work being done by their crew, and anything they can see that puts somebody at risk.",
          },
        ],
      },
      {
        heading: "How Somebody Stops Work",
        blocks: [
          {
            type: "numbered",
            items: [
              "Say so, clearly and out loud, to the people doing the work. Any words that get the point across are the right words.",
              "Make the situation safe as far as that can be done without adding risk — stand people back, isolate, secure a load.",
              "Tell the supervisor for that job.",
              "Say what was seen, plainly. Not a justification, just what it was.",
            ],
          },
          {
            type: "paragraph",
            text: "Nobody has to be certain before stopping. A concern is enough, and working out whether it was well founded is what happens next rather than a condition of stopping.",
          },
        ],
      },
      {
        heading: "What Happens Next",
        blocks: [
          {
            type: "paragraph",
            text: "This is the part that decides whether the authority is real, and the Company treats it as the substance of this program rather than a procedure attached to it.",
          },
          {
            type: "paragraph",
            text: "The supervisor comes to the work, listens to what the person saw, and looks at it themselves. They do not ask why the person stopped rather than mentioning it, and they do not open by saying what the delay costs.",
          },
          {
            type: "paragraph",
            text: "The concern is then either dealt with — a control added, the method changed, the job re-planned — or established to be something other than what it appeared. Both are legitimate outcomes.",
          },
          { type: "paragraph", text: restart },
          { type: "paragraph", text: disagreement },
        ],
      },
      {
        heading: "When It Turns Out to Be Nothing",
        blocks: [
          {
            type: "paragraph",
            text: "Sometimes the work was fine. That is a good outcome, not a mistake, and it is treated as one every time.",
          },
          {
            type: "paragraph",
            text: `Somebody who stops work in good faith is thanked for it, whatever the finding. Nobody at ${company} is questioned, criticized, teased, given a worse job, moved off a crew, or paid less because they stopped work.`,
          },
          {
            type: "paragraph",
            text: "The reason this is stated so plainly is that the alternative destroys the program in a single conversation. If an unfounded stop is treated as an error, everybody learns to be sure before speaking — and being sure takes long enough that the moment passes. A company that only ever gets well-founded stops is not getting all of them.",
          },
          {
            type: "paragraph",
            text: `An employee who feels they were treated badly for stopping work raises it with the Owner directly. That is investigated as a breach of this program, and the person who discouraged them is the one answering for it.`,
          },
        ],
      },
    ];

    if (others) {
      body.push({
        heading: "Work Being Done by Somebody Else",
        blocks: [
          {
            type: "paragraph",
            text: `An employee of ${company} who sees another contractor's crew, or a client's own people, doing something they believe is unsafe says so — to those doing the work if that is quicker, and to their own supervisor either way.`,
          },
          {
            type: "paragraph",
            text: "The Company has no authority over another employer's work, and this is not a claim to any. What its employees do have is a duty to say something, and the Company backs them when they do.",
          },
          {
            type: "paragraph",
            text: `The supervisor raises it with site control or the host employer's contact straight away. Where the Company's own people are at risk from it, they are moved out of the way and ${company} stops its own work in that area until it is resolved.`,
          },
          {
            type: "paragraph",
            text: "Nobody is told to keep quiet about another employer's work to preserve a relationship with a client.",
          },
        ],
      });
    }

    if (recorded) {
      body.push({
        heading: "Writing It Down",
        blocks: [
          {
            type: "paragraph",
            text: "Every stop is recorded — what the work was, what the concern was, what was found, what changed, and when the job restarted. The unfounded ones are recorded exactly as fully as the rest.",
          },
          {
            type: "paragraph",
            text: `The ${role} reads them together rather than one at a time. The same concern appearing across several jobs is telling the Company something no single stop does, and it is the cheapest information the business produces about how its work is actually planned.`,
          },
          {
            type: "paragraph",
            text: "The record names what was seen rather than who was at fault. A record that reads as an accusation makes the next person think twice about giving one.",
          },
          {
            type: "paragraph",
            text: "No target is set for the number of stops, in either direction. A target for more produces stops that are not real; a target for fewer is an instruction to stay quiet.",
          },
        ],
      });
    }

    return assembleWithSpine({
      company,
      role,
      purpose:
        "the authority every employee has to stop work they believe is unsafe, what happens once they have, and how the Company treats a stop that turns out to have been unnecessary.",
      policy: `It is the policy of ${company} that anybody may stop work over a safety concern without permission and without penalty, and that a stop which turns out to be unfounded is a success rather than a mistake.`,
      scopeNote:
        "It applies from an employee's first shift, whatever their trade, seniority or time with the Company.",
      body,
      trainingPoints: [
        "That you may stop any work you believe is unsafe, from your first shift, without asking",
        "That you do not have to be certain — a concern is enough",
        "How to stop work: say so out loud, make it safe, tell the supervisor, say what you saw",
        "That nobody will be annoyed with you if it turns out to be nothing",
        "Who to go to if you are ever made to feel otherwise",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through how to respond to a stop — going to the work, listening first, and never opening with what the delay costs — and on the fact that a stop is not overruled on the spot by anybody.",
      reviewTrigger:
        "The review asks whether stops have become rare, since a company whose crews have stopped stopping is not a company whose work got safer.",
    });
  },
};
