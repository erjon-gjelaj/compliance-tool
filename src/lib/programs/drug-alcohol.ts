import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Drug and Alcohol Policy.
 *
 * ## Why this one is written more cautiously than the rest
 *
 * Everything else in the library is a safety procedure. This is an employment
 * policy, and employment policy is where a generated document can do a
 * contractor real legal harm: testing rules vary by state, several states
 * restrict what an employer may do about lawful off-duty conduct, marijuana
 * law differs from federal law in most of the country, and safety-sensitive
 * transport roles sit under an entirely separate federal regime.
 *
 * A template that picked a position on any of that would be writing law for
 * fifty jurisdictions from one file. So this document states the Company's
 * safety commitment — which is the part that is genuinely the Company's to
 * decide and the part a hiring client is asking about — and refers the
 * mechanics of testing to the Company's counsel, its clients' contracts, and
 * the law where the work is done.
 *
 * ## The one substantive thing it does say
 *
 * That impairment is dealt with by removing somebody from safety-sensitive
 * work, immediately, without waiting for a test result — because a test takes
 * days and a person operating a lift does not. That is a safety decision
 * rather than a legal one, and it is the sentence a reviewer is looking for.
 *
 * ## What it will not do
 *
 * Name a substance, a cut-off level, a panel, a testing method, or a
 * consequence expressed as a legal entitlement. It also does not claim the
 * policy complies with anything — that is for the customer's counsel to say,
 * and a generated document saying it would be worthless and misleading at
 * once.
 */

const Q = {
  responsible: "responsible_role",
  scope: "when_tested",
  clientRules: "client_rules",
  dot: "dot_covered",
  selfReport: "self_report",
  prescription: "prescription",
} as const;

const SCOPE_SENTENCE: Record<string, string> = {
  client_only:
    "The Company does not run a testing program of its own. Where a client's contract requires testing, the Company arranges it on the terms that contract sets out, and confirms those terms before the work is accepted rather than after an incident.",
  company_program:
    "The Company operates its own testing program. What it covers, when it applies, and how it is carried out are set out in the Company's separate testing procedure, which is reviewed with counsel and follows the law of the state where the work is performed.",
  post_incident_only:
    "The Company's testing is limited to circumstances following an incident, and is arranged on the terms of the applicable client contract and the law of the state where the work is performed. The Company's separate testing procedure sets out the detail.",
};

export const DRUG_ALCOHOL: ProgramTemplate = {
  id: "drug_alcohol",
  title: "Drug and Alcohol Policy",
  shortName: "Drug and Alcohol",
  requirementId: "drug-and-alcohol",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^drug ?(and|&) ?alcohol( policy)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.scope,
      prompt: "How does testing work at your company?",
      help: "We describe the arrangement rather than write the testing rules — those depend on your state and your contracts.",
      kind: "choice",
      required: true,
      options: [
        { id: "client_only", label: "Only when a client's contract requires it" },
        { id: "company_program", label: "We run our own testing program" },
        { id: "post_incident_only", label: "After an incident only" },
      ],
    },
    {
      id: Q.dot,
      prompt: "Does anyone hold a commercial driver's licence for the company?",
      help: "Those roles sit under a separate federal regime, so the policy says so.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.prescription,
      prompt: "Do you ask people to tell you about medication that could affect their work?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.selfReport,
      prompt: "Can someone come forward about a problem without being fired for it?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.clientRules,
      prompt: "Do client sites impose their own rules on this?",
      kind: "boolean",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const dot = answers[Q.dot] === "yes";
    const prescription = answers[Q.prescription] === "yes";
    const selfReport = answers[Q.selfReport] === "yes";
    const clientRules = answers[Q.clientRules] === "yes";

    const body: Section[] = [
      {
        heading: "The Commitment",
        blocks: [
          {
            type: "paragraph",
            text: `${company} performs work where being impaired puts the person doing it, and everybody near them, in danger. Nobody performs work for the Company while impaired by alcohol, by a drug, or by anything else that affects their ability to do the job safely.`,
          },
          {
            type: "paragraph",
            text: "That commitment covers alcohol and illegal drugs, and it covers lawful substances and prescribed medication where the effect is the same. What matters here is whether somebody can do the work safely, not what caused it.",
          },
          {
            type: "paragraph",
            text: `Alcohol and illegal drugs are not brought onto, used at, or possessed at any location where ${company} is working, including the Company's own premises and its vehicles.`,
          },
        ],
      },
      {
        heading: "If Somebody Appears Unfit to Work",
        blocks: [
          {
            type: "paragraph",
            text: "This is the part of the policy that operates on the day, and it does not wait for anything.",
          },
          {
            type: "numbered",
            items: [
              "The supervisor removes the person from the task immediately. That is a safety step, not a finding, and it happens on a reasonable concern rather than on proof.",
              `The supervisor notifies the ${role}.`,
              "Arrangements are made for the person to get home safely. Nobody who may be impaired is allowed to drive themselves, and the Company arranges transport.",
              "What was observed is written down at the time — what the supervisor saw, heard and when — by the person who saw it, rather than reconstructed later.",
              "What happens next is decided afterwards, under this policy and the Company's accountability program, once the person is safe and the facts are known.",
            ],
          },
          {
            type: "paragraph",
            text: "A test result, where one applies, takes days. A person operating equipment does not. Removal from the task therefore never waits on a result, and is not treated as a punishment if the concern turns out to be unfounded.",
          },
        ],
      },
      {
        heading: "Testing",
        blocks: [
          { type: "paragraph", text: SCOPE_SENTENCE[answers[Q.scope]] },
          {
            type: "paragraph",
            text: "This document deliberately does not set out what is tested for, at what level, by what method, or with what consequence. Those depend on the law of the state where the work is done and on the contract for the job, both of which change and neither of which this policy is the right place to record.",
          },
          {
            type: "paragraph",
            text: `The ${role} confirms what applies to a particular job before the work is accepted, and the Company takes advice on its testing arrangements rather than deciding them from a template.`,
          },
          {
            type: "paragraph",
            text: "Nobody is tested because they reported an incident, raised a hazard or stopped work. Testing is never used as a response to somebody having spoken up.",
          },
        ],
      },
    ];

    if (dot) {
      body.push({
        heading: "Commercial Drivers",
        blocks: [
          {
            type: "paragraph",
            text: `Employees of ${company} who hold a commercial driver's license and perform safety-sensitive functions are subject to a separate federal regime, which sets its own requirements for testing and its own consequences.`,
          },
          {
            type: "paragraph",
            text: "Those requirements apply to those employees in addition to this policy, and where the two differ, the federal requirements govern for those roles. The Company maintains that program separately and does not treat this document as covering it.",
          },
        ],
      });
    }

    if (prescription) {
      body.push({
        heading: "Prescribed and Over-the-Counter Medication",
        blocks: [
          {
            type: "paragraph",
            text: "An employee who is taking anything — prescribed or bought over the counter — that could affect alertness, coordination, judgment or reaction time tells their supervisor before starting safety-sensitive work.",
          },
          {
            type: "paragraph",
            text: "They do not say what the medication is and are not asked. What the Company needs to know is whether there is a restriction on what they can safely do; the underlying condition is their business and, in most cases, information the Company should not hold.",
          },
          {
            type: "paragraph",
            text: "Where there is a restriction, the Company looks first at what other work is available rather than at sending somebody home. Telling the Company about medication is not grounds for discipline and does not by itself cost anybody work.",
          },
        ],
      });
    }

    if (selfReport) {
      body.push({
        heading: "Coming Forward",
        blocks: [
          {
            type: "paragraph",
            text: `An employee who has a problem with alcohol or drugs may come to the ${role} or the Owner about it before it becomes an incident, and doing so is not by itself grounds for dismissal.`,
          },
          {
            type: "paragraph",
            text: "The Company will discuss what support is available, what time off may be possible, and what work they can safely do meanwhile. What is said is kept confidential to the person they told and the Owner.",
          },
          {
            type: "paragraph",
            text: "This does not apply retrospectively to somebody who comes forward after being asked to test or after an incident. It exists so that the safest route out of a problem is not also the most expensive one.",
          },
        ],
      });
    }

    if (clientRules) {
      body.push({
        heading: "Client and Site Rules",
        blocks: [
          {
            type: "paragraph",
            text: "Client sites commonly impose their own requirements, and some require a specific arrangement before anybody is allowed on site. The supervisor establishes what a site requires before the crew is scheduled.",
          },
          {
            type: "paragraph",
            text: `Where a client's requirement is stricter than this policy, the client's requirement applies for that work. Where ${company} cannot meet it, the work is not accepted.`,
          },
        ],
      });
    }

    body.push({
      heading: "Confidentiality",
      blocks: [
        {
          type: "paragraph",
          text: "Anything arising under this policy — a concern raised, a test arranged, a result, a conversation about medication — is confidential. It is seen only by those whose role requires it, and it is kept apart from the employee's ordinary personnel file.",
        },
        {
          type: "paragraph",
          text: "Nothing about an individual is shared with a hiring client. A client may be told that the Company has a policy and that it was followed; they are not told about a person.",
        },
      ],
    });

    body.push({
      heading: "What This Document Is Not",
      blocks: [
        {
          type: "paragraph",
          text: "This is a statement of the Company's commitment and of what happens on the day somebody appears unfit to work. It is not legal advice, it does not set out the Company's rights or an employee's rights, and it does not claim to satisfy the requirements of any particular state or contract.",
        },
        {
          type: "paragraph",
          text: `The law on testing, on lawful off-duty conduct, and on medication differs between states and changes. ${company} takes advice on those questions and does not settle them from this document.`,
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "the Company's commitment that nobody performs work while impaired, and what happens when somebody appears unfit to do their job safely.",
      policy: `It is the policy of ${company} that nobody works impaired, and that somebody who appears unfit is taken off the task straight away and got home safely — before anything else is decided.`,
      body,
      trainingPoints: [
        "That nobody performs work for the Company while impaired, whatever the cause",
        "That a supervisor will remove somebody from a task on a concern, without waiting for proof",
        "That the Company arranges transport home and nobody drives themselves",
        prescription
          ? "That medication which could affect the work is mentioned beforehand, without saying what it is"
          : "Who to tell if something could affect their ability to work safely",
        "That nobody is tested because they reported something or stopped work",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through removing somebody from a task, arranging transport, and writing down what they observed at the time rather than afterwards.",
      reviewTrigger:
        "The review also covers whether the law of the states the Company works in has changed, since this policy defers to it rather than restating it.",
    });
  },
};
