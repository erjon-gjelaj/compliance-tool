import { z } from "zod";

const key = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const provenanceSchema = z.object({
  source_kind: z.enum(["domain_spec", "live_account"]),
  source_ref: z.string().min(1),
  source_date: z.string().nullable(),
  verification_state: z.enum([
    "unknown",
    "needs_live_account",
    "consultancy_only",
    "verified_live_account",
  ]),
  verified_at: z.string().nullable(),
  verification_note: z.string().nullable(),
});

const fileHeader = {
  schema_version: z.string().min(1),
  content_version: z.string().min(1),
  effective_from: z.string().min(1),
  supersedes: z.string().nullable(),
  provenance: provenanceSchema,
};

export const predicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("always") }),
    z.object({ op: z.literal("field_present"), field: key }),
    z.object({
      op: z.literal("field_equals"),
      field: key,
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    z.object({ op: z.literal("field_includes"), field: key, value: z.string() }),
    z.object({ op: z.literal("number_gte"), field: key, value: z.number() }),
    z.object({ op: z.literal("number_gt"), field: key, value: z.number() }),
    z.object({ op: z.literal("all"), predicates: z.array(predicateSchema).min(1) }),
    z.object({ op: z.literal("any"), predicates: z.array(predicateSchema).min(1) }),
    z.object({ op: z.literal("not"), predicate: predicateSchema }),
    z.object({ op: z.literal("unknown"), reason: z.string().min(1) }),
  ]),
);

export type Predicate =
  | { op: "always" }
  | { op: "field_present"; field: string }
  | {
      op: "field_equals";
      field: string;
      value: string | number | boolean;
    }
  | { op: "field_includes"; field: string; value: string }
  | { op: "number_gte" | "number_gt"; field: string; value: number }
  | { op: "all" | "any"; predicates: Predicate[] }
  | { op: "not"; predicate: Predicate }
  | { op: "unknown"; reason: string };

export const programFileSchema = z.object({
  ...fileHeader,
  records: z.array(
    z.object({
      program_key: key,
      legacy_ids: z.array(z.string()),
      title: z.string().min(1),
      tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      citations: z.array(z.string()),
      triggered_by: predicateSchema,
      required_element_set_keys: z.array(key).min(1),
      questionnaire_schema_key: key.nullable(),
      template_body_key: key.nullable(),
      release_state: z.enum([
        "development",
        "internal_testing",
        "release_candidate",
        "customer_available",
        "paused",
      ]),
    }),
  ),
});

const elementSchema = z.object({
  element_key: key,
  title: z.string().min(1),
  evidence_description: z.string().min(1),
});

export const elementSetFileSchema = z.object({
  ...fileHeader,
  records: z.array(
    z.object({
      element_set_key: key,
      program_key: key.nullable(),
      scope: z.enum(["universal", "program_specific"]),
      completeness: z.enum(["complete_from_spec", "non_exhaustive", "unknown"]),
      elements: z.array(elementSchema).min(1),
    }),
  ),
});

export const questionnaireFileSchema = z.object({
  ...fileHeader,
  records: z.array(
    z.object({
      questionnaire_schema_key: key,
      program_key: key,
      version: z.string().min(1),
      completeness: z.enum(["complete_from_spec", "approximate", "unknown"]),
      questions: z.array(
        z.object({
          question_key: key,
          prompt: z.string().min(1),
          response_type: z.enum([
            "boolean",
            "choice",
            "text",
            "number",
            "string_array",
          ]),
          required: z.boolean(),
        }),
      ),
    }),
  ),
});

export const rejectionFileSchema = z.object({
  ...fileHeader,
  records: z.array(
    z.object({
      code: z.string().regex(/^R(0[1-9]|1[0-5])$/),
      cause: z.string().min(1),
      fix_path: z.string().min(1),
      target_subsystem: z.enum([
        "program",
        "answer_key",
        "questionnaire",
        "emr",
        "statistics",
        "recordkeeping",
        "insurance",
        "training",
      ]),
      public_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      action_key: key,
      recognition_terms: z.array(z.string()),
    }),
  ),
});

export const requirementFileSchema = z.object({
  ...fileHeader,
  records: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      label: z.string().min(1),
      source: z.enum(["osha", "platform", "hiring_client"]),
      verified: z.boolean(),
      trades: z.union([z.literal("all"), z.array(z.string())]),
      platforms: z.union([z.literal("all"), z.array(z.string())]),
      checklist: z.string().optional(),
      phrases: z.array(z.string()).min(1),
      action: z.string().min(1),
    }),
  ),
});

export const evidenceRequirementFileSchema = z.object({
  ...fileHeader,
  records: z.array(
    z.object({
      requirement_key: z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/),
      category_key: z.enum([
        "statistics",
        "recordkeeping",
        "insurance",
        "questionnaire",
        "training",
      ]),
      title: z.string().min(1),
      triggered_by: predicateSchema,
    }),
  ),
});

export type ProgramConfig = z.infer<typeof programFileSchema>["records"][number];
export type ElementSetConfig = z.infer<
  typeof elementSetFileSchema
>["records"][number];
export type QuestionnaireConfig = z.infer<
  typeof questionnaireFileSchema
>["records"][number];
export type RejectionCodeConfig = z.infer<
  typeof rejectionFileSchema
>["records"][number];
export type RequirementConfig = z.infer<
  typeof requirementFileSchema
>["records"][number];
export type EvidenceRequirementConfig = z.infer<
  typeof evidenceRequirementFileSchema
>["records"][number];
