import { strict as assert } from "node:assert";
import { test } from "node:test";

import { startsNavigation, type ClickIntent } from "./nav-intent.ts";

/**
 * Mostly negative tests, on purpose.
 *
 * The failure that matters here is not "the bar did not appear" — that is a
 * missed animation and nobody files it. It is the opposite: a click that was
 * never going to navigate starts the bar, nothing arrives to finish it, and a
 * loading indicator sits at the top of a page that finished loading. Every
 * false case below is a real anchor somewhere in this app.
 */

const HERE = "https://certloop.net/dashboard/requests";

function click(overrides: Partial<ClickIntent> = {}): ClickIntent {
  return {
    href: "/dashboard/documents",
    target: null,
    download: false,
    hasModifier: false,
    button: 0,
    defaultPrevented: false,
    ...overrides,
  };
}

test("an ordinary in-app link starts a navigation", () => {
  assert.equal(startsNavigation(click(), HERE), true);
});

test("an absolute URL on our own origin still counts", () => {
  assert.equal(
    startsNavigation(click({ href: "https://certloop.net/pricing" }), HERE),
    true,
  );
});

test("a query-only change counts — it is a new server render", () => {
  assert.equal(
    startsNavigation(click({ href: "/dashboard/requests?state=open" }), HERE),
    true,
  );
});

test("ctrl or cmd click opens a tab and leaves this page alone", () => {
  assert.equal(startsNavigation(click({ hasModifier: true }), HERE), false);
});

test("middle click opens a tab and leaves this page alone", () => {
  assert.equal(startsNavigation(click({ button: 1 }), HERE), false);
});

test("target=_blank opens elsewhere", () => {
  assert.equal(startsNavigation(click({ target: "_blank" }), HERE), false);
});

test("target=_self is the default written out and is still ours", () => {
  assert.equal(startsNavigation(click({ target: "_self" }), HERE), true);
});

test("a download link never navigates", () => {
  // The documents page links files this way; a bar here would never finish.
  assert.equal(
    startsNavigation(click({ href: "/api/documents/abc", download: true }), HERE),
    false,
  );
});

test("mailto and tel are anchors but not pages", () => {
  assert.equal(
    startsNavigation(click({ href: "mailto:hello@certloop.net" }), HERE),
    false,
  );
  assert.equal(startsNavigation(click({ href: "tel:+15550100" }), HERE), false);
});

test("another origin replaces the document, so the bar is not ours to run", () => {
  assert.equal(
    startsNavigation(click({ href: "https://www.ecfr.gov/current/title-29" }), HERE),
    false,
  );
});

test("an in-page hash jump is not a route transition", () => {
  assert.equal(
    startsNavigation(click({ href: "#gap-check" }), HERE),
    false,
  );
  assert.equal(
    startsNavigation(
      click({ href: "/dashboard/requests#top" }),
      HERE,
    ),
    false,
  );
});

test("re-clicking the link for the page you are on goes nowhere", () => {
  assert.equal(
    startsNavigation(click({ href: "/dashboard/requests" }), HERE),
    false,
  );
});

test("the nav's active link is exactly that case, with the query kept", () => {
  const here = "https://certloop.net/dashboard/requests?state=open";
  assert.equal(
    startsNavigation(click({ href: "/dashboard/requests?state=open" }), here),
    false,
  );
});

test("an anchor with no href is not a link", () => {
  assert.equal(startsNavigation(click({ href: null }), HERE), false);
});

test("a handler that already took the click wins", () => {
  assert.equal(startsNavigation(click({ defaultPrevented: true }), HERE), false);
});

test("a malformed href is refused rather than thrown on", () => {
  assert.equal(startsNavigation(click({ href: "http://" }), HERE), false);
});
