import assert from "node:assert/strict";
import test from "node:test";

import { classifyDocument } from "./document-classification.ts";

test("classifies ACORD-like coverage text", () => {
  assert.equal(
    classifyDocument(
      "ACORD 25 Certificate of Liability Insurance Commercial General Liability",
    ).type,
    "coi",
  );
});

test("does not force ambiguous text into a parser", () => {
  assert.equal(classifyDocument("Training and responsibilities").type, "other");
});
