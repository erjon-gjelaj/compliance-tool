import nodemailer from "nodemailer";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import type { LeadInput } from "@/lib/leads";

/**
 * Sends the two emails a gap-check request produces, over SMTP.
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
      "Lead notification skipped: set SMTP_HOST, SMTP_PORT, SMTP_USER and " +
        "SMTP_PASSWORD to have submissions emailed.",
    );
    return null;
  }

  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber <= 0 || portNumber > 65535) {
    // Distinct from the message above on purpose: this one is configured but
    // wrong, which is worth fixing rather than an expected local state.
    console.error(
      `Lead notification skipped: SMTP_PORT is "${port}", which is not a ` +
        "valid port number.",
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

/** A plain-text summary of what was submitted, shared by both messages. */
function submissionSummary(lead: LeadInput): string {
  return [
    `Trade:          ${lead.trade}`,
    `Hiring client:  ${lead.hiring_client}`,
    `Crew size:      ${lead.employee_count}`,
    `Email:          ${lead.email}`,
  ].join("\n");
}

/** The internal heads-up, so nobody has to watch the table editor. */
export function internalMessage(lead: LeadInput, config: SmtpConfig) {
  return {
    from: config.from,
    to: config.to,
    // Hitting reply goes to the contractor, not back to ourselves.
    replyTo: lead.email,
    subject: `${SITE_NAME}: gap check — ${lead.trade} — ${lead.hiring_client}`,
    text: [
      "New gap check request.",
      "",
      submissionSummary(lead),
      "",
      "Reply straight to this email to answer them — the reply-to is set to",
      "their address.",
    ].join("\n"),
  };
}

/**
 * The receipt sent back to whoever filled the form in.
 *
 * Deliberately promises only what the site already promises: that a person
 * reads it, that it isn't instant, and that one email comes back. It repeats
 * their answers so they have a record, and carries the same disclaimer the
 * footer does — this is the one piece of {SITE_NAME} that arrives outside the
 * site, where none of that context is visible.
 */
export function confirmationMessage(lead: LeadInput, config: SmtpConfig) {
  return {
    from: config.from,
    to: lead.email,
    // They reply to us, not to themselves.
    replyTo: config.to,
    subject: `${SITE_NAME}: we've got your gap check request`,
    text: [
      "Thanks — your gap check request is in.",
      "",
      "Someone here reads these by hand, so this isn't instant. You'll get one",
      "email back listing what your ISNetworld or Avetta file still looks short",
      "on, in the order worth tackling. Nothing else: no mailing list, and no",
      "call to book.",
      "",
      "We aim to come back within a few business days. If yours is going to take",
      "longer than that, we'll tell you rather than leave you waiting.",
      "",
      "Working towards a fixed date? Reply to this email and say when, and we'll",
      "tell you honestly whether we can be useful in time.",
      "",
      "Here's what you sent us:",
      "",
      submissionSummary(lead),
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
 * Sends the internal notification and the submitter's confirmation.
 *
 * Never throws and never returns a failure the caller has to handle. A lead
 * that is safely in the database but whose email bounced is not a failed
 * submission, and the person who filled the form in must not be shown an
 * error for it — they did nothing wrong, and retrying would only duplicate
 * the row. Failures are logged for us and swallowed for them.
 *
 * The two sends are settled independently rather than awaited in sequence,
 * so one failing can't suppress the other: a confirmation that bounces
 * because the address was mistyped must not also cost us the internal copy,
 * which is the one that tells us the lead exists at all.
 */
export async function sendLeadEmails(lead: LeadInput): Promise<void> {
  const config = readSmtpConfig();

  // readSmtpConfig has already logged why, with the reason that applies.
  if (!config) return;

  let transport;
  try {
    transport = buildTransport(config);
  } catch (cause) {
    console.error("Could not create the mail transport:", cause);
    return;
  }

  const results = await Promise.allSettled([
    transport.sendMail(internalMessage(lead, config)),
    transport.sendMail(confirmationMessage(lead, config)),
  ]);

  const labels = ["internal notification", "submitter confirmation"];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      // Logged server-side only. SMTP errors can carry the host and
      // username, which is not something to put in front of a visitor.
      console.error(`Lead ${labels[index]} failed:`, result.reason);
    }
  });

  transport.close();
}
