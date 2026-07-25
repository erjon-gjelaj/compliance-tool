import nodemailer from "nodemailer";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import type { LeadInput } from "@/lib/leads";

/**
 * Emails a copy of each gap-check request to the inbox, over SMTP.
 *
 * Supabase remains the record of truth — this is a notification so nobody
 * has to sit refreshing the table editor to notice a lead came in.
 *
 * Every environment variable here is server-only. None may take the
 * NEXT_PUBLIC_ prefix: that would publish the SMTP password to every
 * visitor's browser, handing out the ability to send mail as this domain.
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

/**
 * Never throws and never returns a failure the caller has to handle.
 *
 * A lead that is safely in the database but whose notification bounced is
 * not a failed submission, and the person who filled the form in must not be
 * shown an error for it — they did nothing wrong, and retrying would only
 * duplicate the row. Failures are logged for us and swallowed for them.
 */
export async function notifyNewLead(lead: LeadInput): Promise<void> {
  const config = readSmtpConfig();

  // readSmtpConfig has already logged why, with the reason that applies.
  if (!config) return;

  const text = [
    "New gap check request.",
    "",
    `Trade:          ${lead.trade}`,
    `Hiring client:  ${lead.hiring_client}`,
    `Crew size:      ${lead.employee_count}`,
    `Email:          ${lead.email}`,
    "",
    "Reply straight to this email to answer them — the reply-to is set to",
    "their address.",
  ].join("\n");

  try {
    const transport = buildTransport(config);

    await transport.sendMail({
      from: config.from,
      to: config.to,
      // Hitting reply goes to the contractor, not back to ourselves.
      replyTo: lead.email,
      subject: `${SITE_NAME}: gap check — ${lead.trade} — ${lead.hiring_client}`,
      text,
    });
  } catch (cause) {
    // Logged server-side only. SMTP errors can carry the host and username,
    // which is not something to put in front of a visitor.
    console.error("Lead notification failed:", cause);
  }
}
