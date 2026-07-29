/**
 * Does this click start a client-side route transition?
 *
 * The navigation progress bar needs to know the moment a navigation *begins*,
 * and the App Router gives no such event: `usePathname` changes when the new
 * route commits, which is the end of the wait, not the start of it. The only
 * signal available at the start is the click itself, so the bar listens for
 * clicks and this decides which of them are actually going somewhere.
 *
 * Kept here, pure and away from the DOM, because getting it wrong is how a
 * progress bar ends up stuck on screen. Every case below is a click on a real
 * anchor that does NOT produce a route transition — a new tab, a download, a
 * mailto, an in-page jump — and each one would leave a bar running with no
 * navigation coming to finish it. They are cheap to enumerate and expensive
 * to discover in production, which is what the tests beside this file are for.
 */

export type ClickIntent = {
  /** The anchor's href attribute, or null if it has none. */
  href: string | null;
  /** The anchor's target attribute, or null. */
  target: string | null;
  /** Whether the anchor carries a `download` attribute. */
  download: boolean;
  /** Ctrl/Cmd/Shift/Alt — any of these means "not an ordinary navigation". */
  hasModifier: boolean;
  /** 0 is the primary button; middle-click opens a tab and is not ours. */
  button: number;
  /** Something upstream already handled it. */
  defaultPrevented: boolean;
};

/**
 * True when the click will navigate this tab to a different in-app URL.
 *
 * `currentUrl` is the full absolute URL of the page the click happened on; it
 * resolves relative hrefs and decides same-origin.
 */
export function startsNavigation(
  intent: ClickIntent,
  currentUrl: string,
): boolean {
  if (intent.defaultPrevented) return false;
  if (intent.button !== 0) return false;
  if (intent.hasModifier) return false;
  if (intent.download) return false;
  if (!intent.href) return false;

  // An explicit target other than this tab opens elsewhere. `_self` is the
  // default written out longhand and still counts as ours.
  if (intent.target && intent.target !== "_self") return false;

  let destination: URL;
  let here: URL;
  try {
    here = new URL(currentUrl);
    destination = new URL(intent.href, currentUrl);
  } catch {
    return false;
  }

  // mailto:, tel:, javascript: — an anchor, but not a page.
  if (destination.protocol !== "http:" && destination.protocol !== "https:") {
    return false;
  }

  // Another site: a full document load, and this tab is being replaced. The
  // bar would be torn down mid-animation rather than completed.
  if (destination.origin !== here.origin) return false;

  // Same document. Either an exact re-click of the current URL, or a `#`
  // jump within the page — neither fetches a new route.
  if (
    destination.pathname === here.pathname &&
    destination.search === here.search
  ) {
    return false;
  }

  return true;
}
