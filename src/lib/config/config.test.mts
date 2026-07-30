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
  assert.equal(QUESTIONNAIRES.length, 4);
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
