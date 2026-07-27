import nodemailer from "nodemailer";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import type { MessageInput } from "@/lib/messages";
import type { SubmissionRow } from "@/lib/submissions";
import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";
import { isReadable, type ExtractedDocument } from "@/lib/analysis/documents";

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

      // Only verified citations are rendered. An unverified one is stripped
      // upstream — see the schema validator.
      for (const citation of item.citations) {
        lines.push(`  ${citation.cfr} - ${citation.title}`);
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
  const lines = [
    `${row.contact_name},`,
    "",
    PRELIMINARY_HEADER,
    "",
    "---",
    "",
    analysis.summary,
    ...renderItems(analysis.items),
  ];

  if (analysis.questionsForClient.length > 0) {
    lines.push(
      "",
      "QUESTIONS FOR YOU",
      "",
      "We couldn't answer these from what we had:",
      "",
      ...analysis.questionsForClient.map((question) => `- ${question}`),
    );
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
      "Scans and photos without a text layer are the usual reason. Sending",
      "the original file, or a PDF you can select text in, usually fixes it.",
    );
  }

  lines.push(
    "",
    "WHAT THIS WOULD COST",
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
    text: renderAnalysis(row, analysis, unreadable),
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
