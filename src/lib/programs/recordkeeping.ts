import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Injury and Illness Recordkeeping.
 *
 * ## The most dangerous program in the library to generate
 *
 * Every other program describes what a company does. This one sits next to a
 * body of rules about which injuries go on a log, which employers are partly
 * exempt, and which events are reportable on a clock — and getting any of
 * that wrong in a document a contractor relies on is the worst outcome this
 * product can produce. It would be wrong in a way that looks authoritative,
 * and they would find out when a regulator did.
 *
 * So this program deliberately does not decide anything. It says who is
 * responsible for making each determination, when they make it, what they
 * check it against, and what gets written down — and it says plainly, in the
 * document itself, that it is not a substitute for the current rules or for
 * advice on a particular case.
 *
 * That is not a hedge. It is the honest shape of the thing: a recordkeeping
 * *procedure* is genuinely about who decides and when, and any contractor
 * whose program instead contains a summary of the rules is carrying a summary
 * that will go stale without telling them.
 *
 * ## What is deliberately absent
 *
 * No numeric reporting deadlines, no list of recordable injury types, no
 * exemption table, and no citation. Each of those would be a claim about the
 * law written by hand — exactly what the project's regulatory rules forbid —
 * and each of them changes.
 */

const Q = {
  responsible: "responsible_role",
  decider: "who_decides",
  where: "log_location",
  posting: "annual_posting",
  privacy: "privacy_cases",
  medical: "medical_provider",
} as const;

export const RECORDKEEPING: ProgramTemplate = {
  id: "recordkeeping",
  title: "Injury and Illness Recordkeeping",
  shortName: "Recordkeeping",
  requirementId: "osha-logs",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(injury ?(and|&) ?illness recordkeeping|osha (300 ?\/ ?300a )?logs?( for the required years)?|recordkeeping)$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.decider,
      prompt: "Who decides whether an injury goes on the log?",
      help: "One named role. This is the question reviewers ask.",
      kind: "choice",
      required: true,
      options: [
        { id: "responsible", label: "Whoever looks after safety" },
        { id: "owner", label: "The owner" },
        { id: "office_manager", label: "The office manager" },
      ],
    },
    {
      id: Q.medical,
      prompt: "Do you use a regular clinic or occupational health provider?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.privacy,
      prompt: "Do you have a way to keep certain cases off the visible log?",
      help: "Some injuries are not supposed to be listed by name.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.posting,
      prompt: "Do you post the annual summary where the crew can see it?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.where,
      prompt: "Where are the logs kept?",
      help: "For example: the office filing cabinet, or a folder on the office computer.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const posting = answers[Q.posting] === "yes";
    const privacy = answers[Q.privacy] === "yes";
    const medical = answers[Q.medical] === "yes";
    const where = (answers[Q.where] ?? "").trim();

    const decider =
      answers[Q.decider] === "owner"
        ? "The Owner"
        : answers[Q.decider] === "office_manager"
          ? "The office manager"
          : `The ${role}`;

    const body: Section[] = [
      {
        heading: "What This Program Does and Does Not Do",
        blocks: [
          {
            type: "paragraph",
            text: `This program sets out who at ${company} decides what, and by when, about recording work-related injuries and illnesses. It is a procedure rather than a summary of the recordkeeping rules.`,
          },
          {
            type: "paragraph",
            text: "It deliberately does not restate which injuries are recordable, which employers are partly exempt, or the time limits that apply to reporting a serious event. Those come from the current rules, they change, and a copy of them sitting inside a company document goes out of date without announcing it.",
          },
          {
            type: "paragraph",
            text: `Each determination is made case by case, against the current requirements at the time, by the person named below. Where the answer is not clear, ${company} asks rather than guesses — of the treating provider, of its insurer, or of OSHA directly.`,
          },
        ],
      },
      {
        heading: "Who Decides",
        blocks: [
          {
            type: "paragraph",
            text: `${decider} is responsible for the Company's injury and illness records: for deciding whether a case is work-related, whether it is recordable, and how it is entered.`,
          },
          {
            type: "paragraph",
            text: "One named person decides, rather than whoever happens to be in the office. Consistency is most of what makes a log defensible, and a decision made by a different person each time is not consistent even when each one is right.",
          },
          {
            type: "paragraph",
            text: `Where ${decider.toLowerCase()} is unavailable, the Owner makes the determination and records that they did.`,
          },
        ],
      },
      {
        heading: "How a Case Reaches the Log",
        blocks: [
          {
            type: "numbered",
            items: [
              "An employee reports the injury or illness under the Company's incident reporting program. Every case enters through that door, including ones that look minor.",
              `The supervisor notifies ${decider.toLowerCase()} the same day.`,
              medical
                ? "Where the employee is seen by the Company's occupational health provider or clinic, the treatment given is obtained from them in writing rather than from the employee's description of it."
                : "Where the employee is treated, what treatment was actually given is obtained in writing rather than from anybody's description of it.",
              `${decider} decides whether the case is work-related and whether it is recordable, against the requirements current at that time.`,
              "The determination is recorded with the reason for it, so that a later question about why a case was or was not entered can be answered.",
              "Where the case is recordable, it is entered on the log within the time the current rules allow.",
            ],
          },
          {
            type: "paragraph",
            text: "A case that is reported but not entered is still recorded internally, with the reason. A log with nothing behind it cannot be explained a year later.",
          },
        ],
      },
      {
        heading: "Serious Events",
        blocks: [
          {
            type: "paragraph",
            text: `Where somebody has died, has been admitted to hospital as an in-patient, has lost a limb or part of one, or has lost an eye, ${decider.toLowerCase()} is told immediately and the Owner is told immediately.`,
          },
          {
            type: "paragraph",
            text: `${company} reports such an event to OSHA on the same day it learns of it, and confirms at that point what OSHA currently requires of the report and by when. The Company treats same-day as its own standard, which is at least as prompt as any deadline that applies.`,
          },
          {
            type: "paragraph",
            text: "Reporting to OSHA does not wait on the internal investigation, and the investigation does not wait on the report. Both start at once.",
          },
        ],
      },
      {
        heading: "What Is Kept, and Where",
        blocks: [
          {
            type: "paragraph",
            text: `Injury and illness records are kept at: ${where}.`,
          },
          {
            type: "paragraph",
            text: "The Company keeps, for each year: the log itself, the individual case records behind it, the annual summary, and the internal record of determinations — including for the cases that were not entered.",
          },
          {
            type: "paragraph",
            text: `Records are retained for as long as the current rules require, and ${role} confirms that period rather than assuming it. Records are not discarded while any question about them is open.`,
          },
        ],
      },
    ];

    if (privacy) {
      body.push({
        heading: "Cases That Are Not Listed by Name",
        blocks: [
          {
            type: "paragraph",
            text: "Certain kinds of case are entered on the log without the employee's name, and a separate confidential list connects the case number to the person. Which kinds those are is set by the current rules rather than by this program.",
          },
          {
            type: "paragraph",
            text: `The confidential list is kept apart from the log itself and is seen only by ${decider.toLowerCase()} and the Owner.`,
          },
          {
            type: "paragraph",
            text: "Where a copy of the log is given to anybody who is not entitled to the names — including a hiring client — the names are removed first.",
          },
        ],
      });
    }

    if (posting) {
      body.push({
        heading: "The Annual Summary",
        blocks: [
          {
            type: "paragraph",
            text: `At the start of each year ${decider.toLowerCase()} prepares the summary for the year just ended, and the Owner certifies it personally after examining the log it came from. Certification is a statement that somebody looked, not a signature collected on the way past.`,
          },
          {
            type: "paragraph",
            text: "The summary is posted where employees can see it, in a place notices are normally posted, for the period the current rules require. It is not taken down early because the space is wanted.",
          },
          {
            type: "paragraph",
            text: "The summary is posted even in a year with nothing on the log. A blank summary tells employees the Company kept the records and had nothing to enter, which is information; an absent one tells them nothing.",
          },
        ],
      });
    }

    body.push({
      heading: "Employee Access",
      blocks: [
        {
          type: "paragraph",
          text: "An employee, a former employee, or their designated representative may ask for a copy of the log for any year the Company holds, and the Company provides it. Anybody asking is not required to say why.",
        },
        {
          type: "paragraph",
          text: "An employee may see their own individual case record in full. Nobody is treated differently for asking for any of this.",
        },
      ],
    });

    body.push({
      heading: "Recording Is Not Fault",
      blocks: [
        {
          type: "paragraph",
          text: "Entering a case on the log is not an admission that the Company did anything wrong, and it is not a finding against the employee. It records that something happened.",
        },
        {
          type: "paragraph",
          text: `Nobody at ${company} is discouraged from reporting an injury, asked to seek treatment that would keep a case off the log, or given any incentive that depends on the log staying short. An employee who is treated that way raises it with the Owner directly, and it is investigated.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "who decides what, and by when, about recording the Company's work-related injuries and illnesses, and where those records are kept.",
      policy: `It is the policy of ${company} that its injury and illness records are accurate, that one named person is responsible for them, and that nobody is ever discouraged from reporting an injury in order to keep a log short.`,
      body,
      trainingPoints: [
        "That every injury and illness is reported, including ones that look minor",
        "Who decides whether a case goes on the log, and that it is not the person's supervisor",
        "That being recorded is not a finding against anybody",
        "That an employee may ask for the log, or for their own case record, without saying why",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through notifying the responsible person the same day, and on the fact that they do not make the recording decision themselves.",
      reviewTrigger:
        "The review also checks that the current requirements have not changed, since this program deliberately relies on them rather than restating them.",
    });
  },
};
