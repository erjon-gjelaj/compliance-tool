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

/**
 * The tape-rule mark from components/wordmark.tsx, as table cells.
 *
 * Deliberately not an image. Remote images are blocked by default in Outlook
 * and for plenty of Gmail users, so the one piece of branding would render as
 * a grey placeholder for a good share of recipients — worse than not having
 * it. They are also how tracking pixels work, and this is a new domain with no
 * sending reputation posting automated mail to contractors behind corporate
 * filters. A CID attachment avoids the blocking but puts a paperclip on an
 * email with nothing attached.
 *
 * The mark is only a baseline with two long ticks and two short ones, so
 * borders reproduce it exactly. Renders unconditionally, everywhere.
 */
function tapeRuleMark(): string {
  // Geometry taken from the SVG, not eyeballed. There, on a 24 grid at
  // stroke-width 2: ticks at x=3/9/15/21 so 2 wide with 4 between, baseline
  // x=2..22 so exactly 20 across, long ticks 9 and short ticks 5. Doubled
  // here — at true size a 2px baseline is invisible beside 19px bold text.
  //
  // The colour goes on a fixed-height div, NOT on the cell. A td's height is a
  // minimum and every cell in a row stretches to the tallest one, so colouring
  // the cell directly made all four ticks the same length and flattened the
  // long/short rhythm that is the whole character of a tape rule.
  const tick = (h: number) =>
    `<td valign="top" style="width:4px;font-size:0;line-height:0;"><div style="width:4px;height:${h}px;background-color:#7fc9b5;font-size:0;line-height:0;">&nbsp;</div></td>`;
  const gap = `<td style="width:8px;font-size:0;line-height:0;">&nbsp;</td>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;line-height:0;">
  <tr><td colspan="7" style="font-size:0;line-height:0;"><div style="width:40px;height:4px;background-color:#7fc9b5;font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr>${tick(18)}${gap}${tick(10)}${gap}${tick(10)}${gap}${tick(18)}</tr>
</table>`;
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

  // A reference, not a duty. The standard exists; whether it applies to this
  // contractor turns on their work and their site, which we cannot determine.
  const citations =
    item.citations.length === 0
      ? ""
      : `<div style="padding-top:7px;">
      <div style="font-family:${BODY_FONT};font-size:12px;font-weight:600;color:${MILLSCALE};">OSHA standards on this subject</div>
      ${item.citations
        .map(
          (c) =>
            `<div style="font-family:${MONO_FONT};font-size:12px;line-height:1.5;color:${SLATE_WASH};padding-top:2px;">${esc(c.cfr)} &ndash; ${esc(c.title)}</div>`,
        )
        .join("")}
    </div>`;

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

function shell(inner: string, preheader: string, kicker = "Preliminary gap review"): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(SITE_NAME)} &ndash; ${esc(kicker)}</title>
</head>
<body style="margin:0;padding:0;background-color:${GALVANISE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${GALVANISE};">
<tr><td align="center" style="padding:24px 12px;">
<!-- 680 rather than the usual 600. That convention dates from preview panes
     far narrower than anything current, and at 600 this read as a thin ribbon
     in a maximised window. Still well inside what Outlook and Gmail handle,
     and max-width keeps it fluid on a phone. -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="680" style="width:680px;max-width:100%;background-color:${PAPER};border:1px solid ${ZINC_DUST};border-collapse:collapse;">

<tr><td style="background-color:${MILLSCALE};padding:20px 32px 16px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td valign="middle" style="padding-right:10px;">${tapeRuleMark()}</td>
      <td valign="middle" style="font-family:${BODY_FONT};font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${GALVANISE};">${esc(SITE_NAME)}</td>
    </tr>
  </table>
  <div style="font-family:${MONO_FONT};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#7fc9b5;padding-top:6px;">${esc(kicker)}</div>
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
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${SLATE_WASH};padding-top:8px;">These are almost always scans or photographs of paper. There is no text inside them to search &ndash; only a picture of text. Any of these fixes it:</div>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${SLATE_WASH};padding-top:6px;">&bull; Send the file the document was originally written in, usually Word.</div>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${SLATE_WASH};">&bull; Re-export a PDF from that original rather than scanning a printout.</div>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${SLATE_WASH};">&bull; If the scan is all that exists, most scanners and Adobe Acrobat can re-save it with the text recognised &ndash; look for <strong style="color:${MILLSCALE};">OCR</strong>, <strong style="color:${MILLSCALE};">Recognise Text</strong>, or <strong style="color:${MILLSCALE};">Make Searchable</strong>.</div>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${MILLSCALE};padding-top:8px;">Reply with one of those and we&rsquo;ll run it again properly.</div>
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

/**
 * What they told us, as a two-column table.
 *
 * Same rules as the plain-text version it mirrors: a skipped step is left out
 * rather than printed empty, since "skipped" and "answered blank" would
 * otherwise look identical, and attached files are named rather than counted.
 */
function intakeSummaryHtml(row: SubmissionRow, documents: string[]): string {
  const pairs: [string, string][] = [
    ["Trade", row.trade],
    ["Hiring client", row.hiring_client],
    ["Platform", row.platform],
    ["Deadline", row.deadline ?? "not known"],
    ["Name", row.contact_name],
    ["Email", row.email],
  ];

  if (row.headcount_band) pairs.push(["Crew size", row.headcount_band]);
  if (row.states?.length) pairs.push(["States", row.states.join(", ")]);
  if (row.emr) pairs.push(["EMR", row.emr]);
  if (row.trir) pairs.push(["TRIR", row.trir]);
  if (row.previously_registered) {
    pairs.push(["Registered before", row.previously_registered]);
  }

  if (row.documents_unsure) {
    pairs.push(["Documents held", "not sure"]);
  } else if (row.documents_held?.length) {
    pairs.push(["Documents held", row.documents_held.join(", ")]);
  }

  if (documents.length > 0) pairs.push(["Attached", documents.join(", ")]);

  const rows = pairs
    .map(
      ([k, v]) =>
        `<tr>
      <td valign="top" style="padding:5px 14px 5px 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${SLATE_WASH};white-space:nowrap;">${esc(k)}</td>
      <td valign="top" style="padding:5px 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${MILLSCALE};">${esc(v)}</td>
    </tr>`,
    )
    .join("");

  return `<tr><td style="padding:4px 32px 8px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${GALVANISE};border:1px solid ${ZINC_DUST};">
    <tr><td style="padding:10px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>
    </td></tr>
  </table>
</td></tr>`;
}

/**
 * The confirmation, sent the moment the intake lands.
 *
 * This one is not a review and must not look like one, so it carries no
 * preliminary-review disclaimer — there is nothing yet to disclaim. It says
 * what happens next and reflects back what we received.
 */
export function confirmationHtml(row: SubmissionRow, documents: string[]): string {
  const inner = `${paragraph(`Thanks ${row.contact_name} — your gap check is in.`)}
${paragraph("You'll get one email back listing what your ISNetworld or Avetta file still looks short on, in the order worth tackling. Nothing else: no mailing list, and no call to book.", 14)}
${paragraph("Working towards a fixed date? Reply to this email and say when, and we'll tell you honestly whether we can be useful in time.", 14)}
${heading("What you sent us")}
${intakeSummaryHtml(row, documents)}
<tr><td style="padding:14px 32px 26px 32px;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${SLATE_WASH};">A gap check is guidance to help you prepare your own submission, not a compliance determination.</td></tr>`;

  return shell(
    inner,
    "We've got your gap check — your review is on its way.",
    "Gap check received",
  );
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

  return shell(inner, "A person is reviewing your gap check.", "Gap check received");
}
