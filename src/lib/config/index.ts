import elementSetsJson from "../../../config/element-sets.json";
import programsJson from "../../../config/programs.json";
import questionnairesJson from "../../../config/questionnaires.json";
import rejectionCodesJson from "../../../config/rejection-codes.json";
import requirementsJson from "../../../config/requirements.json";
import evidenceRequirementsJson from "../../../config/evidence-requirements.json";
import {
  elementSetFileSchema,
  evidenceRequirementFileSchema,
  programFileSchema,
  questionnaireFileSchema,
  rejectionFileSchema,
  requirementFileSchema,
} from "@/lib/config/schema";

export type {
  ElementSetConfig,
  ProgramConfig,
  QuestionnaireConfig,
  RejectionCodeConfig,
  RequirementConfig,
  EvidenceRequirementConfig,
} from "@/lib/config/schema";

const programFile = programFileSchema.parse(programsJson);
const elementSetFile = elementSetFileSchema.parse(elementSetsJson);
const questionnaireFile = questionnaireFileSchema.parse(questionnairesJson);
const rejectionFile = rejectionFileSchema.parse(rejectionCodesJson);
const requirementFile = requirementFileSchema.parse(requirementsJson);
const evidenceRequirementFile =
  evidenceRequirementFileSchema.parse(evidenceRequirementsJson);

function unique(values: string[], label: string): void {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${label}: ${[...new Set(duplicates)].join(", ")}`);
  }
}

unique(programFile.records.map((entry) => entry.program_key), "program key");
unique(
  elementSetFile.records.map((entry) => entry.element_set_key),
  "element set key",
);
unique(
  questionnaireFile.records.map((entry) => entry.questionnaire_schema_key),
  "questionnaire key",
);
unique(rejectionFile.records.map((entry) => entry.code), "rejection code");
unique(requirementFile.records.map((entry) => entry.id), "requirement id");
unique(
  evidenceRequirementFile.records.map((entry) => entry.requirement_key),
  "evidence requirement key",
);

const programKeys = new Set(programFile.records.map((entry) => entry.program_key));
const elementSetKeys = new Set(
  elementSetFile.records.map((entry) => entry.element_set_key),
);
const questionnaireKeys = new Set(
  questionnaireFile.records.map((entry) => entry.questionnaire_schema_key),
);

for (const program of programFile.records) {
  for (const elementSetKey of program.required_element_set_keys) {
    if (!elementSetKeys.has(elementSetKey)) {
      throw new Error(
        `Program ${program.program_key} references unknown element set ${elementSetKey}`,
      );
    }
  }
  if (
    program.questionnaire_schema_key &&
    !questionnaireKeys.has(program.questionnaire_schema_key)
  ) {
    throw new Error(
      `Program ${program.program_key} references unknown questionnaire ${program.questionnaire_schema_key}`,
    );
  }
}

for (const set of elementSetFile.records) {
  if (set.scope === "universal" && set.program_key !== null) {
    throw new Error("The universal element set cannot reference one program");
  }
  if (
    set.scope === "program_specific" &&
    (!set.program_key || !programKeys.has(set.program_key))
  ) {
    throw new Error(
      `Element set ${set.element_set_key} does not reference a known program`,
    );
  }
  unique(
    set.elements.map((element) => `${set.element_set_key}.${element.element_key}`),
    "element key",
  );
}

for (const questionnaire of questionnaireFile.records) {
  if (!programKeys.has(questionnaire.program_key)) {
    throw new Error(
      `Questionnaire ${questionnaire.questionnaire_schema_key} references unknown program ${questionnaire.program_key}`,
    );
  }
}

export const CONFIG_RELEASE = "2026-07-30.1";
export const PROGRAM_CATALOG = programFile.records;
export const ELEMENT_SETS = elementSetFile.records;
export const QUESTIONNAIRES = questionnaireFile.records;
export const REJECTION_CODES = rejectionFile.records;
export const REQUIREMENT_CONFIG = requirementFile.records;
export const EVIDENCE_REQUIREMENTS = evidenceRequirementFile.records;

export function programConfigByKey(key: string) {
  return PROGRAM_CATALOG.find(
    (entry) => entry.program_key === key || entry.legacy_ids.includes(key),
  );
}

export function rejectionCodeByCode(code: string) {
  return REJECTION_CODES.find((entry) => entry.code === code);
}
