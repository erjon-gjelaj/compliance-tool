import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Bloodborne Pathogens.
 *
 * ## Why a construction subcontractor needs one at all
 *
 * Most contractors assume this program is for hospitals. Prequalification
 * platforms ask for it because of one specific situation: somebody on the
 * crew is cut, and a workmate helps them. That is an exposure, it happens on
 * industrial sites regularly, and the person who helped is the one at risk.
 *
 * So the document is built around first aid given by colleagues, not around
 * healthcare. It says what to do in the ten minutes after contact, and it
 * says the part that decides the outcome: the medical evaluation is
 * time-sensitive, and somebody who cleans up and mentions it two days later
 * has lost the option.
 *
 * ## What it will not do
 *
 * Name a disease-specific risk, a treatment, a drug, a window in hours, or a
 * test. Those are medical decisions about a particular exposure, they change,
 * and this project does not write them. The program says get to a provider
 * immediately, which is what a contractor's document should say.
 */

const Q = {
  responsible: "responsible_role",
  designated: "designated_responders",
  kits: "kit_locations",
  vaccination: "vaccination_offered",
  cleanup: "cleanup_route",
  records: "records_location",
} as const;

const CLEANUP: Record<string, string> = {
  trained_crew:
    "Cleaning up blood or other potentially infectious material is done only by employees who have been prepared for it, wearing gloves and eye protection, using absorbent material and an appropriate disinfectant, and placing everything used into a sealed, marked bag for disposal.",
  outside_service:
    "Cleaning up blood or other potentially infectious material beyond a very small spill is done by a specialist service. Employees isolate the area and keep people away until it arrives.",
  site_service:
    "Cleaning up blood or other potentially infectious material is done by the site's own arrangements. Employees isolate the area, tell site control immediately, and keep people away until it is dealt with.",
};

export const BLOODBORNE_PATHOGENS: ProgramTemplate = {
  id: "bloodborne",
  title: "Bloodborne Pathogens",
  shortName: "Bloodborne Pathogens",
  requirementId: "bloodborne-pathogens",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^bloodborne pathogens?( program| exposure control plan)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.designated,
      prompt: "Does anyone have first aid as an assigned duty?",
      help: "Not just people who happen to help — somebody whose job includes it.",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.vaccination,
      prompt: "Do you offer hepatitis B vaccination to those people?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.cleanup,
      prompt: "Who cleans up after someone is injured?",
      kind: "choice",
      required: true,
      options: [
        { id: "trained_crew", label: "Our own people, prepared for it" },
        { id: "outside_service", label: "A specialist service" },
        { id: "site_service", label: "The site's arrangements" },
      ],
    },
    {
      id: Q.kits,
      prompt: "Where are first aid kits and gloves kept?",
      help: "For example: every truck and the site office.",
      kind: "text",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are exposure records kept?",
      help: "These are confidential medical records.",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const designated = answers[Q.designated] === "yes";
    const vaccination = answers[Q.vaccination] === "yes";
    const kits = (answers[Q.kits] ?? "").trim();
    const records = (answers[Q.records] ?? "").trim();

    const body: Section[] = [
      {
        heading: "Where the Risk Actually Is",
        blocks: [
          {
            type: "paragraph",
            text: `${company} does not do healthcare work. The exposure this program exists for is the ordinary one on an industrial site: somebody is cut, and a workmate helps them before anybody official arrives.`,
          },
          {
            type: "paragraph",
            text: "The person who helped is the one at risk. Blood on broken skin, in an eye, in the mouth, or from a sharp that went through a glove is an exposure, and it happens on job sites often enough to plan for.",
          },
          {
            type: "paragraph",
            text: "The other situations covered are handling sharps found on site — needles in demolition, in vacant buildings, in waste — and cleaning up after an injury.",
          },
        ],
      },
      {
        heading: "Treat All Blood as Infectious",
        blocks: [
          {
            type: "paragraph",
            text: "Nobody at this Company judges whether a particular person's blood is a risk. All blood and other potentially infectious material is treated the same way, every time.",
          },
          {
            type: "paragraph",
            text: "That rule exists for two reasons. Somebody can carry an infection without knowing it themselves, so asking would not establish anything. And a practice that depends on judging people would be applied wrongly and unfairly, which is worse than useless.",
          },
        ],
      },
      {
        heading: "Helping Somebody Who Is Bleeding",
        blocks: [
          {
            type: "numbered",
            items: [
              "Put gloves on before touching the injured person. Gloves are in every kit and this is what they are there for.",
              "Where blood could spray or splash — a serious wound, a bleed under pressure — protect the eyes and face as well.",
              "Where possible, have the injured person apply pressure themselves. Somebody who can do it is the safest person to.",
              "Get medical help for the injury.",
              "Remove gloves without touching the outside of them, put them straight into a sealed bag, and wash hands thoroughly with soap and water afterwards even though gloves were worn.",
            ],
          },
          {
            type: "paragraph",
            text: "Nobody is expected to withhold help while looking for gloves in a genuine emergency. What the Company does instead is keep gloves close enough that this is rarely the choice.",
          },
          {
            type: "paragraph",
            text: `Gloves and first aid supplies are kept at: ${kits}. Supervisors check them as part of preparing for a job, and a kit without gloves is not a kit.`,
          },
        ],
      },
      {
        heading: "If Somebody Is Exposed",
        blocks: [
          {
            type: "paragraph",
            text: "An exposure means blood or other potentially infectious material reached broken skin, an eye, the nose, the mouth, or went under the skin through a cut or a sharp.",
          },
          {
            type: "numbered",
            items: [
              "Wash the area immediately with soap and water. For an eye, nose or mouth, flush with clean water for several minutes.",
              "Tell the supervisor straight away. Not at the end of the shift.",
              `The supervisor notifies the ${role} and arranges for the person to be seen by a medical provider immediately.`,
              "The person goes to the provider that day. This is the step that matters, and the reason is below.",
              "Record what happened: when, where, what the person was doing, how the exposure occurred, and what protective equipment was in use.",
            ],
          },
          {
            type: "paragraph",
            text: "Going immediately is not a formality. What a provider can offer after this kind of exposure is time-sensitive, and somebody who cleans up, finishes the shift and mentions it two days later may have lost an option that was open to them that afternoon.",
          },
          {
            type: "paragraph",
            text: `Nobody at ${company} is discouraged from reporting an exposure, and nobody is treated as having made a fuss. An exposure that goes unreported is the only version of this with a bad outcome.`,
          },
          {
            type: "paragraph",
            text: "The evaluation, and any follow-up the provider recommends, is arranged and paid for by the Company. Cost is never a reason somebody does not go.",
          },
        ],
      },
      {
        heading: "Cleaning Up",
        blocks: [
          { type: "paragraph", text: CLEANUP[answers[Q.cleanup]] },
          {
            type: "paragraph",
            text: "Nobody picks up broken glass, metal or any other contaminated sharp by hand, even wearing gloves. Tongs, a brush and pan, or a tool are used, and the item goes into a puncture-resistant container.",
          },
          {
            type: "paragraph",
            text: "Anything contaminated and disposable — dressings, wipes, gloves, absorbent material — goes into a sealed bag that is marked so that whoever handles it next knows what is in it. It does not go into general waste loose.",
          },
        ],
      },
      {
        heading: "Sharps Found on Site",
        blocks: [
          {
            type: "paragraph",
            text: "Needles and other sharps turn up in demolition, in vacant buildings, in insulation and in waste. Nobody picks one up by hand.",
          },
          {
            type: "paragraph",
            text: "Work stops in that area, the supervisor is told, and the item is placed into a puncture-resistant container using a tool — or, where the site has its own arrangements, left for them and the area kept clear.",
          },
          {
            type: "paragraph",
            text: "Anybody stuck by a sharp follows the exposure steps above immediately, whatever the sharp appeared to be.",
          },
        ],
      },
    ];

    if (designated) {
      body.push({
        heading: "People With First Aid as a Duty",
        blocks: [
          {
            type: "paragraph",
            text: `Certain employees of ${company} have first aid assigned to them as part of their job, rather than helping because they were nearest. Who they are is recorded for each job.`,
          },
          {
            type: "paragraph",
            text: "They are prepared for it before taking the role: what the risk is, how it is transmitted, what protective equipment to use and when, how to handle contaminated material, and what to do if they are exposed themselves.",
          },
          {
            type: "paragraph",
            text: vaccination
              ? "Hepatitis B vaccination is offered to them, at the Company's expense, before they take the role on. Nobody is required to accept it; somebody who declines signs a record that it was offered, and may change their mind and accept it later at any time without having to explain why."
              : `The ${role} arranges the medical provision these employees require in connection with the role, and the Company pays for it.`,
          },
          {
            type: "paragraph",
            text: "Nothing here stops anybody else helping an injured colleague. Everybody at this Company is expected to help; these employees are the ones who have been prepared and equipped to.",
          },
        ],
      });
    }

    body.push({
      heading: "Confidentiality",
      blocks: [
        {
          type: "paragraph",
          text: `Records of an exposure and anything arising from it are confidential medical records. They are kept at: ${records}, apart from ordinary personnel files, and are seen only by those whose role requires it.`,
        },
        {
          type: "paragraph",
          text: "Nothing about an individual's exposure, evaluation, vaccination status or test results is shared with a hiring client, with a crew, or with anybody who does not need it. Not to explain an absence, and not to explain a change of duties.",
        },
        {
          type: "paragraph",
          text: "The provider's written opinion on fitness for work is what the Company receives. Diagnoses and test results are between the employee and their provider.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "what employees do when somebody is bleeding, what happens if blood reaches somebody who is helping, and how anything contaminated is cleaned up and disposed of.",
      policy: `It is the policy of ${company} that all blood is treated as infectious, that gloves are close enough to the work that reaching for them is not a choice, and that anybody exposed sees a medical provider the same day.`,
      scopeNote:
        "It covers first aid given to a colleague, handling sharps found on site, and cleaning up after an injury — not healthcare work, which the Company does not perform.",
      body,
      trainingPoints: [
        "That all blood is treated as infectious, and why nobody judges by the person",
        "To put gloves on before helping somebody who is bleeding, and where they are kept",
        "What counts as an exposure — broken skin, eyes, nose, mouth, or a sharp",
        "To wash immediately, tell the supervisor straight away, and see a provider the same day",
        "That going immediately matters because what a provider can offer is time-sensitive",
        "Never to pick up a sharp by hand",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through arranging the medical evaluation the same day rather than the next, checking that kits hold gloves before a job, and recording the circumstances of an exposure while they are fresh.",
      reviewTrigger:
        "The review checks that kits at every location still hold gloves and eye protection, which is the part that quietly runs out.",
    });
  },
};
