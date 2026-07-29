# Task 068 — revision reliability and safety audit

The production report was `The model's JSON did not parse`. Testing the tiny
two-section fixture again would have missed the problem, so the live probe was
rebuilt around the real maximum-branch Hazard Communication programme: twelve
sections, all optional sections present, paragraphs, and bullets.

## What failed

The audit reproduced several independent free-provider failures:

- malformed model JSON with `finish_reason: "stop"`;
- HTTP 200 with `application/json` and a zero-byte response body;
- random-router models ignoring the strict status discriminator;
- GPT-OSS rejecting disabled reasoning because reasoning is mandatory;
- a model rewriting an entire section for a one-phrase request;
- a model choosing a section for an ambiguous request;
- a model obeying the first half of a contradictory request and ignoring
  "keep unchanged";
- a clarified request occasionally asking the same question again.

All unsafe outputs failed closed, but frequent safe failure is still a broken
feature.

## Architectural fix

The model no longer returns the revised document or even a replacement
section. Its strict result is one of:

- `remove_section` with one exact existing heading;
- `replace_text` with an exact existing heading, exact `oldText`,
  customer-grounded `newText`, and an explicit `replaceAll` decision;
- clarification questions.

Deterministic code applies the operation to the stored source document.
Untouched sections are preserved by object identity. Headings, block
structure, ordering, and `sourceRef` never come from the model.

Additional code gates require:

- the customer request or answers to name the exact target heading;
- explicit remove/delete/drop/omit language before section removal;
- replacement text to appear in the request or clarification answers;
- explicit all/every/each/throughout language before replacing repeated text;
- clarification when old text is missing, duplicated ambiguously, unchanged,
  or subject to contradictory preserve language.

The existing Zod validation, one-section/citation gate, full
`validateDocument`, rendering, and save ordering remain after these checks.

## Provider recovery

One retry is available for empty content, malformed or zero-byte 2xx
envelopes, syntactically unusable model JSON, timeouts, and 5xx responses.
Both attempts share 45 seconds: the first gets at most 30 seconds and the
second gets the remainder. Permanent 4xx errors, rate limits, refusals, token
limits, invalid schema, and unsafe operations are not retried.

`jsonrepair` is used only after a scanner proves there is exactly one complete,
balanced top-level object with closed strings. Truncated or multiple objects
are never repaired. Every repaired value still passes the strict Zod schema
and all document gates.

## Model audit

`openrouter/free` is not production-safe. Its random pool selected models that
ignored strict output, returned malformed content, or produced zero-byte
envelopes.

Specific free models tested:

- `openai/gpt-oss-20b:free`: rejected the request because reasoning is
  mandatory;
- `nvidia/nemotron-3-super-120b-a12b:free`: structurally capable but
  inconsistent after clarification;
- `nvidia/nemotron-nano-9b-v2:free`: passed the full matrix three consecutive
  times, twelve scenarios total. A zero-byte envelope occurred during those
  runs and the bounded retry recovered successfully.

The configured and documented production pin is therefore
`nvidia/nemotron-nano-9b-v2:free`. It remains an environment variable so a
future free-model retirement is a configuration change, not an architectural
rewrite.

## Final live matrix

The final six-scenario probe passed against the complete twelve-section
document:

1. exact phrase replacement — success, exact diff;
2. misspelled `Responsibilites` section removal — success, exact diff;
3. ambiguous responsible-person request — clarification;
4. missing replacement role — clarification;
5. contradictory replace/keep-unchanged request — clarification;
6. original request plus complete clarification answers — success, exact diff.

The probe uses synthetic company data, stops before rendering/storage, and
never reads Supabase or customer documents.

## Dependency check

`jsonrepair@3.15.0` has no dependencies and added no advisory of its own.
`npm audit --omit=dev` still reports three high-severity advisories in the
existing Next.js dependency tree (`postcss` under Next and `sharp`). npm's only
suggested automatic resolution is `--force` to Next 9.3.3, a breaking and
invalid downgrade for this application, so no unrelated forced dependency
change was made.
