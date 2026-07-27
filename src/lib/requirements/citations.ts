/**
 * Candidate CFR citations, and the words that must actually turn up in the
 * regulation before one is used.
 *
 * Nothing here is a claim. Every entry is a *proposal* to be checked against
 * the eCFR API by scripts/verify-citations.mts, and only what comes back
 * verified reaches src/lib/requirements/verified-citations.json, which is the
 * file the application reads. A section that does not exist, or whose real
 * heading does not contain the expected words, is dropped rather than shown.
 *
 * That ordering is the whole point of this module. Regulatory citations are
 * exactly the kind of thing that is easy to state confidently and wrongly, and
 * a wrong CFR number in an email to a contractor is worse than no number at
 * all — it is checkable, and it will be checked. So the number is never
 * asserted from memory: it is retrieved, and what gets displayed is the
 * heading the government publishes, not a description written here.
 *
 * ## What a citation means, and does not
 *
 * A verified citation says: this is the OSHA standard covering this subject.
 * It does NOT say the contractor is required to hold a particular document,
 * and the email must not imply that it does. Applicability turns on the work,
 * the industry and the site — 1910 is general industry, 1926 is construction,
 * and which applies is not something this software can determine. The value
 * here is giving someone the real reference to take to their safety adviser
 * or their hiring client, not telling them what the law requires of them.
 *
 * ## Requirements deliberately left without a citation
 *
 * Four of the twelve carry none, because no single OSHA standard requires the
 * document a prequalification platform is asking for:
 *
 *   written-safety-program   no standard mandates a "safety manual" as such
 *   drug-and-alcohol         a client contract term, not an OSHA requirement
 *   insurance-certificate    a commercial requirement, nothing to do with OSHA
 *   training-records         training duties are spread across many standards
 *                            rather than one that could be cited honestly
 *
 * Leaving these empty is the point of the exercise, not a gap in it. They stay
 * contractual, and the email keeps saying so.
 */

export type CitationCandidate = {
  /** Matches an id in REQUIREMENTS. */
  requirement: string;
  /** CFR title. 29 is Labor, which is where OSHA lives. */
  title: number;
  part: string;
  section: string;
  /**
   * Lower-case words that must appear in the retrieved subpart description or
   * section heading. The guard against a plausible-looking wrong number: a
   * section that exists but is about something else fails this and is dropped.
   *
   * Needed because some headings are useless alone — 1910.132 is titled
   * "General requirements", and only its subpart says it is about personal
   * protective equipment.
   */
  expect: string[];
};

export const CITATION_CANDIDATES: readonly CitationCandidate[] = [
  {
    requirement: "hazard-communication",
    title: 29,
    part: "1910",
    section: "1910.1200",
    expect: ["hazard communication"],
  },
  {
    requirement: "lockout-tagout",
    title: 29,
    part: "1910",
    section: "1910.147",
    expect: ["hazardous energy"],
  },
  {
    requirement: "confined-space",
    title: 29,
    part: "1910",
    section: "1910.146",
    expect: ["confined space"],
  },
  {
    // Construction has its own confined space rules, and a scaffolding or
    // welding subcontractor on a plant turnaround is far more likely to be
    // working to these than to the general industry ones.
    requirement: "confined-space",
    title: 29,
    part: "1926",
    section: "1926.1203",
    expect: ["confined space"],
  },
  {
    requirement: "fall-protection",
    title: 29,
    part: "1910",
    section: "1910.28",
    expect: ["fall protection"],
  },
  {
    requirement: "fall-protection",
    title: 29,
    part: "1926",
    section: "1926.501",
    expect: ["fall protection"],
  },
  {
    requirement: "respiratory-protection",
    title: 29,
    part: "1910",
    section: "1910.134",
    expect: ["respiratory protection"],
  },
  {
    requirement: "ppe",
    title: 29,
    part: "1910",
    section: "1910.132",
    expect: ["personal protective equipment"],
  },
  {
    requirement: "ppe",
    title: 29,
    part: "1926",
    section: "1926.95",
    expect: ["personal protective equipment"],
  },
  {
    requirement: "emergency-action-plan",
    title: 29,
    part: "1910",
    section: "1910.38",
    expect: ["emergency action plan"],
  },
  {
    requirement: "osha-logs",
    title: 29,
    part: "1904",
    section: "1904.4",
    expect: ["recording criteria"],
  },
  {
    requirement: "osha-logs",
    title: 29,
    part: "1904",
    section: "1904.32",
    expect: ["annual summary"],
  },
];
