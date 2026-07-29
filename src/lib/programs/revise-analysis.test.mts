import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  analyseRevision,
  checkRevision,
  REVISION_JSON_SCHEMA,
} from "./revise-analysis.ts";
import type { StructuredModel, StructuredRequest } from "../ai/model.ts";
import type { Section } from "./types.ts";

function assertStrictObjects(value: unknown, path = "$"): void {
  if (!value || typeof value !== "object") return;

  const schema = value as Record<string, unknown>;

  if (schema.type === "object") {
    assert.equal(
      schema.additionalProperties,
      false,
      `${path} must reject undeclared properties`,
    );

    const properties = Object.keys(
      (schema.properties ?? {}) as Record<string, unknown>,
    ).sort();
    const required = [...((schema.required ?? []) as string[])].sort();

    assert.deepEqual(required, properties, `${path} must require every property`);
  }

  for (const [key, child] of Object.entries(schema)) {
    if (Array.isArray(child)) {
      child.forEach((entry, index) =>
        assertStrictObjects(entry, `${path}.${key}[${index}]`),
      );
    } else {
      assertStrictObjects(child, `${path}.${key}`);
    }
  }
}

test("the provider schema qualifies for strict structured output", () => {
  assertStrictObjects(REVISION_JSON_SCHEMA);
});

/**
 * What a model is allowed to do to somebody's safety programme.
 *
 * These are the tests that make the LLM decision defensible. The model is not
 * trusted, it is fenced, and this file is the fence: every case below is a
 * well-formed reply that satisfies the JSON Schema exactly and must still be
 * refused. Shape was never the risk — a document that rewrote four sections
 * nobody mentioned, or grew a CFR citation, or quietly dropped one, parses
 * perfectly.
 *
 * No network. The model is a stub returning canned JSON, which is the only
 * way these can be deterministic — and determinism is precisely what the
 * project's no-LLM rule was protecting when it was reversed for this feature.
 */

const ORIGINAL: Section[] = [
  {
    heading: "Purpose and Policy",
    sourceRef: "1910.1200(e)(1)",
    blocks: [{ type: "paragraph", text: "The Company maintains this program." }],
  },
  {
    heading: "Responsibilities",
    sourceRef: "1910.1200(e)(1)(i)",
    blocks: [
      { type: "paragraph", text: "The Safety Manager administers this program." },
    ],
  },
  {
    heading: "Container Labels",
    blocks: [{ type: "paragraph", text: "Containers are labelled on receipt." }],
  },
];

/** A model that returns exactly what the test hands it. */
function stub(reply: unknown): StructuredModel & { seen: StructuredRequest[] } {
  const seen: StructuredRequest[] = [];
  return {
    id: "stub-model",
    seen,
    async complete(request) {
      seen.push(request);
      return { ok: true, json: reply, usage: { input: 0, output: 0 } };
    },
  };
}

function failing(reason: string): StructuredModel {
  return {
    id: "stub-model",
    async complete() {
      return { ok: false, reason };
    },
  };
}

function success(sections: unknown, summary = ["Changed one thing."]) {
  return { status: "success", revisedDocument: { sections }, summary };
}

/** The original, with one named section's paragraph replaced. */
function edited(heading: string, text: string) {
  return ORIGINAL.map(({ heading: h, blocks }) =>
    h === heading ? { heading: h, blocks: [{ type: "paragraph", text }] } : { heading: h, blocks },
  );
}

/* ------------------------------------------------------------------ */
/* The change gate                                                     */
/* ------------------------------------------------------------------ */

test("a single edited section is allowed", () => {
  const problems = checkRevision(
    ORIGINAL,
    edited("Responsibilities", "The Site Supervisor administers this program."),
  );
  assert.deepEqual(problems, []);
});

test("rewriting a section nobody asked about is refused", () => {
  const revised = edited("Responsibilities", "The Owner administers this program.");
  revised[0] = {
    heading: "Purpose and Policy",
    blocks: [{ type: "paragraph", text: "The Company is committed to excellence." }],
  };

  const codes = checkRevision(ORIGINAL, revised).map((p) => p.code);
  assert.ok(codes.includes("too_many_changes"), codes.join(","));
});

test("adding a section is refused even when it looks helpful", () => {
  const revised = [
    ...ORIGINAL.map(({ heading, blocks }) => ({ heading, blocks })),
    {
      heading: "Emergency Procedures",
      blocks: [{ type: "paragraph" as const, text: "Call the site supervisor." }],
    },
  ];

  const codes = checkRevision(ORIGINAL, revised).map((p) => p.code);
  assert.ok(codes.includes("section_added"), codes.join(","));
});

test("a regulation citation the document did not have is refused", () => {
  const revised = edited(
    "Container Labels",
    "Containers are labelled on receipt as required by 29 CFR 1910.1200(f).",
  );

  const codes = checkRevision(ORIGINAL, revised).map((p) => p.code);
  assert.ok(codes.includes("citation_introduced"), codes.join(","));
});

test("a citation already in the section is not flagged as introduced", () => {
  // Otherwise no document that legitimately quotes a standard could ever be
  // revised at all — the gate is about what the model ADDED.
  const original: Section[] = [
    {
      heading: "Scope",
      blocks: [{ type: "paragraph", text: "This program covers 29 CFR 1910.1200." }],
    },
  ];
  const revised = [
    {
      heading: "Scope",
      blocks: [
        { type: "paragraph" as const, text: "This program covers 29 CFR 1910.1200 fully." },
      ],
    },
  ];

  assert.deepEqual(checkRevision(original, revised), []);
});

test("a citation hidden in a table cell is caught too", () => {
  const revised = [
    ...ORIGINAL.slice(0, 2).map(({ heading, blocks }) => ({ heading, blocks })),
    {
      heading: "Container Labels",
      blocks: [
        {
          type: "table" as const,
          head: ["Container", "Rule"],
          rows: [["Drum", "1910.1200(f)(1)"]],
        },
      ],
    },
  ];

  const codes = checkRevision(ORIGINAL, revised).map((p) => p.code);
  assert.ok(codes.includes("citation_introduced"), codes.join(","));
});

test("emptying the document is refused", () => {
  const codes = checkRevision(ORIGINAL, []).map((p) => p.code);
  assert.ok(codes.includes("empty_document"), codes.join(","));
});

test("removing one section counts against the change budget", () => {
  // Removal is a legitimate request, so one is allowed — but a removal plus
  // an unrelated rewrite is not.
  const one = ORIGINAL.slice(0, 2).map(({ heading, blocks }) => ({ heading, blocks }));
  assert.deepEqual(checkRevision(ORIGINAL, one), []);

  const two = [
    {
      heading: "Purpose and Policy",
      blocks: [{ type: "paragraph" as const, text: "Rewritten as well." }],
    },
  ];
  const codes = checkRevision(ORIGINAL, two).map((p) => p.code);
  assert.ok(codes.includes("too_many_changes"), codes.join(","));
});

/* ------------------------------------------------------------------ */
/* End to end, against a stubbed model                                 */
/* ------------------------------------------------------------------ */

test("a clean revision is returned with its summary", async () => {
  const model = stub(
    success(edited("Responsibilities", "The Owner administers this program.")),
  );

  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "Change the responsible person to the owner.",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.revisedDocument.length, 3);
  assert.deepEqual(result.summary, ["Changed one thing."]);
});

test("sourceRef is never taken from the model, only re-attached", async () => {
  /*
   * sourceRef maps a section to the element of a regulation it covers. A
   * model inventing one would be inventing a regulatory mapping, so it is
   * neither shown to the model nor accepted back — it is restored from the
   * original by heading.
   */
  const revised = edited("Responsibilities", "The Owner administers this program.").map(
    (section) => ({ ...section, sourceRef: "1926.99(z)(9)" }),
  );

  const model = stub(success(revised));
  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "Change the responsible person to the owner.",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;

  assert.equal(result.revisedDocument[1].sourceRef, "1910.1200(e)(1)(i)");
  assert.equal(
    result.revisedDocument.some((s) => s.sourceRef === "1926.99(z)(9)"),
    false,
  );
  // The section that never had one does not acquire one.
  assert.equal(result.revisedDocument[2].sourceRef, undefined);
});

test("the prompt never shows the model our regulatory mapping", async () => {
  const model = stub(
    success(edited("Responsibilities", "The Owner administers this program.")),
  );

  await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "Change the responsible person to the owner.",
  });

  const [request] = model.seen;
  assert.equal(request.user.includes("1910.1200"), false);
  assert.equal(request.user.includes("sourceRef"), false);
});

test("clarification questions are passed straight back", async () => {
  const model = stub({
    status: "clarification_required",
    questions: ["Who should the program name as responsible?"],
  });

  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "They said to update the responsible person.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.equal(result.questions.length, 1);
});

test("answers to earlier questions are carried into the retry", async () => {
  const model = stub(
    success(edited("Responsibilities", "The Owner administers this program.")),
  );

  await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "Update the responsible person.",
    clarifications: [
      { question: "Who is responsible?", answer: "The owner, Dale." },
    ],
  });

  const [request] = model.seen;
  assert.ok(request.user.includes("Who is responsible?"));
  assert.ok(request.user.includes("The owner, Dale."));
});

test("a reply that does not match the schema is a failure, not a document", async () => {
  const model = stub({ status: "success", revisedDocument: { sections: "nope" } });

  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "Change something.",
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.reason, "invalid_shape");
});

test("a reply with no summary is refused — an unexplained change is not offered", async () => {
  const model = stub(
    success(edited("Responsibilities", "The Owner administers this program."), []),
  );

  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request: "Change the responsible person.",
  });

  assert.equal(result.status, "failed");
});

test("a model failure is reported, never silently treated as no change", async () => {
  for (const reason of ["busy", "unreachable", "declined", "too_long", "not_configured"]) {
    const result = await analyseRevision({
      model: failing(reason),
      sections: ORIGINAL,
      request: "Change something.",
    });

    assert.equal(result.status, "failed");
    if (result.status !== "failed") continue;
    assert.equal(result.reason, reason);
  }
});

test("an over-broad rewrite is refused end to end, not just by the gate", async () => {
  const revised = ORIGINAL.map(({ heading }) => ({
    heading,
    blocks: [{ type: "paragraph" as const, text: "Rewritten." }],
  }));

  const result = await analyseRevision({
    model: stub(success(revised)),
    sections: ORIGINAL,
    request: "Change the responsible person.",
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.reason, "unsafe_change");
});
