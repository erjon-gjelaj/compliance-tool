import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIG_RELEASE,
  ELEMENT_SETS,
  PROGRAM_CATALOG,
  QUESTIONNAIRES,
  REJECTION_CODES,
  REQUIREMENT_CONFIG,
  programConfigByKey,
} from "./index.ts";

test("loads one referentially valid config release", () => {
  assert.equal(CONFIG_RELEASE, "2026-07-30.1");
  assert.ok(PROGRAM_CATALOG.length >= 50);
  assert.equal(REJECTION_CODES.length, 15);
  assert.equal(REQUIREMENT_CONFIG.length, 12);
  assert.ok(ELEMENT_SETS.some((entry) => entry.element_set_key === "universal"));
  /*
   * A count here breaks every time a program is added, which trains whoever
   * added it to edit the number rather than think. The property worth holding
   * is the referential one: everything offerable has a questionnaire, and no
   * questionnaire belongs to a program that does not exist.
   */
  const programKeys = new Set(PROGRAM_CATALOG.map((entry) => entry.program_key));

  for (const questionnaire of QUESTIONNAIRES) {
    assert.ok(
      programKeys.has(questionnaire.program_key),
      `questionnaire ${questionnaire.questionnaire_schema_key} names no real program`,
    );
  }

  const schemaKeys = new Set(
    QUESTIONNAIRES.map((entry) => entry.questionnaire_schema_key),
  );

  for (const program of PROGRAM_CATALOG) {
    if (program.release_state !== "customer_available") continue;

    assert.ok(
      program.questionnaire_schema_key &&
        schemaKeys.has(program.questionnaire_schema_key),
      `${program.program_key} is offered but has no questionnaire`,
    );
    assert.ok(
      program.template_body_key,
      `${program.program_key} is offered but has no template body`,
    );
  }
});

test("preserves generated-program legacy ids", () => {
  assert.equal(programConfigByKey("hazard_communication")?.program_key, "hazcom");
  assert.equal(
    programConfigByKey("personal_protective_equipment")?.program_key,
    "ppe",
  );
  assert.equal(
    programConfigByKey("emergency_action_plan")?.program_key,
    "emergency_action",
  );
  assert.equal(
    programConfigByKey("incident_reporting_investigation")?.program_key,
    "incident_investigation",
  );
});

test("keeps uncertain grade weightings out of program data", () => {
  assert.equal(
    JSON.stringify(PROGRAM_CATALOG).includes("grade_weight"),
    false,
  );
});
