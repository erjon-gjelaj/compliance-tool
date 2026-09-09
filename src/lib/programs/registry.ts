import { EMERGENCY_ACTION_PLAN } from "@/lib/programs/emergency-action-plan";
import { HAZCOM } from "@/lib/programs/hazcom";
import { INCIDENT_REPORTING } from "@/lib/programs/incident-reporting";
import { PPE } from "@/lib/programs/ppe";
import { JOB_SAFETY_ANALYSIS } from "@/lib/programs/job-safety-analysis";
import { SAFETY_TRAINING } from "@/lib/programs/safety-training";
import { DISCIPLINARY } from "@/lib/programs/disciplinary";
import { SAFETY_POLICY } from "@/lib/programs/safety-policy";
import { RECORDKEEPING } from "@/lib/programs/recordkeeping";
import { DRUG_ALCOHOL } from "@/lib/programs/drug-alcohol";
import { LOCKOUT_TAGOUT } from "@/lib/programs/lockout-tagout";
import { CONFINED_SPACE } from "@/lib/programs/confined-space";
import { HOT_WORK } from "@/lib/programs/hot-work";
import { FALL_PROTECTION } from "@/lib/programs/fall-protection";
import { RESPIRATORY } from "@/lib/programs/respiratory";
import { ELECTRICAL_SAFETY } from "@/lib/programs/electrical-safety";
import { SHORT_SERVICE_EMPLOYEE } from "@/lib/programs/short-service-employee";
import { HEAT_ILLNESS } from "@/lib/programs/heat-illness";
import { STOP_WORK } from "@/lib/programs/stop-work";
import { SUBCONTRACTOR_MANAGEMENT } from "@/lib/programs/subcontractor-management";
import { HEARING_CONSERVATION } from "@/lib/programs/hearing-conservation";
import { BLOODBORNE_PATHOGENS } from "@/lib/programs/bloodborne-pathogens";
import { LADDER_SAFETY } from "@/lib/programs/ladder-safety";
import { isOfferable, isTestable, type ProgramTemplate } from "@/lib/programs/types";
import { programConfigByKey } from "@/lib/config";

/**
 * The programme library.
 *
 * Adding a programme is a template file and a line here, with no change to
 * the questionnaire, the validator, the renderers, the storage, or the
 * library UI.
 *
 * Safe to IMPORT from a client component, which is how the questionnaire
 * reads the same definitions the server validates against. It is NOT safe to
 * pass a template through a server/client boundary as a prop: the templates
 * carry functions, and functions cannot be serialised. Pass an id and look it
 * up on the far side.
 */
function withCatalog(template: ProgramTemplate): ProgramTemplate {
  const config = programConfigByKey(template.id);
  if (!config) {
    throw new Error(`Generated program ${template.id} is absent from config`);
  }
  if (!config.template_body_key) {
    throw new Error(`Generated program ${template.id} has no template body key`);
  }

  return {
    ...template,
    title: config.title,
    shortName: config.title,
    release: config.release_state,
  };
}

export const PROGRAMS: ProgramTemplate[] = [
  HAZCOM,
  PPE,
  EMERGENCY_ACTION_PLAN,
  INCIDENT_REPORTING,
  JOB_SAFETY_ANALYSIS,
  SAFETY_TRAINING,
  DISCIPLINARY,
  SAFETY_POLICY,
  RECORDKEEPING,
  DRUG_ALCOHOL,
  LOCKOUT_TAGOUT,
  CONFINED_SPACE,
  HOT_WORK,
  FALL_PROTECTION,
  RESPIRATORY,
  ELECTRICAL_SAFETY,
  SHORT_SERVICE_EMPLOYEE,
  HEAT_ILLNESS,
  STOP_WORK,
  SUBCONTRACTOR_MANAGEMENT,
  HEARING_CONSERVATION,
  BLOODBORNE_PATHOGENS,
  LADDER_SAFETY,
].map(withCatalog);

export function programById(id: string): ProgramTemplate | undefined {
  return PROGRAMS.find((program) => program.id === id);
}

/** What an ordinary customer may generate. */
export function offerablePrograms(): ProgramTemplate[] {
  return PROGRAMS.filter((program) => isOfferable(program.release));
}

/**
 * The programme behind a gap-report finding, if we can prepare one.
 *
 * `requirementId` on the template is the join: the matcher reports a
 * requirement, and this says whether that requirement is something we can
 * produce. A finding with no programme simply has no "prepare this" action.
 */
export function programForRequirement(
  requirementId: string,
): ProgramTemplate | undefined {
  return offerablePrograms().find(
    (program) => program.requirementId === requirementId,
  );
}

/**
 * The programme behind a finding, matched on the requirement's label.
 *
 * A stored review carries the requirement's label, not its id — the schema was
 * designed before generation existed and reviews already in the database
 * cannot grow a field. Matching on the label is therefore the only join
 * available for historical reviews, and it is exact rather than fuzzy: a near
 * match would offer to prepare the wrong programme.
 */
export function programForLabel(label: string) {
  return offerablePrograms().find(
    (program) => program.matchesLabel?.(label) ?? false,
  );
}

export { isOfferable, isTestable };
