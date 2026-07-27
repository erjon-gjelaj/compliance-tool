import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * The hint cookie must agree with the session, on every request.
 *
 * This is a regression test for a real defect rather than a hypothetical one:
 * the hint used to be written only at sign-in, so every session created before
 * the hint existed had none, and the navbar offered "Sign in" to people who
 * were signed in — who then landed on the dashboard when they clicked it,
 * because the server knew who they were all along.
 *
 * The fourth case is the one that keeps it honest. Checking that the session
 * cookie is merely *present* would pass the first three and still hand a
 * "Sign out" link to someone holding an expired or forged token.
 */

process.env.AUTH_JWT_SECRET =
  "test-only-secret-that-is-long-enough-to-pass-3232";

const { SESSION_COOKIE, SESSION_HINT_COOKIE } = await import(
  "./cookie-names.ts"
);
const { signToken } = await import("./tokens.ts");
const { proxy } = await import("../../proxy.ts");
const { NextRequest } = await import("next/server");

const VALID = await signToken("sam@example.com", "session");

/** What the response tells the browser to do with the hint, if anything. */
async function hintAfter(cookies: Record<string, string>) {
  const request = new NextRequest("https://certloop.net/about", {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
  });

  const response = await proxy(request);
  const written = response.cookies.get(SESSION_HINT_COOKIE);

  if (!written) return "untouched";
  return written.value === "" ? "cleared" : "set";
}

test("a session with no hint gets one — the bug this fixes", async () => {
  assert.equal(await hintAfter({ [SESSION_COOKIE]: VALID }), "set");
});

test("a session that already has its hint is left alone", async () => {
  // Not a micro-optimisation. A Set-Cookie header on a statically cached page
  // is how a CDN decides the response is no longer shareable, and the
  // marketing pages are prerendered.
  assert.equal(
    await hintAfter({ [SESSION_COOKIE]: VALID, [SESSION_HINT_COOKIE]: "1" }),
    "untouched",
  );
});

test("a hint with no session is cleared", async () => {
  assert.equal(await hintAfter({ [SESSION_HINT_COOKIE]: "1" }), "cleared");
});

test("a hint alongside an unverifiable token is cleared", async () => {
  // Covers a tampered cookie and, more usefully, a rotated AUTH_JWT_SECRET:
  // the token stops verifying, and the header must stop claiming a session.
  assert.equal(
    await hintAfter({
      [SESSION_COOKIE]: "not.a.token",
      [SESSION_HINT_COOKIE]: "1",
    }),
    "cleared",
  );
});

test("no cookies at all writes nothing", async () => {
  assert.equal(await hintAfter({}), "untouched");
});

test("a sign-in link token is not a session", async () => {
  // The purpose claim again, this time from the proxy's side: a 15-minute
  // link token must not be enough to make the header say "Sign out".
  const link = await signToken("sam@example.com", "sign-in");

  assert.equal(await hintAfter({ [SESSION_COOKIE]: link }), "untouched");
});
