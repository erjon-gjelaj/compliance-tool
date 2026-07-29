# Task 066 — strict structured output for revisions

The first live OpenRouter free-router request returned valid JSON and still
failed `revisionResultSchema`: six document fields were arrays where the
document model requires strings.

Nothing was saved. That is the important result — zod rejected the reply before
the diff gate, renderer, upload, or version insert — but it also proved that
JSON Object Mode is not a sufficient provider contract. It promises JSON
syntax, not the requested shape.

The provider request now uses `response_format.type = json_schema` with
`strict: true`. `REVISION_JSON_SCHEMA` mirrors the zod discriminated union:
success requires the complete document and summary; clarification requires
questions; every object is closed and every declared property is required.
Single-value enums replace `const` for compatibility with constrained-decoding
schema subsets.

Strict output removes one failure class, not the safety gates. The reply still
passes through zod, the one-section change budget, the no-added-section rule,
the no-new-citation rule, sourceRef reattachment, and `validateDocument`.

Two regression tests pin the production fix:

- the request must send strict JSON Schema mode, not JSON Object Mode;
- a recursive schema audit fails if any object admits undeclared fields or
  leaves a declared field optional.

Full result: lint and typecheck clean, 172 tests pass, production build passes.
The first build attempt could not reach Google Fonts in the restricted network;
the same build passed once network access was allowed.
