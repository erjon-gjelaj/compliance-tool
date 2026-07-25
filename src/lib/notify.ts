import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import type { LeadInput } from "@/lib/leads";

/**
 * Emails a copy of each gap-check request to the inbox.
 *
 * Supabase is still the record of truth — this is a notification so nobody
 * has to sit refreshing the table editor to notice a lead came in.
 *
 * Sent through Resend's REST API with plain fetch rather than their SDK: it
 * is one POST, and this way there is no dependency to keep current and no
 * runtime constraint on where the action executes. Swapping to a different
 * provider means rewriting this one function.
 *
 * Every environment variable here is server-only. None may take the
 * NEXT_PUBLIC_ prefix — that would ship the API key to the browser.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Never throws and never returns a failure the caller has to handle.
 *
 * A lead that is safely in the database but whose notification bounced is
 * not a failed submission, and the person who filled the form in must not be
 * shown an error for it — they did nothing wrong and retrying would only
 * duplicate the row. Failures are logged for us and swallowed for them.
 */
export async function notifyNewLead(lead: LeadInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM;
  const to = process.env.LEAD_NOTIFY_TO ?? CONTACT_EMAIL;

  if (!apiKey || !from) {
    // Expected locally and in any environment that hasn't been given a key.
    // Warn rather than error: the lead itself was saved, which is the part
    // that matters.
    console.warn(
      "Lead notification skipped: set RESEND_API_KEY and LEAD_NOTIFY_FROM " +
        "to have submissions emailed.",
    );
    return;
  }

  const lines = [
    `Trade:          ${lead.trade}`,
    `Hiring client:  ${lead.hiring_client}`,
    `Crew size:      ${lead.employee_count}`,
    `Email:          ${lead.email}`,
  ].join("\n");

  const text = [
    `New gap check request.`,
    ``,
    lines,
    ``,
    `Reply straight to this email to answer them — the reply-to is set to`,
    `their address.`,
  ].join("\n");

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        // Hitting reply goes to the contractor, not back to ourselves.
        reply_to: lead.email,
        subject: `${SITE_NAME}: gap check — ${lead.trade} — ${lead.hiring_client}`,
        text,
      }),
    });

    if (!response.ok) {
      // Body is read for the log only; it can carry provider detail that
      // should not reach a visitor.
      const detail = await response.text().catch(() => "");
      console.error(
        `Lead notification failed: ${response.status} ${response.statusText} ${detail}`,
      );
    }
  } catch (cause) {
    console.error("Lead notification failed:", cause);
  }
}
