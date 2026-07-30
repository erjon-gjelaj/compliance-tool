import assert from "node:assert/strict";
import test from "node:test";

import {
  generateRequirementSet,
  transitionRequirement,
} from "./generation.ts";

const input = {
  companyId: "company",
  profile: {
    employee_count: 12,
    hazardous_chemicals: true,
    energized_equipment: false,
  },
  tradeCodes: ["welding"],
  scopeOfWork: ["hot_work"],
  platformKey: "isnetworld",
  hiringClientId: "client",
};

test("generates known and explicitly unknown requirements from config", () => {
  const requirements = generateRequirementSet(input);
  assert.ok(
    requirements.some(
      (entry) =>
        entry.requirementKey === "program.hazcom" &&
        entry.applicability === "included",
    ),
  );
  assert.ok(
    requirements.some(
      (entry) =>
        entry.requirementKey === "program.drug_alcohol" &&
        entry.applicability === "unknown",
    ),
  );
  assert.equal(
    requirements.some((entry) => entry.requirementKey === "program.loto"),
    false,
  );
});

test("rejects invalid status transitions", () => {
  assert.throws(
    () => transitionRequirement("missing", "accepted", "2026-07-30T00:00:00Z"),
    /Invalid requirement transition/,
  );
});
