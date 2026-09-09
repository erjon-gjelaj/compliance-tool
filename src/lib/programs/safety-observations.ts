import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Safety Observations.
 *
 * ## Why it is not called behavior-based safety
 *
 * The catalog calls this "Behavior-Based Safety / Observations", and clients
 * ask for it under that name. The program is titled from the config like
 * every other, but the content deliberately does not adopt the framing.
 *
 * Behavior-based safety as commonly practiced counts unsafe acts by workers,
 * and its predictable failure is that it locates every problem in the person
 * nearest the sharp end. A crew that learns observations produce findings
 * about them stops behaving normally while anybody is watching, and the
 * program then measures nothing at all — while producing a healthy-looking
 * number of observations.
 *
 * So this is written as observation of the *work*: what makes the safe way
 * harder than it should be. That is the version that produces findings a
 * company can act on, and it is also the version that keeps working after the
 * first month.
 *
 * ## The two rules that decide whether it survives
 *
 * Nothing is recorded against a name, and no target is set for the count.
 * Either failure converts it into a quota exercise within weeks — and a quota
 * for observations produces observations, not information.
 */

const Q = {
  responsible: "responsible_role",
  whoObserves: "who_observes",
  frequency: "observation_frequency",
  anonymous: "anonymous_records",
  feedback: "feedback_route",
  records: "records_location",
} as const;

const WHO: Record<string, string> = {
  supervisors:
    "Supervisors carry out observations, on crews other than their own where that is possible. Watching your own crew makes it hard to separate what you are seeing from what you already believe about them.",
  everyone:
    "Anybody may carry out an observation, including crew members observing each other. The most useful ones usually come from somebody doing the same work, who can see why a shortcut is tempting.",
  peer_pairs:
    "Observations are done in pairs, one person from the crew and one from outside it. The person from the crew sees why something is done the way it is; the person from outside sees what has become normal.",
};

export const SAFETY_OBSERVATIONS: ProgramTemplate = {
  id: "bbs",
  title: "Safety Observations",
  shortName: "Safety Observations",
  requirementId: "safety-observations",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^(behaviou?r[- ]based safety( ?\/ ?observations)?|safety observations?|observation program)( program)?$/i.test(
      label.trim(),
    ),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.whoObserves,
      prompt: "Who does the observing?",
      kind: "choice",
      required: true,
      options: [
        { id: "supervisors", label: "Supervisors" },
        { id: "everyone", label: "Anyone, including crew members" },
        { id: "peer_pairs", label: "In pairs — one from the crew, one from outside" },
      ],
    },
    {
      id: Q.frequency,
      prompt: "How often?",
      help: "A few done properly beats a quota done to hit a number.",
      kind: "choice",
      required: true,
      options: [
        { id: "weekly", label: "About one a week" },
        { id: "monthly", label: "About one a month" },
        { id: "per_job", label: "At least one on every job of any length" },
      ],
    },
    {
      id: Q.anonymous,
      prompt: "Are names recorded?",
      help: "Recording names is the fastest way to make the program worthless.",
      kind: "choice",
      required: true,
      options: [
        { id: "no_names", label: "No — the work is recorded, not the person" },
        { id: "names_for_positive", label: "Only where somebody is being credited" },
      ],
    },
    {
      id: Q.feedback,
      prompt: "Does the crew hear back about what was found?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are observation records kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const feedback = answers[Q.feedback] === "yes";
    const namesForPositive = answers[Q.anonymous] === "names_for_positive";
    const records = (answers[Q.records] ?? "").trim();

    const frequency =
      answers[Q.frequency] === "weekly"
        ? "About one observation a week is carried out."
        : answers[Q.frequency] === "per_job"
          ? "At least one observation is carried out on every job that runs longer than a day."
          : "About one observation a month is carried out.";

    const body: Section[] = [
      {
        heading: "What Is Being Observed",
        blocks: [
          {
            type: "paragraph",
            text: "The work, not the worker.",
          },
          {
            type: "paragraph",
            text: "An observation asks what makes the safe way of doing this job harder than it should be. Where is the equipment relative to where it is needed. Does the plan match how the work actually goes. Is the protective equipment the right choice for this task or the one that was in the truck. Is there time to do it the way the plan describes.",
          },
          {
            type: "paragraph",
            text: `Where somebody is seen doing something unsafe, the question this program asks is why that was the easier option. People are consistent and sensible; when a crew is routinely doing something the plan does not describe, it is usually because the plan is wrong, the equipment is inconvenient, or the schedule does not allow for it.`,
          },
          {
            type: "paragraph",
            text: `Anything immediately dangerous is stopped and corrected on the spot, under the Company's stop work authority. An observation is never a reason to watch something unsafe continue.`,
          },
        ],
      },
      {
        heading: "How One Is Done",
        blocks: [
          { type: "paragraph", text: WHO[answers[Q.whoObserves]] },
          { type: "paragraph", text: frequency },
          {
            type: "numbered",
            items: [
              "Tell the crew what you are doing before you start. Watching people without saying so produces resentment and teaches them to perform.",
              "Watch the work for long enough to see it, rather than glancing at it.",
              "Talk to the crew. Ask how the job is going, what is getting in the way, and what they would change. This is where the useful information comes from — not from the watching.",
              "Note what is working as well as what is not. A crew who only ever hear findings stop offering anything.",
              "Agree what happens next, with the crew rather than about them.",
            ],
          },
          {
            type: "paragraph",
            text: "An observation is a conversation with a note taken, not an inspection with a clipboard. The difference is visible to the crew within about thirty seconds and determines everything they say afterwards.",
          },
        ],
      },
      {
        heading: "What Is Not Recorded",
        blocks: [
          {
            type: "paragraph",
            text: namesForPositive
              ? "Names are recorded only where somebody is being credited for something. Nothing that could be read as a finding is recorded against a name."
              : "No names are recorded. Not the crew's, not the individual's — the record describes the work and what was found about it.",
          },
          {
            type: "paragraph",
            text: "This is the rule the whole program depends on. A crew who learn that observations produce findings about individuals will behave differently while anybody is watching, and the program will then measure nothing while producing a healthy number of observations.",
          },
          {
            type: "paragraph",
            text: `Nothing from an observation is used as the basis for disciplining anybody. Where something genuinely serious is seen, it is dealt with under the Company's accountability program on its own terms — not through this one.`,
          },
        ],
      },
      {
        heading: "No Targets",
        blocks: [
          {
            type: "paragraph",
            text: `No target is set for the number of observations, and nobody's performance is measured by how many they have done.`,
          },
          {
            type: "paragraph",
            text: "A quota produces observations. It does not produce information: what it produces is somebody filling in forms on the last Friday of the month about work they half-remember, which is worse than having no program at all because it looks like having one.",
          },
          {
            type: "paragraph",
            text: "Equally, no target is set for the proportion that should come out favorably. A number of that kind is an instruction about what to write down.",
          },
        ],
      },
    ];

    if (feedback) {
      body.push({
        heading: "Telling the Crew What Happened",
        blocks: [
          {
            type: "paragraph",
            text: "What came out of an observation goes back to the crew who were observed, and to the wider workforce where it applies to them.",
          },
          {
            type: "paragraph",
            text: "Where a crew raised something and it was changed, they are told it was changed. Where it was not, they are told why. A crew who raise something twice and hear nothing either time will not raise a third.",
          },
          {
            type: "paragraph",
            text: `This is the part that most often does not happen, and it is the part that decides whether anybody engages with the next observation.`,
          },
        ],
      });
    }

    body.push({
      heading: "What the Records Are For",
      blocks: [
        {
          type: "paragraph",
          text: `Records are kept at: ${records}. Each one notes the work observed, the date, what was found, what the crew said, and what was agreed.`,
        },
        {
          type: "paragraph",
          text: `The ${role} reads them together rather than one at a time. A single observation says little; the same obstacle appearing across several is a finding about how the Company plans, equips or schedules its work, and that is the thing worth acting on.`,
        },
        {
          type: "paragraph",
          text: "Anything agreed has somebody's name against it and a date, and is followed up. An observation program that generates agreements nobody closes teaches the crew that the conversation was the point.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company looks at how its work is actually done, what it asks the crews doing it, and what it does with what it learns.",
      policy: `It is the policy of ${company} that observations look at the work rather than the worker, that nothing found in one is recorded against a name or used to discipline anybody, and that no target is set for how many are done.`,
      body,
      trainingPoints: [
        "That observations are about the work, not about you",
        "That nothing found in one is recorded against your name or used against you",
        "That the useful part is what you say about what gets in the way, not the watching",
        "That anything immediately dangerous is stopped there and then rather than observed",
        feedback
          ? "That you will hear back about what you raised, including when nothing changed and why"
          : "Who to ask about what came of something you raised",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through observing work rather than people, asking what makes the safe way harder, and closing out what was agreed — since an observation that produces an unclosed agreement teaches a crew the exercise was the point.",
      reviewTrigger:
        "The review asks whether observations have become routine paperwork, since a program that has quietly turned into a quota looks identical in the records to one that is working.",
    });
  },
};
