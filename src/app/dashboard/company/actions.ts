"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace } from "@/lib/workspaces";
import { saveCompanyForEmail, type ProfileInput } from "@/lib/companies";
import {
  HEADCOUNT_BANDS,
  PLATFORMS,
  TRADES,
  US_STATES,
} from "@/lib/intake";

/**
 * Saving the company profile.
 *
 * Written against the signed-in address from the session cookie, never against
 * an address in the form. The profile is keyed by email, so accepting one from
 * the request body would let anyone overwrite anyone else's company by typing
 * their address into a field.
 */

const MAX_NAME = 200;
const MAX_WEBSITE = 300;
const MAX_OPERATIONS = 2000;
const MAX_CLIENTS = 20;

export type ProfileState = {
  status: "editing" | "saved";
  error?: string;
};

/** Only values from our own lists survive. Anything else becomes absent. */
function oneOf(value: string, allowed: readonly string[]): string | null {
  return allowed.includes(value) ? value : null;
}

function text(form: FormData, field: string): string {
  const raw = form.get(field);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function saveCompany(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const name = text(formData, "name");

  if (!name) {
    return { status: "editing", error: "Your company needs a name." };
  }

  if (name.length > MAX_NAME) {
    return {
      status: "editing",
      error: `Keep the name under ${MAX_NAME} characters.`,
    };
  }

  const website = text(formData, "website");
  const operations = text(formData, "operations");

  if (website.length > MAX_WEBSITE || operations.length > MAX_OPERATIONS) {
    return { status: "editing", error: "That's longer than we can store." };
  }

  const states = formData
    .getAll("operating_states")
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => US_STATES.includes(entry as (typeof US_STATES)[number]));

  /*
   * Hiring clients arrive as one textarea, a name per line. A list of plant
   * names is the kind of thing someone pastes out of an email, and asking for
   * a repeating field would have been worse for the audience than splitting on
   * newlines.
   */
  const hiringClients = text(formData, "hiring_clients")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, MAX_CLIENTS);

  const input: ProfileInput = {
    name,
    website: website || null,
    home_state: oneOf(text(formData, "home_state"), US_STATES),
    operating_states: states.length > 0 ? states : null,
    trade: oneOf(text(formData, "trade"), TRADES),
    headcount_band: oneOf(text(formData, "headcount_band"), HEADCOUNT_BANDS),
    platforms: oneOf(text(formData, "platforms"), PLATFORMS),
    hiring_clients: hiringClients.length > 0 ? hiringClients : null,
    operations: operations || null,
  };

  try {
    await saveCompanyForEmail(workspace.email, input);
  } catch (cause) {
    console.error("Could not save the company profile:", cause);
    return {
      status: "editing",
      error: "We couldn't save that. Try again in a moment.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/company");

  return { status: "saved" };
}
