/**
 * Cookie names, in a module anything may import.
 *
 * No `import "server-only"` here, because three very different callers need
 * these strings: the header, which is a client component; proxy.ts, which
 * runs before rendering and cannot import a module that calls `cookies()`;
 * and lib/auth/session.ts itself. Names only — no reading, no writing, and
 * no logic that could be dragged into a client bundle along with them.
 *
 * The session cookie's name being importable from the browser costs nothing.
 * It is not a secret, and knowing it grants nothing: the cookie is httpOnly,
 * so no script can read it, and its value is a signed token that cannot be
 * produced without AUTH_JWT_SECRET.
 */

/**
 * Set alongside the session, readable by scripts, and worth nothing.
 *
 * Its only job is letting the navbar say "Sign out" instead of "Sign in"
 * without turning every static page dynamic. See the long note in
 * lib/auth/session.ts for why it exists and why forging it achieves nothing.
 */
export const SESSION_HINT_COOKIE = "certloop_signed_in";

/**
 * The real session: a signed JWT, httpOnly, and the only thing any access
 * decision is ever allowed to consult.
 */
export const SESSION_COOKIE = "certloop_session";
