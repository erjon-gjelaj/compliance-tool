/**
 * Chooses where an explicit sign-out finishes.
 *
 * A public page is safe to keep looking at after the session is gone.
 * Authenticated and operational routes are not, and an external-looking path
 * must never become an open redirect.
 */
export function signOutDestination(returnTo: unknown): string {
  if (typeof returnTo !== "string") return "/?signed_out=1";

  const path = returnTo.trim();
  const unsafe =
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/api") ||
    path.startsWith("/internal");

  return unsafe ? "/?signed_out=1" : `${path}?signed_out=1`;
}
