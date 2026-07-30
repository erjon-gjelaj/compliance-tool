import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";

/**
 * The company profile: entered once, reused by every later request.
 *
 * Identity is the email address, exactly as it is everywhere else in this
 * project — there is still no accounts table and no password. One profile per
 * address.
 *
 * The part worth reading is `field_sources`. Anything this product did not
 * hear directly from the contractor is marked, and the UI has to render it as
 * a question rather than as a fact. That rule exists because a profile sits
 * underneath a compliance review: a trade guessed from a company name, left
 * unmarked, would silently decide which requirements a contractor is measured
 * against. A company name reveals nothing about how a crew actually works.
 *
 * Nothing in this file infers anything today. The seam is here so that when
 * something does — a website lookup, a trade suggested from a previous
 * submission — it cannot be stored as though they said it.
 */

export const FIELD_SOURCES = ["client", "inferred"] as const;

export type FieldSource = (typeof FIELD_SOURCES)[number];

export type FieldProvenance = {
  source: FieldSource;
  /** When the contractor confirmed it. Absent means they have not. */
  confirmedAt?: string;
};

export type CompanyRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  name: string;
  website: string | null;
  home_state: string | null;
  operating_states: string[] | null;
  trade: string | null;
  headcount_band: string | null;
  platforms: string | null;
  hiring_clients: string[] | null;
  operations: string | null;
  field_sources: Record<string, FieldProvenance>;
  plan: string;
  managed_by_email: string | null;
  consultant_brand_name: string | null;
  invited_at: string | null;
  accepted_at: string | null;
};

/** The fields a profile holds, in the order they are asked for. */
export const PROFILE_FIELDS = [
  "name",
  "website",
  "home_state",
  "operating_states",
  "trade",
  "headcount_band",
  "platforms",
  "hiring_clients",
  "operations",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

/**
 * Whether a value has to be shown as "is this right?" rather than as a fact.
 *
 * True only for something we inferred and they have not confirmed. A value
 * they typed carries no provenance entry at all, which is why an absent entry
 * means "they said it" rather than "we don't know where this came from" —
 * every write path either records provenance or is the contractor typing.
 */
export function needsConfirming(
  company: Pick<CompanyRow, "field_sources">,
  field: ProfileField,
): boolean {
  const provenance = company.field_sources?.[field];
  if (!provenance) return false;

  return provenance.source === "inferred" && !provenance.confirmedAt;
}

/** Every inferred field still awaiting a yes or no. */
export function unconfirmedFields(
  company: Pick<CompanyRow, "field_sources">,
): ProfileField[] {
  return PROFILE_FIELDS.filter((field) => needsConfirming(company, field));
}

function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Companies a consultant is explicitly recorded as managing. */
export async function listManagedCompanies(
  consultantEmail: string,
): Promise<CompanyRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .ilike("managed_by_email", emailPattern(consultantEmail))
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not list managed companies: ${error.message}`);
  }

  return (data ?? []) as CompanyRow[];
}

/** A managed company, only when this consultant owns that relationship. */
export async function getManagedCompany(
  consultantEmail: string,
  companyId: string,
): Promise<CompanyRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .ilike("managed_by_email", emailPattern(consultantEmail))
    .maybeSingle();

  if (error) return null;
  return (data as CompanyRow | null) ?? null;
}

/**
 * Creates or updates a client workspace and records that an invitation was
 * sent. The owner email remains the workspace identity.
 */
export async function inviteManagedCompany({
  consultantEmail,
  clientEmail,
  companyName,
}: {
  consultantEmail: string;
  clientEmail: string;
  companyName: string;
}): Promise<CompanyRow> {
  const supabase = getSupabaseAdminClient();
  const existing = await getCompanyForEmail(clientEmail);
  const invitedAt = new Date().toISOString();

  if (existing) {
    if (
      existing.managed_by_email &&
      existing.managed_by_email.toLowerCase() !== consultantEmail.toLowerCase()
    ) {
      throw new Error("That company is already managed by another account.");
    }

    const { data, error } = await supabase
      .from("companies")
      .update({
        name: companyName,
        managed_by_email: consultantEmail,
        invited_at: invitedAt,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Could not update the client workspace: ${error?.message}`);
    }
    return data as CompanyRow;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      email: clientEmail,
      name: companyName,
      managed_by_email: consultantEmail,
      invited_at: invitedAt,
      field_sources: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Could not create the client workspace: ${error?.message}`);
  }
  return data as CompanyRow;
}

export async function markCompanyInvitationAccepted(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ accepted_at: new Date().toISOString() })
    .ilike("email", emailPattern(email))
    .is("accepted_at", null);

  if (error) {
    console.warn(`Could not mark invitation accepted: ${error.message}`);
  }
}

export async function getCompanyForEmail(
  email: string,
): Promise<CompanyRow | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .ilike("email", emailPattern(email))
    .maybeSingle();

  if (error) {
    console.warn(`Could not read the company profile: ${error.message}`);
    return null;
  }

  return (data as CompanyRow | null) ?? null;
}

export type ProfileInput = {
  name: string;
  website: string | null;
  home_state: string | null;
  operating_states: string[] | null;
  trade: string | null;
  headcount_band: string | null;
  platforms: string | null;
  hiring_clients: string[] | null;
  operations: string | null;
};

/**
 * Creates or updates the profile for an address.
 *
 * Everything written here was typed by the contractor, so any provenance entry
 * for a field they have just filled in is cleared: once they have typed it
 * themselves, it is no longer something we inferred and no longer needs
 * confirming. Leaving a stale "inferred" marker would keep asking them about a
 * value they had already answered.
 */
export async function saveCompanyForEmail(
  email: string,
  input: ProfileInput,
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const existing = await getCompanyForEmail(email);

  const sources: Record<string, FieldProvenance> = {
    ...(existing?.field_sources ?? {}),
  };

  for (const field of PROFILE_FIELDS) {
    const value = input[field as keyof ProfileInput];
    const filledIn = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (filledIn) delete sources[field];
  }

  if (existing) {
    const { error } = await supabase
      .from("companies")
      .update({ ...input, field_sources: sources })
      .eq("id", existing.id);

    if (error) throw new Error(`Could not save your company: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from("companies")
    .insert({ ...input, email, field_sources: sources });

  if (error) throw new Error(`Could not save your company: ${error.message}`);
}

/**
 * Records that the contractor confirmed an inferred value as correct.
 *
 * The entry is kept rather than deleted, with a timestamp: the record should
 * say that this value was inferred and then confirmed, which is a different
 * and weaker thing than a value they volunteered.
 */
export async function confirmField(
  email: string,
  field: ProfileField,
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const existing = await getCompanyForEmail(email);
  if (!existing) return;

  const provenance = existing.field_sources?.[field];
  if (!provenance) return;

  const { error } = await supabase
    .from("companies")
    .update({
      field_sources: {
        ...existing.field_sources,
        [field]: { ...provenance, confirmedAt: new Date().toISOString() },
      },
    })
    .eq("id", existing.id);

  if (error) throw new Error(`Could not confirm that: ${error.message}`);
}
