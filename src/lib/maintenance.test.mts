import { strict as assert } from "node:assert";
import { test } from "node:test";

import { isIsoDate, reminderState } from "./maintenance.ts";

test("a date before today is overdue", () => {
  assert.equal(reminderState("2026-07-29", "2026-07-30"), "overdue");
});

test("today and the next sixty days are due soon", () => {
  assert.equal(reminderState("2026-07-30", "2026-07-30"), "due_soon");
  assert.equal(reminderState("2026-09-28", "2026-07-30"), "due_soon");
});

test("a date beyond the reminder window is later", () => {
  assert.equal(reminderState("2026-09-29", "2026-07-30"), "later");
});

test("only real calendar dates are accepted", () => {
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(isIsoDate("07/30/2026"), false);
});
