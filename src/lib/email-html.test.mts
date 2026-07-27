import { strict as assert } from "node:assert";
import { test } from "node:test";

import { signInHtml } from "./email-html.ts";

/**
 * The sign-in email carries a credential, so the properties worth testing are
 * about the link rather than about the layout.
 */

const URL_ = "https://certloop.net/sign-in/verify?token=aaa.bbb.ccc-_x";

test("the link is the button's destination, unmangled", () => {
  const html = signInHtml(URL_, 15);

  // A token that survives escaping in the visible copy but not in the href
  // would produce an email that looks perfect and signs nobody in.
  assert.ok(html.includes(`href="${URL_}"`), "href does not carry the exact URL");
});

test("the destination is also printed as text", () => {
  const html = signInHtml(URL_, 15);

  // Twice: once as the button target, once as readable text. Someone who
  // cannot tell this from a phishing mail needs to see where it goes without
  // hovering, which is not a thing you can do on a phone.
  assert.equal(html.split(URL_).length - 1, 2);
});

test("it states the expiry it was given", () => {
  assert.match(signInHtml(URL_, 15), /after 15 minutes/);
  assert.match(signInHtml(URL_, 5), /after 5 minutes/);
});

test("it tells someone who didn't ask that nothing has happened", () => {
  const html = signInHtml(URL_, 15);

  assert.match(html, /Didn&#39;t ask for this\?/);
  assert.match(html, /nothing has been opened and nothing has changed/);
});

test("it loads nothing from the network", () => {
  const html = signInHtml(URL_, 15);

  // Remote images are blocked by default in Outlook and for many Gmail users,
  // so branding that depends on one renders as a grey box — and an image in an
  // automated email from a young domain is also how a tracking pixel looks to
  // a spam filter. The masthead is table cells for exactly this reason.
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /background-image/i);
  assert.doesNotMatch(html, /<link\b/i);
});

test("it says nothing about the account it belongs to", () => {
  // This is the one message that gets sent to an address on somebody else's
  // say-so, so it must not confirm anything about what is behind it.
  const html = signInHtml(URL_, 15);

  assert.doesNotMatch(html, /submission/i);
  assert.doesNotMatch(html, /gap check/i);
});
