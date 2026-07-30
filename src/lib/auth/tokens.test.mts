import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * The token rules, exercised rather than assumed.
 *
 * These are the checks that decide whether one contractor can read another
 * contractor's safety paperwork, so they are worth running rather than
 * reasoning about. Run with: npm test
 */

process.env.AUTH_JWT_SECRET =
  "test-only-secret-that-is-long-enough-to-pass-3232";

const { signToken, verifyToken, normaliseEmail, SESSION_TTL_SECONDS } =
  await import("./tokens.ts");

test("a session token round-trips", async () => {
  const token = await signToken("Sam@Example.COM", "session");
  const verified = await verifyToken(token, "session");

  assert.equal(verified?.email, "Sam@example.com");
});

test("the session lasts seven days", async () => {
  const token = await signToken("sam@example.com", "session");
  const verified = await verifyToken(token, "session");

  const lifetime = verified!.expiresAt - Math.floor(Date.now() / 1000);

  // Within a couple of seconds of seven days; the token is issued from the
  // clock, not from a fixture.
  assert.ok(Math.abs(lifetime - SESSION_TTL_SECONDS) <= 2, `got ${lifetime}s`);
});

test("a sign-in token is not a session token", async () => {
  // The one that matters most. Without the purpose claim, the fifteen-minute
  // link token would verify as a seven-day session cookie — same secret, same
  // issuer — and the short expiry that bounds a link sitting in an inbox
  // would silently stop applying.
  const link = await signToken("sam@example.com", "sign-in");

  assert.equal(await verifyToken(link, "session"), null);
  assert.notEqual(await verifyToken(link, "sign-in"), null);
});

test("a session token cannot be replayed as a sign-in link", async () => {
  const session = await signToken("sam@example.com", "session");

  assert.equal(await verifyToken(session, "sign-in"), null);
});

test("a company invitation cannot be replayed as a session", async () => {
  const invitation = await signToken("client@example.com", "company-invite");

  assert.equal(await verifyToken(invitation, "session"), null);
  assert.equal(await verifyToken(invitation, "sign-in"), null);
  assert.equal(
    (await verifyToken(invitation, "company-invite"))?.email,
    "client@example.com",
  );
});

test("a tampered payload is refused", async () => {
  const token = await signToken("sam@example.com", "session");
  const [header, payload, signature] = token.split(".");

  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(payload, "base64url").toString()),
      sub: "victim@example.com",
    }),
  ).toString("base64url");

  assert.equal(await verifyToken(`${header}.${forged}.${signature}`, "session"), null);
});

test("an unsigned `alg: none` token is refused", async () => {
  // The classic JWT hole: a library that trusts the header will accept a
  // token with no signature at all. jose is told which algorithm to expect,
  // and this proves that is actually in force.
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");

  const payload = Buffer.from(
    JSON.stringify({
      sub: "victim@example.com",
      purpose: "session",
      iss: "certloop",
      aud: "session",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");

  assert.equal(await verifyToken(`${header}.${payload}.`, "session"), null);
});

test("an expired token is refused", async () => {
  const { SignJWT } = await import("jose");

  const expired = await new SignJWT({ purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("certloop")
    .setAudience("session")
    .setSubject("sam@example.com")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));

  assert.equal(await verifyToken(expired, "session"), null);
});

test("a token signed with a different secret is refused", async () => {
  // Stands in for rotating AUTH_JWT_SECRET, which is the only way to revoke
  // every outstanding session at once.
  const { SignJWT } = await import("jose");

  const foreign = await new SignJWT({ purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("certloop")
    .setAudience("session")
    .setSubject("sam@example.com")
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode("a-completely-different-secret-32chars"));

  assert.equal(await verifyToken(foreign, "session"), null);
});

test("only the domain is lowercased", () => {
  // The local part is case-sensitive per RFC 5321. Folding it — or stripping
  // dots and plus tags, the other common "normalisation" — would let one
  // person claim another's submissions at providers that treat them apart.
  assert.equal(normaliseEmail("  Sam.Jones+isn@Example.COM "), "Sam.Jones+isn@example.com");
  assert.equal(normaliseEmail("a@b@Example.COM"), "a@b@example.com");
  assert.equal(normaliseEmail("not-an-email"), "not-an-email");
});
