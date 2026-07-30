import nodemailer from "nodemailer";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/constants";
import type { MessageInput } from "@/lib/messages";
import type { SubmissionRow } from "@/lib/submissions";
import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";
import { isReadable, type ExtractedDocument } from "@/lib/analysis/documents";
import {
  analysisHtml,
  confirmationHtml,
  explainerHtml,
  signInHtml,
} from "@/lib/email-html";

/**
 * Transactional email over SMTP: the two messages a gap-check intake
 * produces, and the contact-form message.
 *
 * One to us, so nobody has to sit refreshing the table editor to notice a
 * lead came in. One back to whoever filled the form in, confirming it
 * arrived and what happens next. Supabase remains the record of truth.
 *
 * Every environment variable here is server-only. None may take the
 * NEXT_PUBLIC_ prefix: that would publish the SMTP password to every
 * visitor's browser, handing out the ability to send mail as this domain.
 *
 * The two message builders are exported so their envelopes can be composed
 * and inspected without opening a connection — feed them to a nodemailer
 * jsonTransport. Worth having: swapping the two recipients would send our
 * internal copy to the contractor, and that is not a mistake you want to
 * discover from a real submission.
 */

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
};

/**
 * Reads and validates the SMTP settings, returning null when the mailer
 * isn't configured rather than throwing.
 *
 * Deliberately all-or-nothing: a half-filled config is treated as absent, so
 * a missing password can't produce a confusing auth failure on every
 * submission.
 */
function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.LEAD_NOTIFY_FROM?.trim() || user;
  const to = process.env.LEAD_NOTIFY_TO?.trim() || CONTACT_EMAIL;

  if (!host || !port || !user || !password) {
    // Expected locally and anywhere the mailer hasn't been set up. A warning
    // rather than an error: the lead itself saved, which is the part that
    // matters.
    console.warn(
      "Email skipped: set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD " +
        "to have gap checks and contact messages emailed.",
    );
    return null;
  }

  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber <= 0 || portNumber > 65535) {
    // Distinct from the message above on purpose: this one is configured but
    // wrong, which is worth fixing rather than an expected local state.
    console.error(
      `Email skipped: SMTP_PORT is "${port}", which is not a valid port ` +
        "number.",
    );
    return null;
  }

  return { host, port: portNumber, user, password, from: from ?? user, to };
}

function buildTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 is implicit TLS. Everything else (587, 25) starts in the clear and
    // upgrades via STARTTLS, which `secure: false` selects — it does not mean
    // "unencrypted", and requireTLS makes the upgrade mandatory rather than
    // best-effort, so credentials are never sent over a plaintext session.
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

/* -------------------------------------------------------------------------
 * Scope B intake
 * ---------------------------------------------------------------------- */

/** The answers, laid out the same way in both intake emails. */
function intakeSummary(row: SubmissionRow, documents: string[]): string {
  const lines = [
    `Trade:          ${row.trade}`,
    `Hiring client:  ${row.hiring_client}`,
    `Platform:       ${row.platform}`,
    `Deadline:       ${row.deadline ?? "not known"}`,
    `Name:           ${row.contact_name}`,
    `Email:          ${row.email}`,
  ];

  // Steps 2 and 3 are skippable, so anything absent is left out rather than
  // printed as an empty line. "Skipped" and "answered blank" would look the
  // same otherwise.
  if (row.headcount_band) lines.push(`Crew size:      ${row.headcount_band}`);
  if (row.states?.length) lines.push(`States:         ${row.states.join(", ")}`);
  if (row.emr) lines.push(`EMR:            ${row.emr}`);
  if (row.trir) lines.push(`TRIR:           ${row.trir}`);
  if (row.previously_registered) {
    lines.push(`Registered before: ${row.previously_registered}`);
  }

  if (row.documents_unsure) {
    lines.push("", "Documents held: not sure");
  } else if (row.documents_held?.length) {
    lines.push(
      "",
      "Documents they say they already have:",
      ...row.documents_held.map((entry) => `  - ${entry}`),
    );
  }

  // Listed by name rather than counted. "3 files attached" is not something
  // you can check against what you actually sent.
  if (documents.length > 0) {
    lines.push(
      "",
      "Documents attached:",
      ...documents.map((name) => `  - ${name}`),
    );
  }

  return lines.join("\n");
}

export function internalIntakeMessage(
  row: SubmissionRow,
  documents: string[],
  config: SmtpConfig,
) {
  return {
    from: config.from,
    to: config.to,
    replyTo: row.email,
    subject: `${SITE_NAME}: intake — ${row.trade} — ${row.hiring_client}`,
    text: [
      "A gap-check intake was completed.",
      "",
      intakeSummary(row, documents),
      "",
      `Submission id: ${row.id}`,
      "",
      "Reply straight to this email to answer them — the reply-to is set to",
      "their address.",
    ].join("\n"),
  };
}

/**
 * The receipt for a completed intake.
 *
 * This is deliberately still the modest, human-review version. The automated
 * analysis email is task 028; until that lands, promising one here would be
 * promising something the code does not yet do.
 */
export function intakeConfirmationMessage(
  row: SubmissionRow,
  documents: string[],
  config: SmtpConfig,
) {
  return {
    from: config.from,
    to: row.email,
    replyTo: config.to,
    subject: `${SITE_NAME}: we've got your gap check`,
    text: [
      `Thanks ${row.contact_name} — your gap check is in.`,
      "",
      "You'll get one email back listing what your ISNetworld or Avetta file",
      "still looks short on, in the order worth tackling. Nothing else: no",
      "mailing list, and no call to book.",
      "",
      "Working towards a fixed date? Reply to this email and say when, and we'll",
      "tell you honestly whether we can be useful in time.",
      "",
      // No link with a token in it. The dashboard is reached by asking for a
      // sign-in link from the site, so a forwarded confirmation email never
      // hands anyone else the file.
      "Everything you sent, and the review once it's ready, stays available at",
      `${SITE_URL}/sign-in — enter this address and we'll email you a way in.`,
      "There's no password to set.",
      "",
      "Here's what you sent us:",
      "",
      intakeSummary(row, documents),
      "",
      "---",
      `${SITE_NAME} is an independent service and is not affiliated with,`,
      "endorsed by, or acting on behalf of ISNetworld, Avetta, or any hiring",
      "client. A gap check is guidance to help you prepare your own submission,",
      "not a compliance determination.",
    ].join("\n"),
    html: confirmationHtml(row, documents),
  };
}

/**
 * Never throws and never reports a failure the caller has to handle. The row
 * is already stored before this is called, so a bounced email costs a
 * notification and not a submission — and showing an error for it would only
 * invite a retry.
 *
 * The two sends are settled independently rather than awaited in sequence, so
 * one failing can't suppress the other: a confirmation bouncing off a
 * mistyped address must not also cost the internal copy, which is the one
 * that tells us the intake exists at all.
 */
export async function sendIntakeEmails(
  row: SubmissionRow,
  documents: string[] = [],
): Promise<void> {
  const config = readSmtpConfig();
  if (!config) return;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return;
  }

  const results = await Promise.allSettled([
    transport.sendMail(internalIntakeMessage(row, documents, config)),
    transport.sendMail(intakeConfirmationMessage(row, documents, config)),
  ]);

  const labels = ["internal notification", "submitter confirmation"];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Intake ${labels[index]} failed:`, result.reason);
    }
  });

  transport.close();
}

/* -------------------------------------------------------------------------
 * Scope B analysis
 * ---------------------------------------------------------------------- */

/**
 * The header every automated review carries, before anything else.
 *
 * It says three things, all load-bearing: that a machine wrote this, that it
 * is not an audit, and that their hiring client is the authority. Someone
 * reading this on a phone between jobs needs that in the first paragraph, not
 * in a footer they will never reach.
 */
const PRELIMINARY_HEADER = [
  "This is a preliminary automated review, not a certified audit.",
  "",
  "It was produced by software reading what you sent us. It has not been",
  "checked by a person, it is not a compliance determination, and it is not",
  "legal advice. Confirm anything here with your hiring client before acting",
  "on it - they set the requirements, and they are the ones who decide.",
].join("\n");

const PRICE_BAND_COPY: Record<string, string> = {
  low: "Toward the lower end - there doesn't look like a great deal to assemble.",
  medium: "Somewhere in the middle - a normal amount of work.",
  high: "Toward the higher end - there looks like a lot to put together.",
  unknown: "We don't have enough to estimate this yet.",
};

function renderItems(items: Analysis["items"]): string[] {
  if (items.length === 0) return [];

  const lines: string[] = [];

  const label: Record<AnalysisItem["source"], string> = {
    osha: "Required by OSHA",
    platform: "Commonly requested by ISNetworld/Avetta (our understanding, not law)",
    hiring_client: "Specific to your hiring client - please confirm",
  };

  // Grouped by confidence, because that is what changes how a line should be
  // read. High-confidence findings are statements; low-confidence ones are
  // rendered as questions further down, never as assertions.
  const confident = items.filter((item) => item.confidence === "high");
  const probable = items.filter((item) => item.confidence === "medium");
  const uncertain = items.filter((item) => item.confidence === "low");

  const section = (heading: string, group: AnalysisItem[], asQuestion: boolean) => {
    if (group.length === 0) return;

    lines.push("", heading, "");

    for (const item of group) {
      lines.push(
        // The label is a noun phrase, so it leads the line rather than being
        // dropped into a sentence. "Confirm whether Training records for the
        // crew applies to you" did not agree in number, and the hiring-client
        // label made it read as nonsense.
        asQuestion
          ? `- ${item.requirement} - confirm whether this applies to you.`
          : `- ${item.requirement}${item.status === "present" ? " - looks present" : item.status === "likely_missing" ? " - looks missing" : " - not established"}`,
      );
      lines.push(`  ${label[item.source]}`);
      lines.push(`  Based on: ${item.basis}`);
      if (item.action) lines.push(`  Next: ${item.action}`);

      // Labelled as a reference, never as a duty. The standard exists; what
      // it requires of THIS contractor turns on their work and their site,
      // which we cannot determine and must not imply we have.
      if (item.citations.length > 0) {
        lines.push("  OSHA standards on this subject:");
        for (const citation of item.citations) {
          lines.push(`    ${citation.cfr} - ${citation.title}`);
          if (citation.note) lines.push(`      ${citation.note}`);
        }
      }

      lines.push("");
    }
  };

  section("WHAT WE'RE REASONABLY SURE OF", confident, false);
  section("WHAT LOOKS LIKELY, BUT WORTH CHECKING", probable, false);
  section("THINGS WE COULDN'T ESTABLISH - CHECK THESE YOURSELF", uncertain, true);

  return lines;
}

function renderAnalysis(
  row: SubmissionRow,
  analysis: Analysis,
  unreadable: string[],
): string {
  // Nothing was readable, so every item is an unknown. Thirteen expanded
  // entries that all say the same thing is the whole catalogue printed back at
  // someone, and it reads as though the tool did nothing. Lead with the
  // questions, which are the only actionable part, and shrink the catalogue to
  // a list of names.
  const collapsed =
    analysis.items.length > 0 &&
    analysis.items.every((item) => item.status === "unknown");

  const lines = [
    `${row.contact_name},`,
    "",
    PRELIMINARY_HEADER,
    "",
    "---",
    "",
    analysis.summary,
  ];

  const questions =
    analysis.questionsForClient.length > 0
      ? [
          "",
          collapsed ? "START HERE" : "QUESTIONS FOR YOU",
          "",
          collapsed
            ? "These are the things that would let us give you a real answer:"
            : "We couldn't answer these from what we had:",
          "",
          ...analysis.questionsForClient.map((question) => `- ${question}`),
        ]
      : [];

  if (collapsed) {
    lines.push(
      ...questions,
      "",
      "WHAT WE'D NORMALLY LOOK FOR",
      "",
      "The document types most often asked for at prequalification. We",
      "couldn't check any of these against your file yet.",
      "",
      ...analysis.items.map((item) => `- ${item.requirement}`),
    );
  } else {
    lines.push(...renderItems(analysis.items), ...questions);
  }

  // Never omitted when there is something in it. Someone who attached six
  // files and sees five discussed will assume the sixth was fine.
  if (unreadable.length > 0) {
    lines.push(
      "",
      "FILES WE COULDN'T READ",
      "",
      "These were NOT assessed. Nothing above takes them into account:",
      "",
      ...unreadable.map((name) => `- ${name}`),
      "",
      // Specific and actionable. "Send a better file" is not advice; naming
      // the three things that actually work is. Most of these are scans of
      // paper, and the person holding the scan usually has the original.
      "These are almost always scans or photographs of paper. There is no",
      "text inside them to search — only a picture of text. Any of these",
      "fixes it:",
      "",
      "- Send the file the document was originally written in, usually Word.",
      "- Re-export a PDF from that original rather than scanning a printout.",
      "- If the scan is all that exists, most scanners and Adobe Acrobat can",
      "  re-save it with the text recognised — look for OCR, Recognise Text,",
      "  or Make Searchable.",
      "",
      "Reply with one of those and we'll run it again properly.",
    );
  }

  // Stated rather than buried. Someone acting on a lockout/tagout line needs
  // to know we are declining to cite a construction standard, not assume the
  // general industry one covers them.
  if (analysis.warnings.length > 0) {
    lines.push(
      "",
      "WHERE WE STOP SHORT",
      "",
      ...analysis.warnings.map((warning) => `- ${warning.message}`),
    );
  }

  lines.push(
    "",
    // The heading only promises a cost when there is one. "What this would
    // cost" above "we don't have enough to estimate this yet" writes a cheque
    // the body does not cash.
    analysis.priceBand === "unknown" ? "ABOUT PRICING" : "WHAT THIS WOULD COST",
    "",
    PRICE_BAND_COPY[analysis.priceBand] ?? PRICE_BAND_COPY.unknown,
    "This is an indicative band and not a quote. It is not binding, and we'd",
    "confirm a real number on a short call once we understand your file.",
    "",
    "---",
    "",
    "WANT US TO TAKE IT FURTHER?",
    "",
    `Reply to this email and say so. One person reads these - ${CONTACT_EMAIL}.`,
    "",
    "This review, and the files you sent, stay available at",
    `${SITE_URL}/sign-in — enter your email address and we'll send you a way`,
    "in. No password to set, and nothing in this email will let anyone else",
    "read it.",
    "",
    "---",
    `${SITE_NAME} is an independent service and is not affiliated with,`,
    "endorsed by, or acting on behalf of ISNetworld, Avetta, or any hiring",
    "client.",
  );

  return lines.join("\n");
}

export function analysisMessage(
  row: SubmissionRow,
  analysis: Analysis,
  unreadable: string[],
  config: SmtpConfig,
) {
  return {
    from: config.from,
    to: row.email,
    replyTo: config.to,
    subject: `${SITE_NAME}: your preliminary gap review`,
    // Both parts, always. text/plain stays the source of truth for what the
    // review says; a client that refuses HTML still gets the whole thing.
    text: renderAnalysis(row, analysis, unreadable),
    html: analysisHtml(
      row,
      analysis,
      unreadable,
      PRICE_BAND_COPY[analysis.priceBand] ?? PRICE_BAND_COPY.unknown,
    ),
  };
}

/** The internal copy. Same content, plus what it took to produce it. */
export function internalAnalysisMessage(
  row: SubmissionRow,
  analysis: Analysis,
  unreadable: string[],
  config: SmtpConfig,
) {
  return {
    from: config.from,
    to: config.to,
    replyTo: row.email,
    subject: `${SITE_NAME}: analysis sent - ${row.trade} - ${row.hiring_client}`,
    text: [
      "An automated review was sent to a contractor.",
      "",
      `Submission id: ${row.id}`,
      `Items: ${analysis.items.length}, questions: ${analysis.questionsForClient.length}, unreadable: ${unreadable.length}`,
      `Price band: ${analysis.priceBand}`,
      "",
      "Their answers:",
      "",
      intakeSummary(row, []),
      "",
      "=== What they received ===",
      "",
      renderAnalysis(row, analysis, unreadable),
    ].join("\n"),
  };
}

/**
 * The safe generic explainer, sent when there is no analysis to send.
 *
 * It promises nothing it cannot deliver and does not pretend a review
 * happened. Sending this is always available; unsaying a confident wrong
 * answer is not, which is why every failure path in the pipeline lands here.
 */
export function explainerMessage(
  row: SubmissionRow,
  unreadable: string[],
  config: SmtpConfig,
) {
  const lines = [
    `${row.contact_name},`,
    "",
    "A quick follow-up on the gap check you just sent.",
    "",
    "Our automated review didn't produce a result it was safe to send you",
    "this time, so a person is going to look at it instead. That is slower,",
    "and it is the right way round: we would rather say nothing than send you",
    "a list that might be wrong about your own paperwork.",
    "",
    "You'll get one email back with what your ISNetworld or Avetta file still",
    "looks short on. No mailing list, and no call to book.",
  ];

  if (unreadable.length > 0) {
    lines.push(
      "",
      "One thing that would help. We couldn't read these files:",
      "",
      ...unreadable.map((name) => `- ${name}`),
      "",
      "Scans and photos without a text layer are the usual reason. If you can",
      "reply with the original file, or a PDF you can select text in, that",
      "saves a round trip.",
    );
  }

  lines.push(
    "",
    "Working to a fixed date? Reply and say when, and we'll tell you honestly",
    "whether we can be useful in time.",
    "",
    "---",
    `${SITE_NAME} is an independent service and is not affiliated with,`,
    "endorsed by, or acting on behalf of ISNetworld, Avetta, or any hiring",
    "client. A gap check is guidance to help you prepare your own submission,",
    "not a compliance determination.",
  );

  return {
    from: config.from,
    to: row.email,
    replyTo: config.to,
    subject: `${SITE_NAME}: we've got your gap check`,
    text: lines.join("\n"),
    html: explainerHtml(row, unreadable),
  };
}

export function internalExplainerMessage(
  row: SubmissionRow,
  unreadable: string[],
  config: SmtpConfig,
) {
  return {
    from: config.from,
    to: config.to,
    replyTo: row.email,
    subject: `${SITE_NAME}: NEEDS A HUMAN - ${row.trade} - ${row.hiring_client}`,
    text: [
      "An automated review did not produce a usable result, so the contractor",
      "was sent the generic explainer and told a person would look at it.",
      "Somebody now has to.",
      "",
      `Submission id: ${row.id}`,
      "The reason is in the analyses table against this submission.",
      "",
      intakeSummary(row, []),
      ...(unreadable.length > 0
        ? ["", "Files that could not be read:", ...unreadable.map((n) => `  - ${n}`)]
        : []),
    ].join("\n"),
  };
}

function unreadableNames(documents: ExtractedDocument[]): string[] {
  return documents
    .filter((entry) => !isReadable(entry))
    .map((entry) => entry.document.file_name);
}

/** Same never-throws contract as the other senders. */
async function sendPair(
  build: (config: SmtpConfig) => [unknown, unknown],
  labels: [string, string],
): Promise<void> {
  const config = readSmtpConfig();
  if (!config) return;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return;
  }

  const [first, second] = build(config);

  const results = await Promise.allSettled([
    transport.sendMail(first as nodemailer.SendMailOptions),
    transport.sendMail(second as nodemailer.SendMailOptions),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`${labels[index]} failed:`, result.reason);
    }
  });

  transport.close();
}

export async function sendAnalysisEmails(
  row: SubmissionRow,
  analysis: Analysis,
  documents: ExtractedDocument[],
): Promise<void> {
  // The extractor owns this list. A file it could not read is a fact rather
  // than a judgement, so it is not something to re-derive downstream.
  const unreadable = unreadableNames(documents);

  await sendPair(
    (config) => [
      internalAnalysisMessage(row, analysis, unreadable, config),
      analysisMessage(row, analysis, unreadable, config),
    ],
    ["Internal analysis copy", "Analysis email"],
  );
}

export async function sendExplainerEmails(
  row: SubmissionRow,
  documents: ExtractedDocument[],
): Promise<void> {
  const unreadable = unreadableNames(documents);

  await sendPair(
    (config) => [
      internalExplainerMessage(row, unreadable, config),
      explainerMessage(row, unreadable, config),
    ],
    ["Internal explainer copy", "Explainer email"],
  );
}

/* -------------------------------------------------------------------------
 * Client sign-in
 * ---------------------------------------------------------------------- */

/**
 * The sign-in link email.
 *
 * Exported so the envelope can be composed and inspected without opening a
 * connection, same as the others — and here that matters more than usual,
 * because the body carries a credential and the one thing this must never do
 * is address it to anyone but the account holder.
 *
 * Both parts are always sent, and text/plain stays the source of truth for
 * what it SAYS — a client that refuses HTML still gets a working link.
 *
 * The earlier version of this was plain text only, on the grounds that one
 * bare URL is the hardest thing for a corporate gateway to mangle. That
 * reasoning was half right and is worth recording rather than deleting: a
 * gateway that rewrites links rewrites them in both parts, and one that
 * follows every link would burn a single-use token — but this token is
 * deliberately not single-use, so a scanner opening it costs nothing. What
 * plain text actually bought was resemblance to the phishing mail this
 * structurally is, which the HTML answers better than plain text did: the
 * destination is printed in full, in monospace, under the button.
 */
export function signInMessage(
  email: string,
  url: string,
  minutes: number,
  config: SmtpConfig,
) {
  return {
    from: config.from,
    to: email,
    subject: `Your ${SITE_NAME} sign-in link`,
    text: [
      `Here is your link to open your ${SITE_NAME} dashboard, where you can`,
      "read the documents you sent us and the review we produced from them.",
      "",
      url,
      "",
      `The link works once you open it and stops working after ${minutes} minutes.`,
      "Signing in keeps you signed in on this device for 7 days.",
      "",
      "If you did not ask for this link, you can ignore this email — nothing",
      "has been opened and nothing has changed. Nobody can reach your",
      "documents without a link sent to this address.",
      "",
      "---",
      `${SITE_NAME} — ${SITE_URL}`,
      `Questions: ${CONTACT_EMAIL}`,
    ].join("\n"),
    html: signInHtml(url, minutes),
  };
}

/**
 * Whether the mailer is set up at all.
 *
 * Distinct from a send failing. This one is a deployment fault, identical for
 * every address, and safe to show — which is exactly why sign-in uses it and
 * does not show individual send failures. See the sign-in action.
 */
export function smtpConfigured(): boolean {
  return readSmtpConfig() !== null;
}

/**
 * Sends the sign-in link, reporting whether it went.
 *
 * Reports a result rather than swallowing failures, like the contact form and
 * unlike the intake mails: there is no database row standing behind this one.
 * If the send fails and the page claims a link is on its way, the person
 * waits for something that is never arriving.
 */
export async function sendSignInLink(
  email: string,
  url: string,
  minutes: number,
): Promise<boolean> {
  const config = readSmtpConfig();
  if (!config) return false;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return false;
  }

  try {
    await transport.sendMail(signInMessage(email, url, minutes, config));
    return true;
  } catch (cause) {
    // Server-side only: SMTP errors can carry the host and username, and this
    // one would also carry the address that asked.
    console.error("Sign-in link failed to send:", cause);
    return false;
  } finally {
    transport.close();
  }
}

export async function notifyClientInvitation({
  email,
  companyName,
  consultantName,
  url,
  days,
}: {
  email: string;
  companyName: string;
  consultantName: string;
  url: string;
  days: number;
}): Promise<boolean> {
  const config = readSmtpConfig();
  if (!config) return false;
  const transport = buildTransport(config);

  try {
    await transport.sendMail({
      from: config.from,
      to: email,
      replyTo: config.to,
      subject: `${consultantName} invited you to ${companyName}`,
      text: [
        `${consultantName} created a ${SITE_NAME} workspace for ${companyName}.`,
        "",
        "Open the workspace:",
        url,
        "",
        `This invitation link expires after ${days} days.`,
        "The link signs you in as the owner address it was sent to. If you did",
        "not expect this invitation, ignore it and nothing changes.",
      ].join("\n"),
    });
    return true;
  } catch (cause) {
    console.error("Client invitation failed to send:", cause);
    return false;
  } finally {
    transport.close();
  }
}

/**
 * The contact-form message, sent to our own inbox.
 *
 * Reply-to is the sender, so answering goes to them. Their address is never
 * put in `from` — that would be forging our domain's mail as them, which is
 * what SPF and DMARC exist to reject.
 *
 * Exported for the same reason the gap-check builders are: the envelope can
 * be composed and inspected through a nodemailer jsonTransport without
 * opening a connection.
 */
export function contactMessage(input: MessageInput, config: SmtpConfig) {
  return {
    from: config.from,
    to: config.to,
    replyTo: input.email,
    subject: `${SITE_NAME}: message from ${input.name}`,
    text: [
      "Someone sent a message through the contact form.",
      "",
      `Name:   ${input.name}`,
      `Email:  ${input.email}`,
      "",
      "Message:",
      "",
      input.message,
      "",
      "---",
      "Reply straight to this email to answer them — the reply-to is set to",
      "their address.",
    ].join("\n"),
  };
}

/**
 * Sends a contact-form message and reports whether it actually went.
 *
 * This returns a result, where sendIntakeEmails deliberately swallows failures,
 * and the difference is the point: a gap check is safely in Supabase before
 * any mail is attempted, so a bounced email costs a notification. A contact
 * message has no database behind it — email is the only copy. If the send
 * fails and we showed a success panel anyway, the message would be gone and
 * the person would be waiting for a reply that can never come.
 *
 * So a failure here is the visitor's problem to know about, and the form
 * hands them the mailto fallback instead.
 *
 * Only one email is sent, to our own inbox. There is deliberately no
 * auto-reply to the sender: the form is public and unauthenticated, and
 * mailing an address a stranger typed is the spam-amplification vector
 * already noted in DEPLOY.md. Worth it for a gap check, which is the actual
 * product and where the receipt is the record. Not worth it here.
 */
export async function sendContactMessage(
  input: MessageInput,
): Promise<boolean> {
  const config = readSmtpConfig();

  // readSmtpConfig has already logged why, with the reason that applies.
  // Reported as a failure rather than a silent no-op: nothing was stored, so
  // an unconfigured mailer means the message went nowhere at all.
  if (!config) return false;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return false;
  }

  try {
    await transport.sendMail(contactMessage(input, config));
    return true;
  } catch (cause) {
    // Logged server-side only. SMTP errors can carry the host and username.
    console.error("Contact message failed to send:", cause);
    return false;
  } finally {
    transport.close();
  }
}

/**
 * Tells the inbox that somebody asked for work done by hand.
 *
 * Internal only, and no auto-reply to the requester: the page they sent it
 * from already told them a person will answer, and a second machine-written
 * email saying the same thing adds nothing.
 *
 * Failures are logged rather than surfaced. The request is already stored in
 * `service_requests` by the time this runs, so a bounced notification costs a
 * prompt, not the record — and telling someone their request did not go
 * through, while it sits in the table, is the worse of the two errors.
 */
export async function notifyServiceRequest({
  email,
  kind,
  note,
}: {
  email: string;
  kind: string;
  note: string | null;
}): Promise<void> {
  const config = readSmtpConfig();
  if (!config) return;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return;
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: config.to,
      replyTo: email,
      subject: `${SITE_NAME}: ${email} asked for help (${kind})`,
      text: [
        "Someone asked for work that is done by hand.",
        "",
        `Address: ${email}`,
        `Wants:   ${kind}`,
        "",
        "What they said:",
        "",
        note ?? "(nothing written)",
        "",
        "---",
        "It is recorded in the service_requests table. Reply straight to this",
        "email to answer them.",
      ].join("\n"),
    });
  } catch (cause) {
    console.error("Service-request notification failed to send:", cause);
  } finally {
    transport.close();
  }
}

/**
 * Tells a customer that we replied on one of their requests.
 *
 * Sent because they will not be sitting on the dashboard waiting. The body is
 * included rather than only a "you have a message" nudge — making somebody
 * sign in to read one sentence is the pattern this product exists to avoid.
 *
 * No link to the thread is signed here: the dashboard already requires
 * sign-in, and minting a magic link into an email about something else would
 * make every reply a credential.
 */
export async function notifyCertLoopReply({
  email,
  requestId,
  body,
  awaitsReply,
}: {
  email: string;
  requestId: string;
  body: string;
  awaitsReply: boolean;
}): Promise<void> {
  const config = readSmtpConfig();
  if (!config) return;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return;
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: email,
      replyTo: config.to,
      subject: awaitsReply
        ? `${SITE_NAME}: we need something from you`
        : `${SITE_NAME}: an update on your request`,
      text: [
        awaitsReply
          ? "We've replied and there's something we need back from you:"
          : "We've replied on your request:",
        "",
        body,
        "",
        "---",
        `Reply to this email, or open ${SITE_URL}/dashboard/requests/${requestId}`,
        "to answer in your dashboard.",
      ].join("\n"),
    });
  } catch (cause) {
    console.error("Reply notification failed to send:", cause);
  } finally {
    transport.close();
  }
}

/** Tells our inbox that a customer added something to a request. */
export async function notifyCustomerReply({
  email,
  requestId,
  body,
}: {
  email: string;
  requestId: string;
  body: string;
}): Promise<void> {
  const config = readSmtpConfig();
  if (!config) return;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return;
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: config.to,
      replyTo: email,
      subject: `${SITE_NAME}: ${email} replied on a request`,
      text: [
        `${email} added something to a request.`,
        "",
        body,
        "",
        "---",
        `It is back with us: ${SITE_URL}/internal/requests`,
        `Request ${requestId}.`,
      ].join("\n"),
    });
  } catch (cause) {
    console.error("Customer-reply notification failed to send:", cause);
  } finally {
    transport.close();
  }
}
