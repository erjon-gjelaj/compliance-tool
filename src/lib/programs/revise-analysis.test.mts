import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  analyseRevision,
  applyRevisionOperation,
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
      return {
        ok: true,
        json: reply,
        usage: { input: 0, output: 0 },
        modelId: "provider/selected-model",
      };
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

function replacement(
  targetHeading: string,
  oldText: string,
  newText: string,
  summary = ["Changed one thing."],
) {
  return {
    status: "success",
    operation: {
      type: "replace_text",
      targetHeading,
      oldText,
      newText,
      replaceAll: false,
    },
    summary,
  };
}

function removal(targetHeading: string, summary = ["Removed one section."]) {
  return {
    status: "success",
    operation: { type: "remove_section", targetHeading },
    summary,
  };
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

test("a replacement operation preserves every untargeted section by identity", () => {
  const revised = applyRevisionOperation(ORIGINAL, {
    type: "replace_text",
    targetHeading: "Responsibilities",
    oldText: "Safety Manager",
    newText: "Owner",
    replaceAll: false,
  });

  assert.ok(revised);
  assert.equal(revised[0], ORIGINAL[0]);
  assert.equal(revised[2], ORIGINAL[2]);
  assert.equal(revised[1].sourceRef, ORIGINAL[1].sourceRef);
});

test("a removal operation removes exactly its named existing section", () => {
  const revised = applyRevisionOperation(ORIGINAL, {
    type: "remove_section",
    targetHeading: "Responsibilities",
  });

  assert.deepEqual(revised, [ORIGINAL[0], ORIGINAL[2]]);
});

test("an operation cannot invent a target section", () => {
  assert.equal(
    applyRevisionOperation(ORIGINAL, {
      type: "remove_section",
      targetHeading: "Imaginary Section",
    }),
    null,
  );
});

test("an ambiguous text match is refused unless every occurrence was explicit", () => {
  const original: Section[] = [
    {
      heading: "Roles",
      blocks: [
        { type: "paragraph", text: "The Manager reviews records." },
        { type: "paragraph", text: "The Manager signs records." },
      ],
    },
  ];

  assert.equal(
    applyRevisionOperation(original, {
      type: "replace_text",
      targetHeading: "Roles",
      oldText: "Manager",
      newText: "Owner",
      replaceAll: false,
    }),
    null,
  );

  const revised = applyRevisionOperation(original, {
    type: "replace_text",
    targetHeading: "Roles",
    oldText: "Manager",
    newText: "Owner",
    replaceAll: true,
  });
  assert.match(JSON.stringify(revised), /Owner reviews/);
  assert.match(JSON.stringify(revised), /Owner signs/);
  assert.doesNotMatch(JSON.stringify(revised), /Manager/);
});

test("a no-op or missing text replacement is refused", () => {
  for (const [oldText, newText] of [
    ["Manager", "Manager"],
    ["Not present", "Owner"],
  ]) {
    assert.equal(
      applyRevisionOperation(ORIGINAL, {
        type: "replace_text",
        targetHeading: "Responsibilities",
        oldText,
        newText,
        replaceAll: false,
      }),
      null,
    );
  }
});

/* ------------------------------------------------------------------ */
/* End to end, against a stubbed model                                 */
/* ------------------------------------------------------------------ */

test("a clean revision is returned with its summary", async () => {
  const model = stub(
    replacement(
      "Responsibilities",
      "Safety Manager",
      "Owner",
    ),
  );

  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request:
      "In Responsibilities, change the responsible person to the owner.",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.revisedDocument.length, 3);
  assert.deepEqual(result.summary, ["Changed one thing."]);
  assert.equal(result.modelId, "provider/selected-model");
});

test("sourceRef is never taken from the model", async () => {
  /*
   * sourceRef maps a section to the element of a regulation it covers. A
   * model inventing one would be inventing a regulatory mapping, so it is
   * neither shown to the model nor accepted back — it is restored from the
   * original by heading.
   */
  const model = stub({
    ...replacement(
      "Responsibilities",
      "Safety Manager",
      "Owner",
    ),
    operation: {
      ...replacement("Responsibilities", "Safety Manager", "Owner").operation,
      sourceRef: "1926.99(z)(9)",
    },
  });
  const result = await analyseRevision({
    model,
    sections: ORIGINAL,
    request:
      "In Responsibilities, change the responsible person to the owner.",
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
    replacement(
      "Responsibilities",
      "Safety Manager",
      "Owner",
    ),
  );

  await analyseRevision({
    model,
    sections: ORIGINAL,
    request:
      "In Responsibilities, change the responsible person to the owner.",
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
    replacement(
      "Responsibilities",
      "Safety Manager",
      "Owner",
    ),
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
  const model = stub({
    status: "success",
    operation: {
      type: "replace_text",
      targetHeading: "Responsibilities",
      oldText: "Safety Manager",
      newText: "Owner",
      replaceAll: "nope",
    },
    summary: ["Changed something."],
  });

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
    replacement(
      "Responsibilities",
      "Safety Manager",
      "Owner",
      [],
    ),
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

test("a model operation targeting a missing section asks for clarification", async () => {
  const result = await analyseRevision({
    model: stub(removal("Imaginary Section")),
    sections: ORIGINAL,
    request: "Remove the imaginary section.",
  });

  assert.equal(result.status, "clarification_required");
});

test("a section removal succeeds end to end without rewriting its neighbours", async () => {
  const result = await analyseRevision({
    model: stub(removal("Responsibilities")),
    sections: ORIGINAL,
    request: "Remove the Responsibilities section.",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.deepEqual(result.revisedDocument, [ORIGINAL[0], ORIGINAL[2]]);
});

test("a citation introduced inside the one replacement is still refused", async () => {
  const result = await analyseRevision({
    model: stub(
      replacement(
        "Container Labels",
        "labelled on receipt",
        "labelled under 29 CFR 1910.1200(f)",
      ),
    ),
    sections: ORIGINAL,
    request:
      "In Container Labels, replace labelled on receipt with labelled under 29 CFR 1910.1200(f).",
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.reason, "unsafe_change");
});

test("a model cannot choose a section the customer did not name", async () => {
  const result = await analyseRevision({
    model: stub(
      replacement(
        "Container Labels",
        "labelled",
        "marked",
      ),
    ),
    sections: ORIGINAL,
    request: "Please update the document.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /section heading/i);
});

test("an obvious unique typo in a section heading is grounded safely", async () => {
  const result = await analyseRevision({
    model: stub(removal("Responsibilities")),
    sections: ORIGINAL,
    request: "Please remove the Responsibilites section.",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.deepEqual(result.revisedDocument, [ORIGINAL[0], ORIGINAL[2]]);
});

test("naming two sections does not let the model silently choose one", async () => {
  const result = await analyseRevision({
    model: stub(removal("Responsibilities")),
    sections: ORIGINAL,
    request: "Remove Responsibilities and Container Labels.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /which exact section/i);
});

test("a model cannot invent replacement text the customer did not supply", async () => {
  const result = await analyseRevision({
    model: stub(
      replacement(
        "Responsibilities",
        "Safety Manager",
        "Owner",
      ),
    ),
    sections: ORIGINAL,
    request: "Update the responsible role in Responsibilities.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /exact replacement text/i);
});

test("a model cannot remove a section without explicit removal language", async () => {
  const result = await analyseRevision({
    model: stub(removal("Responsibilities")),
    sections: ORIGINAL,
    request: "Update Responsibilities.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /entire.*removed/i);
});

test("a negated removal request can never remove the section", async () => {
  const result = await analyseRevision({
    model: stub(removal("Responsibilities")),
    sections: ORIGINAL,
    request: "Do not remove the Responsibilities section.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /entire.*removed/i);
});

test("replace-all requires the customer to explicitly ask for every occurrence", async () => {
  const repeated: Section[] = [
    {
      heading: "Responsibilities",
      blocks: [
        { type: "paragraph", text: "The Manager reviews records." },
        { type: "paragraph", text: "The Manager signs records." },
      ],
    },
  ];
  const model = stub({
    status: "success",
    operation: {
      type: "replace_text",
      targetHeading: "Responsibilities",
      oldText: "Manager",
      newText: "Owner",
      replaceAll: true,
    },
    summary: ["Changed the role."],
  });

  const result = await analyseRevision({
    model,
    sections: repeated,
    request: "In Responsibilities, replace Manager with Owner.",
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /every occurrence/i);
});

test("contradictory replace and preserve instructions require clarification", async () => {
  const result = await analyseRevision({
    model: stub(
      replacement(
        "Responsibilities",
        "Safety Manager",
        "Owner",
      ),
    ),
    sections: ORIGINAL,
    request:
      'In Responsibilities, replace "Safety Manager" with "Owner" but keep "Safety Manager" unchanged.',
  });

  assert.equal(result.status, "clarification_required");
  if (result.status !== "clarification_required") return;
  assert.match(result.questions[0], /remain unchanged or be replaced/i);
});
