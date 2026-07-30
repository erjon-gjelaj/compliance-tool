import { strict as assert } from "node:assert";
import { test } from "node:test";

import { signOutDestination } from "./sign-out-destination.ts";

test("sign-out keeps a visitor on a public page", () => {
  assert.equal(signOutDestination("/pricing"), "/pricing?signed_out=1");
  assert.equal(signOutDestination("/faq"), "/faq?signed_out=1");
});

test("protected and external-looking paths fall back to the homepage", () => {
  assert.equal(signOutDestination("/dashboard/requests"), "/?signed_out=1");
  assert.equal(signOutDestination("/internal/requests"), "/?signed_out=1");
  assert.equal(signOutDestination("//example.com"), "/?signed_out=1");
  assert.equal(signOutDestination("https://example.com"), "/?signed_out=1");
  assert.equal(signOutDestination(undefined), "/?signed_out=1");
});
