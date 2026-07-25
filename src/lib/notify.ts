import nodemailer from "nodemailer";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import type { MessageInput } from "@/lib/messages";
import type { SubmissionRow } from "@/lib/submissions";

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
function intakeSummary(row: SubmissionRow): string {
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

  return lines.join("\n");
}

export function internalIntakeMessage(row: SubmissionRow, config: SmtpConfig) {
  return {
    from: config.from,
    to: config.to,
    replyTo: row.email,
    subject: `${SITE_NAME}: intake — ${row.trade} — ${row.hiring_client}`,
    text: [
      "A gap-check intake was completed.",
      "",
      intakeSummary(row),
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
      intakeSummary(row),
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
export async function sendIntakeEmails(row: SubmissionRow): Promise<void> {
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
    transport.sendMail(internalIntakeMessage(row, config)),
    transport.sendMail(intakeConfirmationMessage(row, config)),
  ]);

  const labels = ["internal notification", "submitter confirmation"];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Intake ${labels[index]} failed:`, result.reason);
    }
  });

  transport.close();
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
