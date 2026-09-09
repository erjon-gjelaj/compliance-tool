import type { ProgramTemplate, Section } from "@/lib/programs/types";
import {
  RESPONSIBLE_QUESTION,
  assembleWithSpine,
  responsibleRole,
} from "@/lib/programs/spine";

/**
 * Hearing Conservation.
 *
 * ## The injury nobody notices happening
 *
 * Noise-induced hearing loss is painless, gradual, and permanent. Nobody
 * leaves a shift knowing they lost something, and by the time somebody
 * notices they are asking people to repeat themselves, the loss is years old
 * and cannot be recovered.
 *
 * That shapes the program. Because the person cannot feel it, the protection
 * cannot depend on them judging their own exposure — which is why monitoring
 * and audiograms carry the weight here, and why the document says plainly
 * that "it doesn't seem that loud" is not an assessment.
 *
 * ## The audiogram is the point
 *
 * A hearing test is the only thing in this subject that tells a company
 * whether its controls are working. Protection selected on paper and worn
 * inconsistently produces exactly the same paperwork as protection that
 * works; the audiogram is what distinguishes them, and a shift in somebody's
 * hearing is a finding about the program rather than about the person.
 *
 * ## What it will not do
 *
 * State a decibel threshold, an exposure limit, an action level, or a
 * required attenuation rating. Those are set by the standard that applies and
 * differ between general industry and construction, and a number printed here
 * would be one this project invented — with the added harm that a crew below
 * it would read themselves as safe.
 */

const Q = {
  responsible: "responsible_role",
  noiseSources: "noise_sources",
  monitoring: "monitoring_route",
  protection: "protection_offered",
  audiograms: "audiogram_route",
  records: "records_location",
} as const;

const MONITORING: Record<string, string> = {
  we_measure:
    "The Company measures noise levels for its own tasks with a sound level meter or dosimeter, and repeats the measurement whenever the equipment, the method or the location changes.",
  site_data:
    "Where a client has measured the noise in the areas the Company works in, those measurements are obtained and used. Where none exist for the Company's own equipment, the Company arranges its own measurement rather than estimating.",
  specialist:
    "The Company engages a specialist to assess noise exposure for its tasks, and repeats the assessment whenever the equipment, the method or the location changes.",
};

export const HEARING_CONSERVATION: ProgramTemplate = {
  id: "hearing",
  title: "Hearing Conservation",
  shortName: "Hearing Conservation",
  requirementId: "hearing-conservation",

  release: "customer_available",
  templateVersion: "1.0.0",

  matchesLabel: (label) =>
    /^hearing (conservation|protection)( program)?$/i.test(label.trim()),

  questions: [
    RESPONSIBLE_QUESTION,
    {
      id: Q.noiseSources,
      prompt: "Where does the noise come from?",
      kind: "choice",
      required: true,
      options: [
        { id: "our_tools", label: "Our own tools and equipment" },
        { id: "site_plant", label: "The client's plant, mostly" },
        { id: "both", label: "Both" },
      ],
    },
    {
      id: Q.monitoring,
      prompt: "How do you know how loud it actually is?",
      help: "Judging by ear is the thing this program exists to replace.",
      kind: "choice",
      required: true,
      options: [
        { id: "we_measure", label: "We measure it ourselves" },
        { id: "site_data", label: "We use the client's measurements" },
        { id: "specialist", label: "A specialist assesses it" },
      ],
    },
    {
      id: Q.protection,
      prompt: "What hearing protection do you provide?",
      kind: "choice",
      required: true,
      options: [
        { id: "plugs_and_muffs", label: "Plugs and muffs, people choose" },
        { id: "plugs", label: "Disposable plugs" },
        { id: "fitted", label: "Fitted or molded plugs for regular users" },
      ],
    },
    {
      id: Q.audiograms,
      prompt: "Do people get hearing tests?",
      kind: "boolean",
      required: true,
    },
    {
      id: Q.records,
      prompt: "Where are noise measurements and test results kept?",
      kind: "text",
      required: true,
    },
  ],

  build(answers, context): Section[] {
    const company = context.companyName;
    const role = responsibleRole(answers);
    const audiograms = answers[Q.audiograms] === "yes";
    const records = (answers[Q.records] ?? "").trim();

    const protection =
      answers[Q.protection] === "plugs"
        ? "Disposable plugs are provided, in quantity, at every work location. Somebody who has run out has no protection, so supply is checked before the shift rather than when somebody asks."
        : answers[Q.protection] === "fitted"
          ? "Employees regularly working in noise are fitted with molded or custom plugs. Disposable plugs and muffs are also kept available for visitors, for occasional exposure, and for anybody whose fitted pair is not to hand."
          : "Both plugs and muffs are provided, and employees choose which they prefer. The choice matters more than it sounds: protection somebody finds uncomfortable comes out during the shift, and protection that is out is protection that is not working.";

    const body: Section[] = [
      {
        heading: "Why This One Is Different",
        blocks: [
          {
            type: "paragraph",
            text: "Hearing loss from noise does not hurt, does not happen on a particular day, and cannot be recovered once it has happened. Nobody finishes a shift aware they have lost something.",
          },
          {
            type: "paragraph",
            text: "So this program cannot rely on people judging their own exposure. \"It doesn't seem that loud\" is not an assessment, and by the time somebody notices they are asking people to repeat themselves, the loss is years old.",
          },
          {
            type: "paragraph",
            text: `A rough guide, and only a guide: if two people standing an arm's length apart have to raise their voices to be understood, the noise is worth measuring.`,
          },
        ],
      },
      {
        heading: "Finding Out How Loud It Is",
        blocks: [
          { type: "paragraph", text: MONITORING[answers[Q.monitoring]] },
          {
            type: "paragraph",
            text: "Measurement covers the noise employees are actually exposed to across a shift, including noise made by other trades working nearby. A quiet task next to somebody else's grinder is not a quiet task.",
          },
          {
            type: "paragraph",
            text: `Where the exposure reaches the level at which the applicable standard requires action, employees in that area are included in this program. The ${role} establishes what that level is for the work in question rather than assuming, since it is not the same for every kind of work.`,
          },
          {
            type: "paragraph",
            text: "Employees are told the results for their own work, and may see the measurements. Somebody who knows their own exposure wears protection more consistently than somebody who has been told to.",
          },
        ],
      },
      {
        heading: "Reducing the Noise Before Protecting the Ears",
        blocks: [
          {
            type: "paragraph",
            text: "Hearing protection is the last control, not the first. Before relying on it, the supervisor considers a quieter method or tool, maintaining equipment that has become louder as it wears, enclosing or shielding the source, moving people away from it, and scheduling noisy work when fewer people are nearby.",
          },
          {
            type: "paragraph",
            text: "Every one of those protects everybody in the area without depending on anyone wearing anything, which is why they come first.",
          },
          {
            type: "paragraph",
            text: "A tool that has become noticeably louder is usually a tool that needs maintenance, and is reported rather than tolerated.",
          },
        ],
      },
      {
        heading: "Hearing Protection",
        blocks: [
          { type: "paragraph", text: protection },
          {
            type: "paragraph",
            text: "Protection is selected to bring the exposure down enough for the noise present, and not so far that somebody cannot hear an alarm, a warning shout, or an approaching vehicle. Over-protection is a hazard of its own.",
          },
          {
            type: "paragraph",
            text: "Employees are shown how to insert plugs properly rather than handed them. A plug resting in the outer ear provides very little of its rating, and inserting one correctly is not obvious — most people who believe they are protected and are not, are wearing plugs they put in wrong.",
          },
          {
            type: "paragraph",
            text: "Protection is worn for the whole time somebody is in the noise. Taking it out for a few minutes in a loud area costs a large share of the protection for the entire shift, which is not intuitive and is worth saying out loud.",
          },
          {
            type: "paragraph",
            text: "Where somebody finds their protection uncomfortable, another type is tried. That is a supply problem to solve, not a discipline matter — and somebody who dislikes what they have been given will simply not wear it.",
          },
        ],
      },
    ];

    if (audiograms) {
      body.push({
        heading: "Hearing Tests",
        blocks: [
          {
            type: "paragraph",
            text: "Employees exposed to noise at or above the level requiring action have their hearing tested. A first test establishes their baseline, and later tests are compared against it.",
          },
          {
            type: "paragraph",
            text: "The baseline is taken after a period away from workplace noise, so that it records the person's hearing rather than temporary dullness from the last shift. Employees are told not to expose themselves to loud noise outside work before it either.",
          },
          {
            type: "paragraph",
            text: "Testing is repeated at the interval the applicable standard sets, and the results are compared to the baseline by the provider rather than filed unread. A test nobody compares is an expense rather than a control.",
          },
          {
            type: "paragraph",
            text: "Where a test shows a shift in somebody's hearing, that is treated as a finding about this program:",
          },
          {
            type: "numbered",
            items: [
              "The employee is told, promptly and in writing.",
              "They are re-tested to confirm it.",
              "Their protection is re-examined — fit, type, whether it is being worn for the whole exposure, and whether it is adequate for the actual noise.",
              "The noise itself is looked at again, and the controls reconsidered.",
              "Where the provider advises a medical referral, the Company arranges it.",
            ],
          },
          {
            type: "paragraph",
            text: "A shift is not treated as the employee's fault. It is evidence that something in the chain did not work, and the point of finding it early is that the remaining hearing can still be protected.",
          },
        ],
      });
    }

    body.push({
      heading: "Records",
      blocks: [
        {
          type: "paragraph",
          text: `Noise measurements, the areas and tasks they cover${audiograms ? ", hearing test results" : ""}, and what employees were told are kept at: ${records}.`,
        },
        {
          type: "paragraph",
          text: "Noise measurements are kept for as long as the applicable standard requires, and hearing records for the length of employment and beyond, because the value of a baseline is that it can be compared to a test taken many years later.",
        },
        {
          type: "paragraph",
          text: "An employee may see their own hearing records and the noise measurements for their work, at any time, and is given a copy when they leave.",
        },
      ],
    });

    return assembleWithSpine({
      company,
      role,
      purpose:
        "how the Company finds out how much noise its employees are exposed to, reduces it where it can, provides hearing protection for what remains, and checks whether any of that is working.",
      policy: `It is the policy of ${company} that noise is measured rather than judged by ear, reduced at the source wherever that is possible, and that hearing protection is the last control rather than the first.`,
      body,
      trainingPoints: [
        "That hearing loss from noise is painless, gradual and permanent",
        "That having to raise your voice at arm's length means the noise is worth measuring",
        "How to insert plugs properly — most people who think they are protected are not",
        "That taking protection out for a few minutes in loud noise costs most of the shift's protection",
        "To ask for a different type rather than go without one you find uncomfortable",
        audiograms
          ? "That a shift in your hearing test is acted on, and is not held against you"
          : "That you may see the noise measurements for your own work",
      ],
      supervisorTraining:
        "Supervisors are additionally taken through checking that protection is actually being worn and worn correctly, and on reporting equipment that has become louder rather than accepting it.",
      reviewTrigger:
        "The review looks at whether noise measurements still match the equipment and methods in use, since a change of tool can move an exposure without anybody noticing.",
    });
  },
};
