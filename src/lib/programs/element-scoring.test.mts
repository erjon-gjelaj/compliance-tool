import assert from "node:assert/strict";
import test from "node:test";

import { generateAnswerKey } from "./answer-key.ts";
import { scoreProgramElements } from "./element-scoring.ts";

test("retains the page where an element heading was found", () => {
  const assessment = scoreProgramElements({
    programKey: "hazcom",
    pageMap: [
      {
        page: 4,
        text: "Chemical inventory\nThe company keeps a current list.",
        method: "text",
        confidence: 1,
        reviewRequired: false,
      },
    ],
  });
  const inventory = assessment.results.find(
    (entry) => entry.elementKey === "chemical_inventory",
  );
  assert.equal(inventory?.state, "present");
  assert.equal(inventory?.page, 4);
});

test("OCR cannot independently prove an element is missing", () => {
  const assessment = scoreProgramElements({
    programKey: "hazcom",
    pageMap: [
      {
        page: 1,
        text: "partial scan",
        method: "ocr",
        confidence: 0.5,
        reviewRequired: true,
      },
    ],
  });
  assert.equal(
    assessment.results.some((entry) => entry.state === "missing"),
    false,
  );
});

test("answer key carries page ranges from element evidence", () => {
  const key = generateAnswerKey({
    programKey: "hazcom",
    elementResults: [
      {
        elementKey: "chemical_inventory",
        title: "Chemical inventory",
        state: "present",
        page: 2,
        confidence: 1,
        snippet: "Chemical inventory",
        basis: "test",
      },
    ],
  });
  assert.equal(
    key.items.find((entry) => entry.questionId.endsWith("chemical_inventory"))
      ?.pageRange,
    "2",
  );
});
