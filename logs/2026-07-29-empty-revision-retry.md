# Task 067 — zero-text OpenRouter completions

The second production trial reached OpenRouter and received a successful HTTP
response with no message content. That is distinct from the earlier invalid
shape: there was no candidate document to validate, so the revision failed
closed and nothing was saved.

The adapter now retries only that exact outcome once. Both calls share the
existing 45-second deadline, so a retry cannot double latency or outlive the
server action. HTTP errors, rate limits, timeouts, malformed JSON, schema
failures, and unsafe revisions remain single-attempt failures.

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
small synthetic two-section document, requests one exact phrase replacement,
and asserts byte-for-byte preservation of the rest. It stops before storage
and never reads customer data.
