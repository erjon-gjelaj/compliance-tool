import type {
  Answers,
  CompanyContext,
  ProgramTemplate,
  Section,
} from "@/lib/programs/types";
import {
  validateAnswers,
  validateDocument,
  type ValidationProblem,
} from "@/lib/programs/validate";

/**
 * The one way a document gets built.
 *
 * Three steps in a fixed order, and the order is the safety property:
 *
 *   1. check the answers — a template's `build` may assume they are complete,
 *      and this is what makes that assumption true
 *   2. build
 *   3. check the result — placeholders, empty sections, duplicates
 *
 * Nothing calls `template.build` directly except this function. That matters
 * because step 1 is not optional: `build` reads answers without defensive
 * fallbacks, deliberately, since a fallback inside a template is how the word
 * "undefined" ends up in a customer's programme.
 *
 * There is no partial success. A document either passes both gates and is
 * produced, or it is not produced at all — never emitted with a warning
 * attached, because the person downstream is a hiring client's reviewer.
 */

export type AssemblyOutcome =
  | { ok: true; sections: Section[] }
  | { ok: false; problems: ValidationProblem[] };

export function assembleProgram({
  template,
  answers,
  context,
}: {
  template: ProgramTemplate;
  answers: Answers;
  context: CompanyContext;
}): AssemblyOutcome {
  const answerCheck = validateAnswers({ template, answers, context });
  if (!answerCheck.ok) return answerCheck;

  let sections: Section[];

  try {
    sections = template.build(answers, context);
  } catch (cause) {
    // A template that throws on a complete answer set is our bug, not the
    // customer's. Reported as a problem rather than propagated, so the caller
    // shows "we could not prepare this" instead of a stack trace.
    console.error(`Template ${template.id} threw during build:`, cause);
    return {
      ok: false,
      problems: [{ code: "build_failed", detail: "the template could not be assembled" }],
    };
  }

  const documentCheck = validateDocument({ template, answers, context, sections });
  if (!documentCheck.ok) return documentCheck;

  return { ok: true, sections };
}
