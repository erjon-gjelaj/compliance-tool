/**
 * Cookie names shared between the server and the browser.
 *
 * Its own module, with no `import "server-only"`, because the header is a
 * client component and needs the hint cookie's name — and lib/auth/session.ts
 * is server-only by design, since importing it from the browser is exactly the
 * mistake that file exists to make impossible.
 *
 * Only the name of the display hint lives here. The session cookie's name
 * stays inside session.ts: nothing in the browser has any business naming it,
 * because nothing in the browser can read it.
 */

/**
 * Set alongside the session, readable by scripts, and worth nothing.
 *
 * Its only job is letting the navbar say "Sign out" instead of "Sign in"
 * without turning every static page dynamic. See the long note in
 * lib/auth/session.ts for why it exists and why forging it achieves nothing.
 */
export const SESSION_HINT_COOKIE = "certloop_signed_in";
