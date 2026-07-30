import assert from "node:assert/strict";
import test from "node:test";

import { clockState } from "./clock.ts";

test("uses one set of date boundaries", () => {
  assert.equal(clockState("2026-07-29", "2026-07-30").state, "overdue");
  assert.equal(clockState("2026-08-13", "2026-07-30").state, "due_soon");
  assert.equal(clockState("2026-09-28", "2026-07-30").state, "upcoming");
  assert.equal(clockState("2026-09-29", "2026-07-30").state, "scheduled");
  assert.equal(clockState(null, "2026-07-30").state, "no_date");
});
