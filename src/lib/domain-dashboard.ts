import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { CONFIG_RELEASE } from "@/lib/config";
import {
  generateRequirementSet,
  type RequirementInput,
} from "@/lib/requirements/generation";

export type FileRequirement = {
  id: string;
  category_key: string;
  requirement_key: string;
  title: string;
  status: string;
  applicability: "included" | "unknown";
  due_date: string | null;
};

export async function listCurrentRequirements(
  companyId: string,
): Promise<FileRequirement[]> {
  const supabase = getSupabaseAdminClient();
  const { data: set } = await supabase
    .from("requirement_sets")
    .select("id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!set) return [];
  const { data, error } = await supabase
    .from("requirements")
    .select(
      "id, category_key, requirement_key, title, status, applicability, due_date",
    )
    .eq("requirement_set_id", set.id)
    .order("category_key")
    .order("title");
  if (error) throw new Error(`Could not list requirements: ${error.message}`);
  return (data ?? []) as FileRequirement[];
}

export async function regenerateRequirements({
  input,
  cause,
}: {
  input: RequirementInput;
  cause: "profile_change" | "msq_change" | "hiring_client_change" | "manual";
}): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: previous } = await supabase
    .from("requirement_sets")
    .select("id")
    .eq("company_id", input.companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const requirements = generateRequirementSet(input);
  const { data: set, error } = await supabase
    .from("requirement_sets")
    .insert({
      company_id: input.companyId,
      hiring_client_id: input.hiringClientId,
      config_release: CONFIG_RELEASE,
      generation_input: input,
      generation_cause: cause,
      supersedes_id: previous?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !set) {
    throw new Error(`Could not create requirement set: ${error?.message}`);
  }
  const { error: requirementError } = await supabase
    .from("requirements")
    .insert(
      requirements.map((requirement) => ({
        requirement_set_id: set.id,
        category_key: requirement.categoryKey,
        requirement_key: requirement.requirementKey,
        title: requirement.title,
        status: requirement.status,
        applicability: requirement.applicability,
        applicability_basis: requirement.applicabilityBasis,
      })),
    );
  if (requirementError) {
    throw new Error(`Could not save requirements: ${requirementError.message}`);
  }
  return set.id;
}

export async function listInsuranceCoverages(companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("insurance_coverages")
    .select(
      "id, coverage_type, carrier, policy_number, eff_date, exp_date, each_occurrence, general_aggregate, additional_insured, waiver_of_subrogation",
    )
    .in(
      "document_id",
      (
        await supabase
          .from("submission_documents")
          .select("id, submissions!inner(company_id)")
          .eq("submissions.company_id", companyId)
      ).data?.map((entry) => entry.id) ?? [],
    );
  if (error) return [];
  return data ?? [];
}

export async function listSafetyStatistics(companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("safety_statistics")
    .select("*")
    .eq("company_id", companyId)
    .order("report_year", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function listTrainingRecords(companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("training_records")
    .select("*")
    .eq("company_id", companyId)
    .order("training_date", { ascending: false });
  if (error) return [];
  return data ?? [];
}
