import { readFileSync, writeFileSync } from "node:fs";
import type { ProgramTemplate } from "@/lib/programs/types";

/**
 * Derives a program's config records from the template itself.
 *
 * Adding a program means touching two JSON files as well as the registry, and
 * doing that by hand is how a `template_body_key` ends up pointing at nothing
 * or a questionnaire record drifts from the questions it claims to describe.
 * The template is the source of truth; this writes the config to match.
 *
 * Run from a scratch script when adding programs, not at build time.
 */
export function wire(
  entries: { template: ProgramTemplate; programKey: string; bodyKey: string }[],
): void {
  const programs = JSON.parse(readFileSync("config/programs.json", "utf8"));
  const questionnaires = JSON.parse(
    readFileSync("config/questionnaires.json", "utf8"),
  );

  for (const { template, programKey, bodyKey } of entries) {
    const schemaKey = `${programKey}_v1`;

    const record = programs.records.find(
      (r: { program_key: string }) => r.program_key === programKey,
    );
    if (!record) throw new Error(`No config entry for "${programKey}"`);

    record.template_body_key = bodyKey;
    record.questionnaire_schema_key = schemaKey;
    record.release_state = "customer_available";

    const existing = questionnaires.records.findIndex(
      (r: { questionnaire_schema_key: string }) =>
        r.questionnaire_schema_key === schemaKey,
    );

    const questionnaire = {
      questionnaire_schema_key: schemaKey,
      program_key: programKey,
      version: "1.0.0",
      completeness: "complete_from_spec",
      questions: template.questions.map((q) => ({
        question_key: q.id,
        prompt: q.prompt,
        response_type: q.kind === "choice" ? "text" : q.kind,
        required: q.required,
      })),
    };

    if (existing >= 0) questionnaires.records[existing] = questionnaire;
    else questionnaires.records.push(questionnaire);
  }

  writeFileSync("config/programs.json", JSON.stringify(programs, null, 2) + "\n");
  writeFileSync(
    "config/questionnaires.json",
    JSON.stringify(questionnaires, null, 2) + "\n",
  );
}
