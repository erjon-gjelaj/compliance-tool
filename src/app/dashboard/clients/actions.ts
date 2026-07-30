"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SITE_URL } from "@/lib/constants";
import {
  getCompanyForEmail,
  inviteManagedCompany,
} from "@/lib/companies";
import { can, planOf } from "@/lib/entitlements";
import {
  COMPANY_INVITE_TTL_SECONDS,
  normaliseEmail,
  signToken,
} from "@/lib/auth/tokens";
import { currentClient } from "@/lib/auth/session";
import { notifyClientInvitation } from "@/lib/notify";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type ClientState = {
  status: "editing" | "sent" | "saved";
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export async function inviteClient(
  _previous: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const consultant = await getCompanyForEmail(session.email);
  if (!can(planOf(consultant), "multiple_companies")) {
    return { status: "editing", error: "Client workspaces aren't available." };
  }

  const name = String(formData.get("company_name") ?? "").trim();
  const email = normaliseEmail(String(formData.get("client_email") ?? ""));

  if (!name || name.length > 200) {
    return { status: "editing", error: "Give the client company name." };
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { status: "editing", error: "Give a working client email address." };
  }
  if (email.toLowerCase() === session.email.toLowerCase()) {
    return { status: "editing", error: "Use the client's email, not your own." };
  }

  try {
    await inviteManagedCompany({
      consultantEmail: session.email,
      clientEmail: email,
      companyName: name,
    });

    const token = await signToken(email, "company-invite");
    const url = `${SITE_URL}/invite/verify?token=${encodeURIComponent(token)}`;
    const sent = await notifyClientInvitation({
      email,
      companyName: name,
      consultantName: consultant?.consultant_brand_name || consultant?.name || session.email,
      url,
      days: COMPANY_INVITE_TTL_SECONDS / (24 * 60 * 60),
    });

    if (!sent) {
      return {
        status: "editing",
        error:
          "The workspace was created, but the invitation email could not be sent. Try again.",
      };
    }
  } catch (cause) {
    console.error("Could not invite client:", cause);
    return { status: "editing", error: "We couldn't create that workspace." };
  }

  revalidatePath("/dashboard/clients");
  return { status: "sent" };
}

export async function saveConsultantBrand(
  _previous: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const consultant = await getCompanyForEmail(session.email);
  if (!can(planOf(consultant), "white_label") || !consultant) {
    return { status: "editing", error: "Export branding isn't available." };
  }

  const brand = String(formData.get("brand_name") ?? "").trim();
  if (!brand || brand.length > 120) {
    return { status: "editing", error: "Keep the brand name between 1 and 120 characters." };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ consultant_brand_name: brand })
    .eq("id", consultant.id);

  if (error) {
    return { status: "editing", error: "We couldn't save that brand name." };
  }

  revalidatePath("/dashboard/clients");
  return { status: "saved" };
}
