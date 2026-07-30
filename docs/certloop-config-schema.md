# CertLoop config schema

Status: implemented configuration contract. Runtime validation and typed readers
live in `src/lib/config/`.

Source of truth: `docs/certloop-domain-spec.md` sections 3, 4, and 11. The
spec's platform content is consultancy-derived and must not be represented as
official ISNetworld or Avetta guidance until verified against a live account.

## File set

```text
config/
  manifest.json
  categories.json
  platforms.json
  predicate-fields.json
  programs.json
  element-sets.json
  questionnaires.json
  rejection-codes.json
  requirements.json
  evidence-requirements.json
  glossary.json
```

Every file is data only. It may contain JSON primitives, arrays, and objects;
it may not contain functions, regular expressions, imported values, or
executable predicate strings.

## Shared primitives

```ts
type StableKey = string; // lowercase snake_case; immutable after publication
type IsoDate = string;   // YYYY-MM-DD

type VerificationState =
  | "unknown"
  | "needs_live_account"
  | "consultancy_only"
  | "verified_live_account";

type KnowledgeState =
  | "known"
  | "unknown"
  | "not_applicable";

type Provenance = {
  source_kind: "domain_spec" | "live_account";
  source_ref: string;
  source_date: IsoDate | null;
  verification_state: VerificationState;
  verified_at: IsoDate | null;
  verification_note: string | null;
};

type ConfigFile<T> = {
  schema_version: string;
  content_version: string;
  effective_from: IsoDate;
  supersedes: string | null;
  provenance: Provenance;
  records: T[];
};
```

`null` means no value is known. It never means zero, false, empty, or
not-applicable. `unknown` is explicit wherever a decision depends on missing
platform or hiring-client information.

## Manifest

```ts
type ConfigManifest = {
  schema_version: string;
  release_id: string;
  effective_from: IsoDate;
  files: Array<{
    key:
      | "categories"
      | "platforms"
      | "predicate_fields"
      | "programs"
      | "element_sets"
      | "questionnaires"
      | "rejection_codes"
      | "requirements"
      | "evidence_requirements"
      | "glossary";
    path: string;
    content_version: string;
  }>;
};
```

The manifest pins the files and content versions that form one config release,
so readers do not silently combine incompatible versions.

## Categories and platforms

```ts
type EvidenceCategory = {
  category_key:
    | "written_programs"
    | "statistics"
    | "recordkeeping"
    | "insurance"
    | "questionnaire"
    | "training";
  ordinal: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  platform_labels: Record<StableKey, string | null>;
  provenance: Provenance;
};

type Platform = {
  platform_key: StableKey;
  title: string;
  support_state: "supported" | "planned" | "unknown";
  grade_weighting: {
    state: KnowledgeState;
    value: number | null;
    unit: "percent" | null;
    hiring_client_key: StableKey | null;
    provenance: Provenance;
  };
  aliases: string[];
  provenance: Provenance;
};
```

`grade_weighting.value` defaults to `null` and its state to `unknown`. Phase 1
does not define any predicted-grade output or grade calculation.

## Declarative trigger predicates

```ts
type Predicate =
  | { op: "always" }
  | { op: "field_present"; field: StableKey }
  | { op: "field_equals"; field: StableKey; value: string | number | boolean }
  | { op: "field_includes"; field: StableKey; value: string }
  | { op: "number_gte"; field: StableKey; value: number }
  | { op: "number_gt"; field: StableKey; value: number }
  | { op: "all"; predicates: Predicate[] }
  | { op: "any"; predicates: Predicate[] }
  | { op: "not"; predicate: Predicate }
  | {
      op: "unknown";
      reason: string;
      verification_state: VerificationState;
    };

type PredicateField = {
  field_key: StableKey;
  source_entity: "company" | "trade" | "scope" | "platform" | "hiring_client";
  value_type: "boolean" | "number" | "string" | "string_array";
  allowed_values: string[] | null;
  provenance: Provenance;
};
```

Words such as “almost always,” “commonly requested,” and “industrial sites”
do not become invented booleans. They use the `unknown` predicate until a
live-account rule or an explicit company-profile fact can resolve them.

## Program catalog

```ts
type CitationRef = {
  citation_text: string;
  citation_key: StableKey | null;
  provenance: Provenance;
};

type ProgramCatalogEntry = {
  program_key: StableKey;
  legacy_ids: string[];
  title: string;
  short_title: string | null;
  tier: 1 | 2 | 3;
  evidence_category_key: "written_programs";
  citations: CitationRef[];
  triggered_by: Predicate;
  required_element_set_keys: StableKey[];
  questionnaire_schema_key: StableKey | null;
  template_body_key: StableKey | null;
  catalog_completeness: "complete_from_spec" | "non_exhaustive" | "unknown";
  release_state:
    | "development"
    | "internal_testing"
    | "release_candidate"
    | "customer_available"
    | "paused";
  provenance: Provenance;
};
```

Citation text is copied only when the domain spec supplies it. Phase 1 does
not add or “correct” citations from outside the spec. Existing generated
program code remains joined through `program_key` or `legacy_ids`; functions
do not move into config.

## Required element sets

```ts
type ElementApplicability = {
  state: "required" | "conditional" | "unknown";
  predicate: Predicate | null;
};

type RequiredElement = {
  element_key: StableKey;
  title: string;
  evidence_description: string;
  applicability: ElementApplicability;
  questionnaire_question_keys: StableKey[];
  aliases: string[];
  provenance: Provenance;
};

type RequiredElementSet = {
  element_set_key: StableKey;
  program_key: StableKey | null; // null only for the universal set
  scope: "universal" | "program_specific";
  completeness: "complete_from_spec" | "non_exhaustive" | "unknown";
  elements: RequiredElement[];
  provenance: Provenance;
};
```

There are no score weights or matching rules in these records. The later
scoring phase produces `present | weak | missing` plus page evidence; phase 1
only defines what may be evaluated.

## Questionnaire schemas

```ts
type QuestionnaireQuestion = {
  question_key: StableKey;
  prompt: string;
  help: string | null;
  response_type: "boolean" | "choice" | "text" | "number" | "string_array";
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  show_when: Predicate | null;
  profile_prefill_field: StableKey | null;
  provenance: Provenance;
};

type QuestionnaireSchema = {
  questionnaire_schema_key: StableKey;
  program_key: StableKey;
  version: string;
  completeness: "complete_from_spec" | "approximate" | "unknown";
  questions: QuestionnaireQuestion[];
  provenance: Provenance;
};
```

An approximate platform question set is labeled approximate; it is never
presented as an official ISN or Avetta questionnaire.

## Rejection taxonomy

```ts
type RejectionCode = {
  code:
    | "R01" | "R02" | "R03" | "R04" | "R05"
    | "R06" | "R07" | "R08" | "R09" | "R10"
    | "R11" | "R12" | "R13" | "R14" | "R15";
  cause: string;
  fix_path: string;
  target_subsystem:
    | "program"
    | "answer_key"
    | "questionnaire"
    | "emr"
    | "statistics"
    | "recordkeeping"
    | "insurance"
    | "training";
  public_slug: string;
  action_key: StableKey;
  recognition_terms: string[];
  provenance: Provenance;
};
```

The separate runtime classifier result must be `R01` through `R15` or
`unknown`; ambiguous pasted feedback cannot be forced into a configured code.

## Validation invariants

- All stable keys and rejection codes are unique.
- Every cross-file key resolves in the same manifest release.
- A universal element set has `program_key: null`; a program-specific set
  references exactly one real program.
- Unknown numeric values are `null`, never `0`.
- Unverified facts carry a non-verified `verification_state`.
- Declarative predicates reference registered predicate fields and match
  their value types.
- Config contains no function-like or executable values.
- No record contains predicted-grade, compliance-determination, guaranteed
  approval, testimonial, customer-logo, stat-counter, checkout, Stripe, or
  payment-processor fields.
- All consultancy-derived records requiring portal confirmation are copied
  into `VERIFY.md` during phase-1 cutover.
