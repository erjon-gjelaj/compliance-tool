import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  MANUAL_SERVICE_KINDS,
  SERVICE_KINDS,
} from "./service-kinds.ts";

test("document preparation remains readable but cannot create a new manual request", () => {
  assert.equal(SERVICE_KINDS.includes("document_preparation"), true);
  assert.equal(
    (MANUAL_SERVICE_KINDS as readonly string[]).includes(
      "document_preparation",
    ),
    false,
  );
});
