import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Return to Work and Fitness for Duty.
 *
 * ## The program with an incentive problem written into it
 *
 * Bringing somebody back on light duties genuinely helps them — people who
 * stay connected to work recover better and return to full duties sooner. It
 * also, incidentally, keeps a case off the lost-time count.
 *
 * Those two things point the same way most of the time and in opposite
 * directions occasionally, and the occasion is the one that matters: an
 * employee brought back before they should be, doing work that does not
 * exist, so a number stays low. That is the failure this program is written
 * to prevent, and a document that does not acknowledge the incentive is not
 * credible to anybody who has seen it happen.
 *
 * ## What the medical provider decides, and what the Company decides
 *
 * The provider decides what somebody can do. The Company decides whether it
 * has work matching that. Those are separate decisions and the program keeps
 * them separate — a supervisor who negotiates restrictions with a doctor is
 * doing something this document forbids.
 *
 * ## What it will not do
 *
 * Say anything about workers' compensation entitlements, benefits, or the
 * law. Those vary by state and are not this document's business.
 */

const Q = {
  responsible: "responsible_role",
  lightDuty: "light_duty_available",
  whoDecides: "restriction_source",
  fitness: "fitness_checks",
  contact: "contact_during",
  records: "records_location",
} as const;

export const RETURN_TO_WORK: ProgramTemplate = {
  id: "return_to_work",
  title: "Return to Work and Fitness for Duty",
  shortName: "Return to Work",
  requirementId: "return-to-work",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(return to work( ?\/ ?fitness for duty)?|fitness for duty|modified duty)( program| policy)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.lightDuty,
      prompt: "Do you have work someone on restrictions could actually do?",
      help: "An honest no is better than inventing a job.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.whoDecides,
      prompt: "Who sets the restrictions?",
      kind: "choice",
      required: true,
      options: [
        { id: "treating_provider", label: "The treating provider, in writing" },
        { id: "occupational_health", label: "Our occupational health provider" },
      ],
    },
    {
      id: Q.fitness,
      prompt: "Do you check fitness for duty in situations other than injury?",
      help: "Returning after a long illness, or after an absence from this kind of work.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.contact,
      prompt: "Does someone stay in touch while an employee is off?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are these records kept?",
      help: "They are confidential medical records.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const lightDuty = answers[Q.lightDuty] === "yes";
    const fitness = answers[Q.fitness] === "yes";
    const contact = answers[Q.contact] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const provider =
      answers[Q.whoDecides] === "occupational_health"
        ? "The Company's occupational health provider establishes what the employee can and cannot do, in writing, after seeing the treating provider's information."
        : "The treating provider establishes what the employee can and cannot do, in writing. The Company works from that document rather than from a conversation about it.";

    const body: Section[] = [
      {
        heading: "What This Program Is For",
        blocks: [
          {
            type: "paragraph",
            text: `Somebody who has been injured or has been ill recovers better when they stay connected to work, and returns to full duties sooner. That is why ${company} would rather find suitable work than have somebody sit at home.`,
          },
          {
            type: "paragraph",
            text: "It is worth naming the other reason a company might want that, because it exists: bringing somebody back keeps a case off the lost-time count. Most of the time those two motives point the same way. Occasionally they do not, and this program is written for that occasion.",
          },
          {
            type: "paragraph",
            text: `No employee of ${company} is brought back before a medical provider says they can be, and no employee is placed on work that does not match their restrictions. Not to protect a number, not to satisfy a client, and not because a job is short-handed.`,
          },
        ],
      },
      {
        heading: "Who Decides What",
        blocks: [
          { type: "paragraph", text: provider },
          {
            type: "paragraph",
            text: "That document says what the person can do. It is not negotiated, and nobody from the Company asks a provider to reconsider restrictions because they are inconvenient. A supervisor who does that is in breach of this program.",
          },
          {
            type: "paragraph",
            text: `What the Company decides is separate: whether it has work matching those restrictions. The ${role} makes that decision, not the supervisor whose crew is short.`,
          },
          {
            type: "paragraph",
            text: "The Company receives the restrictions and the provider's opinion on fitness for work. It does not receive, ask for, or hold a diagnosis.",
          },
        ],
      },
    ];

    if (lightDuty) {
      body.push({
        heading: "Modified Work",
        blocks: [
          {
            type: "paragraph",
            text: `Where ${company} has work that fits the restrictions, it is offered. The work is real work the Company needs done — not a job invented to have somewhere to put somebody.`,
          },
          {
            type: "paragraph",
            text: "An invented job is obvious to the person doing it and to everybody around them. It is demoralizing, it teaches the crew what the Company actually cares about, and it is usually the version that comes with pressure to do a bit more than the restrictions allow.",
          },
          {
            type: "paragraph",
            text: "Before modified work starts, the following are written down and given to the employee:",
          },
          {
            type: "bullets",
            items: [
              "What the work is, and what it does not include",
              "The restrictions as the provider wrote them",
              "Who their supervisor is for this work",
              "How long the arrangement is expected to last, and when it will be looked at again",
              "That they stop and say so if the work turns out to exceed what they can do",
            ],
          },
          {
            type: "paragraph",
            text: "The supervisor is told the restrictions — what the person cannot do — and nothing about the underlying condition. That is all they need and all they are entitled to.",
          },
          {
            type: "paragraph",
            text: "Where the person says the work exceeds their restrictions, it stops immediately and goes back to the provider. Their account of what they can manage is not weighed against the schedule.",
          },
        ],
      });
    } else {
      body.push({
        heading: "Where There Is No Suitable Work",
        blocks: [
          {
            type: "paragraph",
            text: `${company} does not always have work matching a set of restrictions. Where it does not, that is said plainly rather than solved by finding somebody something to do.`,
          },
          {
            type: "paragraph",
            text: "Inventing a job to have somewhere to put somebody is worse than being honest about it. It is obvious to the person doing it, and it is usually the version that comes with quiet pressure to exceed the restrictions.",
          },
          {
            type: "paragraph",
            text: `The ${role} looks at what the Company genuinely has each time rather than assuming the answer is the same as last time, and tells the employee either way.`,
          },
        ],
      });
    }

    body.push({
      heading: "Coming Back to Full Duties",
      blocks: [
        {
          type: "paragraph",
          text: "An employee returns to their normal work when the provider releases them without restriction, in writing. Feeling better is not the test, and neither is a job needing them.",
        },
        {
          type: "paragraph",
          text: "On the day they return, their supervisor goes through the work with them before they start — particularly where the injury involved the task they are returning to. Somebody coming back to the job that hurt them deserves the plan looked at again rather than handed back.",
        },
        {
          type: "paragraph",
          text: "Where an employee has been away long enough that the work, the equipment or the site has changed, they are brought up to date before being assigned, and the Company's short service arrangements apply where the absence was long.",
        },
      ],
    });

    if (fitness) {
      body.push({
        heading: "Fitness for Duty More Generally",
        blocks: [
          {
            type: "paragraph",
            text: "The same approach applies outside injury: after a long illness, after surgery, after an absence long enough that fitness for physically demanding work is a real question, and where a supervisor has a genuine concern about somebody's ability to do their job safely.",
          },
          {
            type: "paragraph",
            text: `A concern of that kind goes to the ${role} rather than being acted on by the supervisor. It is based on what somebody can be seen doing at work — not on rumor, not on what they were doing at the weekend, and not on their age.`,
          },
          {
            type: "paragraph",
            text: "Where an assessment is arranged, the Company pays for it, the employee is told why it is being arranged before it happens, and the Company receives an opinion on fitness for the work rather than a medical report.",
          },
          {
            type: "paragraph",
            text: "An employee may raise their own fitness at any time without it counting against them. Somebody who says they should not be doing a task today has done exactly what the Company wants them to do.",
          },
        ],
      });
    }

    if (contact) {
      body.push({
        heading: "While Somebody Is Off",
        blocks: [
          {
            type: "paragraph",
            text: `Somebody from ${company} stays in touch with an employee who is off — to see how they are, to answer questions, and so that returning is not a cold start. Being forgotten about is its own harm, and people who feel forgotten come back later.`,
          },
          {
            type: "paragraph",
            text: "That contact is not a check-up and does not press for a return date. Nobody asks for a diagnosis, and nobody is asked to justify how long they are taking.",
          },
        ],
      });
    }

    body.push({
      heading: "Confidentiality",
      blocks: [
        {
          type: "paragraph",
          text: `Records under this program are confidential medical records. They are kept at: ${records}, apart from ordinary personnel files, and are seen only by those whose role requires them.`,
        },
        {
          type: "paragraph",
          text: "A supervisor is told the restrictions and nothing else. Crews are told nothing at all — not to explain an absence, and not to explain why somebody is doing different work.",
        },
        {
          type: "paragraph",
          text: "Nothing about an individual's health, restrictions or absence is shared with a hiring client. A client may be told that the Company has a program and that it was followed.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company handles somebody returning to work after an injury or illness: who decides what they can do, what work is offered, and what is kept confidential.",
      policy: `It is the policy of ${company} that nobody returns before a medical provider says they can, that nobody is placed on work exceeding their restrictions to keep a number low, and that restrictions are never negotiated with a provider.`,
      body,
      trainingPoints: [
        "That the Company would rather find suitable work than have you sit at home, and why",
        "That restrictions come from a provider in writing and are never argued with",
        "That your supervisor is told what you cannot do, and nothing about why",
        lightDuty
          ? "That you stop and say so if modified work turns out to exceed your restrictions"
          : "That the Company will say honestly when it has no work matching your restrictions",
        "That you may raise your own fitness for a task at any time, and it will not count against you",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through working to written restrictions without adjusting them, never contacting a provider to have them reconsidered, and raising a fitness concern rather than acting on one.",
      reviewTrigger:
        "The review asks whether anybody was brought back onto work that did not really exist, since that is the failure this program is written to prevent and it does not announce itself.",
    });
  },
};
