import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";
import type { SubmissionRow } from "@/lib/submissions";

/**
 * The HTML half of the review email.
 *
 * Written for mail clients, not for browsers. Outlook renders through Word's
 * layout engine, so there is no flexbox, no grid, no custom properties, no
 * external fonts, and a <style> block cannot be relied on to survive at all.
 * Everything here is therefore a presentation table with inline styles, which
 * is ugly to write and is the only thing that renders the same in Outlook,
 * Gmail, and Apple Mail.
 *
 * The text/plain version in notify.ts stays the source of truth for what the
 * review SAYS. This module only decides how it looks, and every caller sends
 * both parts — a mail client that refuses HTML still gets the full review.
 */

/* Site palette, hex only. Named CSS variables do not exist in email. */
const GALVANISE = "#eceeea";
const PAPER = "#f8f9f7";
const ZINC_DUST = "#d5dad3";
const SLATE_WASH = "#58655f";
const MILLSCALE = "#151d1a";
const VERDIGRIS = "#2b6b5d";
const RUST_FLAG = "#8c3a2e";

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO_FONT = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/**
 * Escapes text before it goes anywhere near the markup.
 *
 * Everything rendered here is attacker-influenced in principle: file names and
 * the hiring client's name come straight from a public form, and the hiring
 * client's name is interpolated into a requirement label. An ampersand in a
 * company name would break the markup even with no ill intent.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SOURCE_LABEL: Record<AnalysisItem["source"], string> = {
  osha: "Required by OSHA",
  platform: "Commonly requested by ISNetworld/Avetta (our understanding, not law)",
  hiring_client: "Specific to your hiring client - please confirm",
};

/** Status pill colours. Missing is flagged, present is calm, unknown is grey. */
const STATUS_STYLE: Record<string, { bg: string; fg: string; text: string }> = {
  present: { bg: "#dfe9e4", fg: "#1e4d43", text: "Looks present" },
  likely_missing: { bg: "#f2ded9", fg: RUST_FLAG, text: "Looks missing" },
  unknown: { bg: ZINC_DUST, fg: SLATE_WASH, text: "Not established" },
};

/**
 * The tape-rule detail from the site, rebuilt as table cells.
 *
 * The site's signature mark is an SVG tick rule, which no mail client can be
 * trusted to render. Alternating bordered cells give the same read with
 * nothing but table markup.
 */
function tickRule(): string {
  const ticks = Array.from({ length: 48 }, (_, i) =>
    `<td style="width:8px;height:${i % 4 === 0 ? 9 : 5}px;border-left:1px solid ${ZINC_DUST};font-size:0;line-height:0;">&nbsp;</td>`,
  ).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${ticks}</tr></table>`;
}

function heading(text: string): string {
  return `<tr><td style="padding:28px 32px 4px 32px;font-family:${BODY_FONT};font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${SLATE_WASH};">${esc(text)}</td></tr>`;
}

function paragraph(text: string, size = 15): string {
  return `<tr><td style="padding:8px 32px;font-family:${BODY_FONT};font-size:${size}px;line-height:1.6;color:${MILLSCALE};">${esc(text)}</td></tr>`;
}

/** One finding: title, status pill, provenance, and what to do next. */
function itemBlock(item: AnalysisItem, asQuestion: boolean): string {
  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.unknown;

  const pill = asQuestion
    ? ""
    : `<span style="display:inline-block;padding:3px 9px;border-radius:3px;background-color:${style.bg};color:${style.fg};font-family:${BODY_FONT};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;">${style.text}</span>`;

  const citations = item.citations
    .map(
      (c) =>
        `<div style="font-family:${MONO_FONT};font-size:12px;color:${SLATE_WASH};padding-top:4px;">${esc(c.cfr)} &ndash; ${esc(c.title)}</div>`,
    )
    .join("");

  return `<tr><td style="padding:0 32px 14px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-left:3px solid ${style.bg};">
    <tr><td style="padding:2px 0 0 14px;">
      <div style="font-family:${BODY_FONT};font-size:15px;font-weight:700;color:${MILLSCALE};line-height:1.4;padding-bottom:5px;">${esc(item.requirement)}${asQuestion ? " &ndash; confirm whether this applies to you." : ""}</div>
      ${pill ? `<div style="padding-bottom:7px;">${pill}</div>` : ""}
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.55;color:${SLATE_WASH};">${esc(SOURCE_LABEL[item.source])}</div>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.55;color:${SLATE_WASH};padding-top:3px;"><span style="color:${MILLSCALE};font-weight:600;">Based on:</span> ${esc(item.basis)}</div>
      ${item.action ? `<div style="font-family:${BODY_FONT};font-size:13px;line-height:1.55;color:${SLATE_WASH};padding-top:3px;"><span style="color:${MILLSCALE};font-weight:600;">Next:</span> ${esc(item.action)}</div>` : ""}
      ${citations}
    </td></tr>
  </table>
</td></tr>`;
}

/** The compact form: one line each, no provenance. Used when nothing was read. */
function compactList(items: AnalysisItem[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:5px 0 5px 14px;border-left:3px solid ${ZINC_DUST};font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${MILLSCALE};">${esc(item.requirement)}</td></tr>`,
    )
    .join("");
  return `<tr><td style="padding:4px 32px 8px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${rows}</table></td></tr>`;
}

function shell(inner: string, preheader: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(SITE_NAME)} preliminary gap review</title>
</head>
<body style="margin:0;padding:0;background-color:${GALVANISE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${GALVANISE};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background-color:${PAPER};border:1px solid ${ZINC_DUST};border-collapse:collapse;">

<tr><td style="background-color:${MILLSCALE};padding:20px 32px 16px 32px;">
  <div style="font-family:${BODY_FONT};font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${GALVANISE};">${esc(SITE_NAME)}</div>
  <div style="font-family:${MONO_FONT};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#7fc9b5;padding-top:3px;">Preliminary gap review</div>
</td></tr>
<tr><td style="font-size:0;line-height:0;background-color:${MILLSCALE};">${tickRule()}</td></tr>

${inner}

<tr><td style="padding:22px 32px;background-color:${MILLSCALE};font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${ZINC_DUST};">
  ${esc(SITE_NAME)} is an independent service and is not affiliated with, endorsed by, or acting on behalf of ISNetworld, Avetta, or any hiring client.
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/** The disclaimer block. First thing under the masthead, never moved. */
function preliminaryNotice(): string {
  return `<tr><td style="padding:24px 32px 4px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${GALVANISE};border:1px solid ${ZINC_DUST};">
    <tr><td style="padding:14px 16px;font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${MILLSCALE};">
      <strong>This is a preliminary automated review, not a certified audit.</strong><br><br>
      It was produced by software reading what you sent us. It has not been checked by a person, it is not a compliance determination, and it is not legal advice. Confirm anything here with your hiring client before acting on it &ndash; they set the requirements, and they are the ones who decide.
    </td></tr>
  </table>
</td></tr>`;
}

function ctaBlock(): string {
  return `<tr><td style="padding:10px 32px 28px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr><td style="background-color:${VERDIGRIS};padding:12px 22px;">
      <a href="mailto:${esc(CONTACT_EMAIL)}" style="font-family:${BODY_FONT};font-size:14px;font-weight:700;color:${PAPER};text-decoration:none;">Reply and we&rsquo;ll take it further</a>
    </td></tr>
  </table>
  <div style="font-family:${BODY_FONT};font-size:13px;color:${SLATE_WASH};padding-top:9px;">One person reads these &ndash; ${esc(CONTACT_EMAIL)}.</div>
</td></tr>`;
}

function unreadableBlock(unreadable: string[]): string {
  if (unreadable.length === 0) return "";
  const names = unreadable
    .map(
      (n) =>
        `<div style="font-family:${MONO_FONT};font-size:13px;color:${MILLSCALE};padding:2px 0;">${esc(n)}</div>`,
    )
    .join("");
  return `${heading("Files we couldn't read")}
<tr><td style="padding:6px 32px 8px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-left:3px solid ${RUST_FLAG};">
    <tr><td style="padding:2px 0 2px 14px;">
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${MILLSCALE};padding-bottom:6px;"><strong>These were NOT assessed.</strong> Nothing above takes them into account.</div>
      ${names}
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${SLATE_WASH};padding-top:6px;">Scans and photos without a text layer are the usual reason. Sending the original file, or a PDF you can select text in, usually fixes it.</div>
    </td></tr>
  </table>
</td></tr>`;
}

function priceBlock(band: string, copy: string): string {
  // The heading only promises a cost when there is one. "What this would cost"
  // above "we don't have enough to estimate this yet" writes a cheque the body
  // does not cash.
  const title = band === "unknown" ? "About pricing" : "What this would cost";
  return `${heading(title)}
${paragraph(copy, 14)}
<tr><td style="padding:2px 32px 8px 32px;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${SLATE_WASH};">This is an indicative band and not a quote. It is not binding, and we&rsquo;d confirm a real number on a short call once we understand your file.</td></tr>`;
}

/**
 * The full review as HTML.
 *
 * `collapsed` is the case where nothing was readable. Thirteen expanded
 * entries that all say "we couldn't establish this" is the whole catalogue
 * printed back at someone, and it reads as though the tool did nothing. The
 * questions lead instead, and the catalogue shrinks to a list of names.
 */
export function analysisHtml(
  row: SubmissionRow,
  analysis: Analysis,
  unreadable: string[],
  priceCopy: string,
): string {
  const items = analysis.items;
  const collapsed = items.length > 0 && items.every((i) => i.status === "unknown");

  const confident = items.filter((i) => i.confidence === "high");
  const probable = items.filter((i) => i.confidence === "medium");
  const uncertain = items.filter((i) => i.confidence === "low");

  const questions =
    analysis.questionsForClient.length > 0
      ? `${heading(collapsed ? "Start here" : "Questions for you")}
${paragraph(collapsed ? "These are the things that would let us give you a real answer:" : "We couldn't answer these from what we had:", 14)}
${analysis.questionsForClient
  .map(
    (q) =>
      `<tr><td style="padding:4px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="padding:0 0 0 14px;border-left:3px solid ${VERDIGRIS};font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:${MILLSCALE};">${esc(q)}</td></tr></table></td></tr>`,
  )
  .join("")}`
      : "";

  const sections = collapsed
    ? `${questions}
${heading("What we'd normally look for")}
${paragraph("The document types most often asked for at prequalification. We couldn't check any of these against your file yet.", 14)}
${compactList(items)}`
    : `${confident.length > 0 ? heading("What we're reasonably sure of") + confident.map((i) => itemBlock(i, false)).join("") : ""}
${probable.length > 0 ? heading("What looks likely, but worth checking") + probable.map((i) => itemBlock(i, false)).join("") : ""}
${uncertain.length > 0 ? heading("Things we couldn't establish - check these yourself") + uncertain.map((i) => itemBlock(i, true)).join("") : ""}
${questions}`;

  const inner = `${preliminaryNotice()}
${paragraph(`${row.contact_name},`)}
${paragraph(analysis.summary, 14)}
${sections}
${unreadableBlock(unreadable)}
${priceBlock(analysis.priceBand, priceCopy)}
<tr><td style="padding:18px 32px 0 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${ZINC_DUST};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
${heading("Want us to take it further?")}
${ctaBlock()}`;

  return shell(inner, "Your preliminary gap review from CertLoop.");
}

/** The HTML twin of the explainer, sent when there is no analysis to send. */
export function explainerHtml(row: SubmissionRow, unreadable: string[]): string {
  const inner = `${preliminaryNotice()}
${paragraph(`${row.contact_name},`)}
${paragraph("A quick follow-up on the gap check you just sent.", 14)}
${paragraph("Our automated review didn't produce a result it was safe to send you this time, so a person is going to look at it instead. That is slower, and it is the right way round: we would rather say nothing than send you a list that might be wrong about your own paperwork.", 14)}
${paragraph("You'll get one email back with what your ISNetworld or Avetta file still looks short on. No mailing list, and no call to book.", 14)}
${unreadableBlock(unreadable)}
${paragraph("Working to a fixed date? Reply and say when, and we'll tell you honestly whether we can be useful in time.", 14)}
${heading("Want us to take it further?")}
${ctaBlock()}`;

  return shell(inner, "A person is reviewing your gap check.");
}
