import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AnswerKeyItem } from "@/lib/programs/answer-key";
import type { ElementResult } from "@/lib/programs/element-scoring";

export type AssessmentView = {
  id: string;
  program_key: string;
  element_results: ElementResult[];
  answer_key: {
    id: string;
    verification_state: string;
    items: AnswerKeyItem[];
  } | null;
};

function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listAssessmentsForSubmission(
  email: string,
  submissionId: string,
): Promise<AssessmentView[]> {
  const supabase = getSupabaseAdminClient();
  const { data: documents } = await supabase
    .from("submission_documents")
    .select("id, submissions!inner(email)")
    .eq("submission_id", submissionId)
    .ilike("submissions.email", emailPattern(email));
  const ids = documents?.map((entry) => entry.id) ?? [];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("program_assessments")
    .select("id, program_key, element_results, answer_keys(id, verification_state, items)")
    .in("document_id", ids);
  if (error) return [];
  return (data ?? []).map((entry) => ({
    id: entry.id,
    program_key: entry.program_key,
    element_results: entry.element_results as ElementResult[],
    answer_key:
      Array.isArray(entry.answer_keys) && entry.answer_keys[0]
        ? {
            id: entry.answer_keys[0].id,
            verification_state: entry.answer_keys[0].verification_state,
            items: entry.answer_keys[0].items as AnswerKeyItem[],
          }
        : null,
  }));
}

export async function answerKeyForEmail(
  email: string,
  answerKeyId: string,
): Promise<{
  programKey: string;
  items: AnswerKeyItem[];
  companyName: string;
} | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("answer_keys")
    .select(
      "program_key, items, program_assessments!inner(submission_documents!inner(submissions!inner(email, company_id)))",
    )
    .eq("id", answerKeyId)
    .ilike(
      "program_assessments.submission_documents.submissions.email",
      emailPattern(email),
    )
    .maybeSingle();
  if (error || !data) return null;
  const relation = data.program_assessments as unknown as {
    submission_documents: { submissions: { company_id: string | null } };
  };
  const companyId = relation.submission_documents.submissions.company_id;
  let companyName = "Contractor";
  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    if (company?.name) companyName = company.name;
  }
  return {
    programKey: data.program_key,
    items: data.items as AnswerKeyItem[],
    companyName,
  };
}
