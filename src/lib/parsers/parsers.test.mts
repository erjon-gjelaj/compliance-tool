import assert from "node:assert/strict";
import test from "node:test";

import { insuranceAgentSentence, parseAcord25 } from "./acord25.ts";
import {
  calculateSafetyRates,
  reconcileSafetyRates,
} from "./statistics.ts";
import { parseTrainingRoster } from "./training.ts";

test("calculates and reconciles safety rates", () => {
  const rates = calculateSafetyRates({
    hoursWorked: 400_000,
    recordableIncidents: 2,
    dartCases: 1,
    lostTimeCases: 1,
  });
  assert.deepEqual(rates, { trir: 1, dart: 0.5, ltir: 0.5 });
  assert.equal(reconcileSafetyRates(rates, { trir: 2 })[0].state, "mismatch");
});

test("extracts evidence-bearing ACORD coverage", () => {
  const coverages = parseAcord25([
    {
      page: 1,
      text: "ACORD 25 COMMERCIAL GENERAL LIABILITY EACH OCCURRENCE $1,000,000 GENERAL AGGREGATE $2,000,000 ADDL INSR",
    },
  ]);
  assert.equal(coverages[0].type, "GL");
  assert.equal(coverages[0].eachOccurrence, 1_000_000);
  assert.equal(coverages[0].page, 1);
  assert.match(
    insuranceAgentSentence({ clientName: "Client", gaps: ["add waiver"] }),
    /add waiver/,
  );
});

test("keeps absent instructor signature unknown", () => {
  const records = parseTrainingRoster([
    {
      page: 2,
      text: "Training roster Instructor: Alex Smith",
      confidence: 1,
    },
  ]);
  assert.equal(records[0].instructorSignature, null);
});
