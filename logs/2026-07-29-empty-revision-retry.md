# Task 067 — zero-text OpenRouter completions

The second production trial reached OpenRouter and received a successful HTTP
response with no message content. That is distinct from the earlier invalid
shape: there was no candidate document to validate, so the revision failed
closed and nothing was saved.

The adapter now retries only that exact outcome once. Both calls share the
existing 45-second deadline, so a retry cannot double latency or outlive the
server action. HTTP errors, rate limits, timeouts, malformed JSON, schema
failures, and unsafe revisions remain single-attempt failures.

The expanded live probe found a more specific cause on its ambiguous-request
case. OpenRouter selected `openai/gpt-oss-20b:free` twice; both responses used
172 completion tokens, ended with `finish_reason: "stop"`, and returned no
content. Those tokens were reasoning rather than the requested schema result.
OpenRouter calls now set `reasoning.effort` to `none`. Requiring support for
every parameter was also tried, as OpenRouter's structured-output guide
recommends, but the live free pool returned 404 because no endpoint advertised
that parameter combination. The reasoning control is host-specific and is not
sent to Groq or another OpenAI-compatible endpoint.

Empty-response logs now include the provider response id, requested router,
actual selected model, finish reason, completion token count, and refusal
field. They intentionally omit the API key, prompts, and document content.

OpenRouter's free router chooses the underlying model. A successful model
outcome now carries the provider's `model` field through revision analysis and
stores it in `revised_by_model`; audit records no longer say only
`openrouter/free`.

Tests use an injected fetch implementation and prove:

- empty then valid makes exactly two calls and succeeds;
- empty twice makes exactly two calls and fails closed;
- a provider error makes one call and is not mistaken for empty output;
- usage and the actual selected model survive the adapter and analysis layers.

A live call still requires `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` in
`.env.local`. No LLM variables were configured in this checkout while the
deterministic checks ran.

`npm run test:revision-model` is the repeatable live smoke test. It sends a
small synthetic two-section document and covers an exact phrase replacement,
a clear section removal, and an ambiguous request that must ask a question.
It asserts preservation of all content outside the requested change, stops
before storage, and never reads customer data.

## Live result

With an OpenRouter key configured, the final three-scenario probe passed:

- an exact role replacement changed only the requested phrase;
- `Please remove the Responsibilities section.` removed only that section;
- `Please update the responsible person.` returned a clarification question
  asking for the missing name or job title.

The two successful revisions were served by
`nvidia/nemotron-3-super-120b-a12b:free`. No customer data was used and the
probe did not touch Supabase or generated-document storage.
