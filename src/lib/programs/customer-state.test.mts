import { strict as assert } from "node:assert";
import { test } from "node:test";
import { customerProgramAction } from "./customer-state.ts";

const base = { programKey: "loto", programTitle: "Lockout/Tagout" };
test("missing program with a generator can be generated", () => assert.equal(customerProgramAction({ ...base, generatorId: "loto" }).state, "generate"));
test("missing program without a generator is honestly unavailable", () => assert.equal(customerProgramAction(base).state, "unavailable"));
test("a generated document is ready to download", () => assert.deepEqual(customerProgramAction({ ...base, documentId: "doc" }), { state: "ready", label: "Download or update", href: "/dashboard/documents/doc" }));
test("an unconfirmed requirement asks for confirmation before generation", () => assert.equal(customerProgramAction({ ...base, generatorId: "loto", applicability: "unknown" }).state, "confirm_requirement"));
test("not applicable has no action destination", () => assert.equal(customerProgramAction({ ...base, applicability: "not_applicable" }).href, null));
test("an uploaded program is not presented as missing", () => assert.equal(customerProgramAction({ ...base, uploaded: true }).state, "uploaded"));
test("started generator work continues at the selected program", () => assert.equal(customerProgramAction({ ...base, generatorId: "loto", started: true }).label, "Continue"));
test("revision needed outranks ready", () => assert.equal(customerProgramAction({ ...base, documentId: "doc", revisionNeeded: true }).state, "revision_needed"));
test("a requested unavailable program is not offered as a duplicate request", () => assert.equal(customerProgramAction({ ...base, requested: true }).state, "requested"));
