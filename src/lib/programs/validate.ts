import type {
  Answers,
  Block,
  CompanyContext,
  ProgramTemplate,
  Section,
} from "@/lib/programs/types";

/**
 * The gate between an assembled document and a file a customer downloads.
 *
 * Everything here is a refusal to produce, not a warning printed into the
 * output. The rule this enforces is that a finished document contains no
 * evidence of how it was made: no "[Insert name]", no "TBD", no empty section,
 * no leftover template variable. A contractor forwards this to a hiring
 * client, and a bracket in the middle of it is worse than not having sent
 * anything.
 *
 * So a document that fails validation is not generated. There is no mode in
 * which a flawed one is emitted with a caveat attached.
 */

export type ValidationProblem = { code: string; detail: string };

export type ValidationOutcome =
  | { ok: true }
  | { ok: false; problems: ValidationProblem[] };

/**
 * Text that must never reach a customer.
 *
 * Two families. The first is placeholder syntax — anything that looks like a
 * variable that did not get substituted. The second is authoring shorthand
 * that reads as unfinished: TBD, "describe procedure", and so on.
 *
 * Matched case-insensitively and on word boundaries where the term is an
 * ordinary word, so a chemical called "TBD-40" or a sentence containing
 * "described" does not trip it.
 */
const FORBIDDEN: { pattern: RegExp; code: string }[] = [
  { pattern: /\{\{[^}]*\}\}/, code: "unresolved_variable" },
  { pattern: /\[[A-Za-z][^\]]*\]/, code: "unresolved_placeholder" },
  { pattern: /\$\{[^}]*\}/, code: "unresolved_template_literal" },
  { pattern: /\bTBD\b/i, code: "placeholder_text" },
  { pattern: /\bto be determined\b/i, code: "placeholder_text" },
  { pattern: /\bdescribe (?:your|the) [a-z ]*here\b/i, code: "placeholder_text" },
  { pattern: /\binsert (?:name|company|date|text)\b/i, code: "placeholder_text" },
  { pattern: /\bconfirmation required\b/i, code: "placeholder_text" },
  { pattern: /\breplace this\b/i, code: "placeholder_text" },
  { pattern: /\bundefined\b/, code: "undefined_value" },
  { pattern: /\bnull\b/, code: "null_value" },
  { pattern: /\bNaN\b/, code: "nan_value" },
];

function textOf(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
      return [block.text];
    case "bullets":
    case "numbered":
      return block.items;
    case "table":
      return [...block.head, ...block.rows.flat()];
  }
}

/** Every question that should have been asked, given the answers so far. */
export function visibleQuestions(
  template: ProgramTemplate,
  answers: Answers,
  context: CompanyContext,
) {
  return template.questions.filter((question) => {
    if (question.showWhen && !question.showWhen(answers)) return false;
    // A question the profile already answers is never shown, so it is not
    // outstanding either.
    if (question.prefill?.(context)) return false;
    return true;
  });
}

/** The next question with no answer, or null when the set is complete. */
export function nextUnanswered(
  template: ProgramTemplate,
  answers: Answers,
  context: CompanyContext,
) {
  return (
    visibleQuestions(template, answers, context).find(
      (question) => question.required && !answers[question.id]?.trim(),
    ) ?? null
  );
}

/**
 * Checks the answers, before anything is built.
 *
 * This has to run first and separately. A template's `build` reads answers
 * directly — `answers[sdsLocation].trim()` — because writing every access
 * defensively would litter the prose with fallbacks, and a fallback in a
 * template is exactly how "undefined" ends up in a customer's document. So
 * the contract is that `build` may assume a complete answer set, and this
 * function is what makes that true.
 *
 * Both failure kinds are caught here rather than after assembly: a missing
 * answer would throw during build, and a stale answer to a question that no
 * longer applies would quietly produce a section describing work the customer
 * has said they do not do.
 */
export function validateAnswers({
  template,
  answers,
  context,
}: {
  template: ProgramTemplate;
  answers: Answers;
  context: CompanyContext;
}): ValidationOutcome {
  const problems: ValidationProblem[] = [];

  const visible = visibleQuestions(template, answers, context);

  for (const question of visible) {
    if (question.required && !answers[question.id]?.trim()) {
      problems.push({
        code: "missing_answer",
        detail: `"${question.prompt}" was not answered`,
      });
    }
  }

  const visibleIds = new Set(visible.map((question) => question.id));

  for (const id of Object.keys(answers)) {
    if (!visibleIds.has(id) && template.questions.some((q) => q.id === id)) {
      problems.push({
        code: "contradictory_answer",
        detail: `"${id}" was answered but does not apply to the other answers`,
      });
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

/**
 * Checks the assembled document.
 *
 * Runs over the built sections rather than over the template, so a fault
 * introduced by a conditional branch — a section that renders empty for one
 * combination of answers — is caught for the combination that produces it.
 */
export function validateDocument({
  template,
  answers,
  context,
  sections,
}: {
  template: ProgramTemplate;
  answers: Answers;
  context: CompanyContext;
  sections: Section[];
}): ValidationOutcome {
  const problems: ValidationProblem[] = [];

  if (!context.companyName?.trim()) {
    problems.push({ code: "missing_company", detail: "no company name" });
  }

  if (!template.title?.trim()) {
    problems.push({ code: "missing_title", detail: "template has no title" });
  }

  if (!template.templateVersion?.trim()) {
    problems.push({ code: "missing_version", detail: "template has no version" });
  }

  // Every required question that should have been asked must have an answer.
  for (const question of visibleQuestions(template, answers, context)) {
    if (question.required && !answers[question.id]?.trim()) {
      problems.push({
        code: "missing_answer",
        detail: `"${question.prompt}" was not answered`,
      });
    }
  }

  /*
   * An answer to a question that was never shown is a contradiction: it means
   * the branch changed after it was answered, and the document would be built
   * from a fact the customer is no longer asserting. Caught rather than
   * ignored, because the alternative is a multi-employer section in a
   * programme belonging to someone who said they work alone.
   */
  const visibleIds = new Set(
    visibleQuestions(template, answers, context).map((question) => question.id),
  );

  for (const id of Object.keys(answers)) {
    if (!visibleIds.has(id) && template.questions.some((q) => q.id === id)) {
      problems.push({
        code: "contradictory_answer",
        detail: `"${id}" was answered but does not apply to the other answers`,
      });
    }
  }

  if (sections.length === 0) {
    problems.push({ code: "no_sections", detail: "document has no sections" });
  }

  const seen = new Set<string>();

  for (const section of sections) {
    if (!section.heading?.trim()) {
      problems.push({ code: "empty_heading", detail: "a section has no heading" });
    }

    if (seen.has(section.heading)) {
      problems.push({
        code: "duplicate_section",
        detail: `"${section.heading}" appears more than once`,
      });
    }
    seen.add(section.heading);

    const strings = section.blocks.flatMap(textOf);

    if (strings.length === 0 || strings.every((entry) => !entry.trim())) {
      problems.push({
        code: "empty_section",
        detail: `"${section.heading}" has no content`,
      });
    }

    for (const value of strings) {
      for (const { pattern, code } of FORBIDDEN) {
        if (pattern.test(value)) {
          problems.push({
            code,
            detail: `"${section.heading}": ${value.slice(0, 80)}`,
          });
        }
      }
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
