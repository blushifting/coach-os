/**
 * État local du wizard d'onboarding (Conv #4b, refonte Conv #28).
 *
 * `OnboardingDraft` = state mutable manipulé par OnboardingPage.tsx pendant
 * les 4 étapes. À la fin, on dérive :
 *   - un `Profile` via `buildProfile()`
 *   - un `Record<string, MuscleGoal>` final via `buildMuscleGoals()`
 *
 * Le moteur (`engine.startUser`) est appelé une seule fois, à la validation
 * finale, avec `applyBalance: false` puisqu'on a déjà arbitré les SUGGERE
 * via la popin d'équilibre de l'étape 2.
 */

import {
  DurationCategory,
  EquipmentPreference,
  GymBrand,
  Level,
  MuscleObjective,
  MuscleStatus,
  Objective,
  Sex,
  makeMuscleGoal,
  makeProfile,
  type MuscleGoal,
  type Profile,
  type UserState,
} from '@/engine/models';
import { applyBalanceRules } from '@/engine/balance';

export interface RankedPriority {
  readonly muscle: string;
  readonly objective: MuscleObjective;
}

export interface OnboardingDraft {
  // Étape 1 : profil
  readonly sex: Sex;
  readonly age: number;
  readonly bodyweightKg: number;
  readonly level: Level;
  readonly sessionsPerWeek: number;
  /** Codes du catalogue exercises.json — voir EQUIPMENT_OPTIONS. */
  readonly equipment: ReadonlySet<string>;

  // Étape 2 : muscles prioritaires (dans l'ordre du ranking ; l'ordre de
  // sélection fait office de rang, réordonnable dans la liste)
  readonly priorities: readonly RankedPriority[];

  // Étape 2 : muscles en entretien (peints « Maintien » ou acceptés via la
  // popin d'équilibre R1-R4). Statut final = SUGGERE / MAINTIEN / rank 99.
  readonly maintenance: ReadonlySet<string>;

  // Étape 3 : choix programme
  /** `null` = mode custom (pas de programme guidé). */
  readonly programmeId: string | null;
  /**
   * Bloc O — mode de construction du programme :
   *  - `'auto'`   : le moteur remplit (sur-mesure).
   *  - `'manual'` : grille vide, l'utilisateur remplit lui-même (jours nus +
   *    jauges de volume). Default : `'auto'`.
   */
  readonly buildMode: 'auto' | 'manual';
  /**
   * Conv #22 — durée MAX par séance (plafond patterns/séance).
   * Sert au nouveau path co-construit (mode custom seulement).
   * Default : MEDIUM (≤ 1h30).
   */
  readonly durationCategory: DurationCategory;
  /**
   * Conv #22 — Préférence d'équipement (machines / poids libres / aucune).
   * Sert au tri auto des exos à l'onboarding.
   */
  readonly equipmentPreference: EquipmentPreference;
  /**
   * Conv #23 — Marque dominante de la salle. Affecte uniquement les
   * intitulés affichés des exos machine. Default : NONE.
   */
  readonly gymBrand: GymBrand;
  /**
   * Conv #22 — exos choisis par l'user lorsqu'il swap dans le récap final.
   * Clé = `${dayIdx}:${cellIdx}`, valeur = `exercise_id`. Vide tant que
   * l'user n'a pas modifié les exos auto-pickés. En mode guidé : non utilisé.
   */
  readonly chosenVariantsPerCell: Readonly<Record<string, string>>;
}

// =============================================================================
// Préset par défaut (étape 2 garde-fou : "Préset par défaut")
// =============================================================================

/**
 * Préset full-body « réfléchi » (Bloc O).
 *
 * 5 prios Hypertrophie qui couvrent les grands patterns (poussée H, tirage V,
 * squat, charnière/hinge, élévations) + un maintien CIBLÉ (6 muscles), pas
 * « tous les autres ». Le reste (trapèzes hauts, mollets, obliques, lombaires)
 * est volontairement ABSENT : il est couvert par proxy via les
 * polyarticulaires, sans forcer d'isolation inutile. La silhouette n'est donc
 * plus pleine, mais le programme est honnête.
 *
 * Choix sourcés :
 *  - ~10-12 séries/sem directes par muscle (Schoenfeld 2017, V_min) n'est
 *    tenable que sur ~4-5 muscles dans un budget 3 séances × 1h30 → 5 prios.
 *  - Ischios en prio (Bloc O) : équilibre la chaîne postérieure, absente des
 *    prios « tout quad » d'avant.
 *  - Maintien ciblé : dos épaisseur (tirage H/posture), fessiers (proxy
 *    squat+hinge déjà fort), biceps (isolation-only au catalogue), triceps
 *    (équilibre pressing), deltos postérieurs (équilibre vs deltos antérieurs),
 *    abdos (gainage léger).
 *  - Absents couverts par proxy (Gentil et al. 2013) : trapèzes hauts
 *    (soulevé/tirages), mollets (optionnel), obliques (gainage des
 *    polyarticulaires), lombaires (squat/hinge déjà très sollicitants).
 *
 * NB : avec ce préset, R3 (core) suggérerait `lombaires` (absent) → la popin
 * d'équilibre est pré-déclinée à l'application du préset (cf. `balanceKeyOf` +
 * `onPresetApplied` dans OnboardingPage), sans repasser lombaires en maintien.
 */
export const PRESET_DEFAULT_PRIORITIES: readonly RankedPriority[] = [
  { muscle: 'pectoraux', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'dos_largeur', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'quadriceps', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'ischios', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'deltos_lateraux', objective: MuscleObjective.HYPERTROPHIE },
];

/** Maintien ciblé du préset full-body (6 muscles, pas « tous les autres »). */
export const PRESET_DEFAULT_MAINTENANCE: ReadonlySet<string> = new Set([
  'dos_epaisseur',
  'fessiers',
  'biceps',
  'triceps',
  'deltos_posterieurs',
  'abdos',
]);

// =============================================================================
// Construction de l'état initial
// =============================================================================

/** État initial vide — utilisé par OnboardingPage au mount. */
export function makeInitialDraft(): OnboardingDraft {
  return {
    sex: Sex.HOMME,
    age: 30,
    bodyweightKg: 75,
    // Conv #22 — niveau retiré de l'UI (auto-calibration cycle après cycle).
    // Default INTERMEDIAIRE = milieu juste pour les V_min/V_max init.
    level: Level.INTERMEDIAIRE,
    sessionsPerWeek: 3,
    // Conv #22 — équipement retiré de l'UI. Default = salle complète pour
    // que `fitGuidedProgram` (mode guidé) trouve tous les exos canoniques.
    // Le mode custom co-construit n'utilise plus ce filtre.
    equipment: new Set<string>(EQUIPMENT_PRESET_FULL_GYM),
    priorities: [],
    maintenance: new Set<string>(),
    programmeId: null,
    buildMode: 'auto',
    durationCategory: DurationCategory.MEDIUM,
    equipmentPreference: EquipmentPreference.NO_PREFERENCE,
    gymBrand: GymBrand.NONE,
    chosenVariantsPerCell: {},
  };
}

/**
 * Conv #18 — initialise un draft depuis `UserState` pour le mode "partial
 * restart" : l'utilisateur revient sur l'onboarding (Step2→5) pour modifier
 * ses priorités / programme. On préserve les choix existants comme point
 * de départ.
 */
export function draftFromUserState(state: UserState): OnboardingDraft {
  const priorities: RankedPriority[] = [];
  const maintenance = new Set<string>();
  for (const g of Object.values(state.muscle_goals)) {
    if (g.status === MuscleStatus.PRIORITAIRE) {
      // Conv #28 — un PRIORITAIRE/MAINTIEN hérité des anciennes convs est
      // remappé sur le nouvel état « entretien » unique.
      if (g.objective === MuscleObjective.MAINTIEN) {
        maintenance.add(g.muscle);
      } else {
        priorities.push({ muscle: g.muscle, objective: g.objective });
      }
    } else if (g.status === MuscleStatus.SUGGERE) {
      maintenance.add(g.muscle);
    }
  }
  priorities.sort((a, b) => {
    const ra = state.muscle_goals[a.muscle]?.priority_rank ?? 99;
    const rb = state.muscle_goals[b.muscle]?.priority_rank ?? 99;
    return ra - rb;
  });
  return {
    sex: state.profile.sex,
    age: state.profile.age,
    bodyweightKg: state.profile.bodyweight_kg,
    level: state.profile.level,
    sessionsPerWeek: state.profile.sessions_per_week,
    equipment: new Set(state.profile.available_equip),
    priorities,
    maintenance,
    programmeId: state.active_guided_program_id,
    buildMode: state.build_mode ?? 'auto',
    durationCategory:
      state.profile.duration_category ?? DurationCategory.MEDIUM,
    equipmentPreference:
      state.profile.equipment_preference ?? EquipmentPreference.NO_PREFERENCE,
    gymBrand: state.profile.gym_brand ?? GymBrand.NONE,
    chosenVariantsPerCell: {},
  };
}

// =============================================================================
// Popin d'équilibre : calcul des suggestions R1-R4
// =============================================================================

/**
 * À partir des PRIORITAIRE + maintiens de l'étape 2, calcule la liste des
 * muscles SUGGERE par R1-R4 (fonction pure de `balance.ts`). Les muscles
 * déjà en entretien sont vus comme couverts → seuls les vrais trous sortent.
 */
/**
 * Clé stable d'une sélection muscles (prios + maintien). Sert à mémoriser un
 * refus de la popin d'équilibre (pas de re-popin tant que la sélection ne
 * change pas) et à pré-décliner la popin quand on applique un préset.
 * Factorisé ici pour que OnboardingPage et Step2Muscles produisent EXACTEMENT
 * la même clé.
 */
export function balanceKeyOf(
  priorities: readonly RankedPriority[],
  maintenance: ReadonlySet<string>,
): string {
  return JSON.stringify({
    prios: priorities.map((p) => `${p.muscle}:${p.objective}`),
    maintenance: [...maintenance].sort(),
  });
}

export function computeBalanceSuggestions(
  priorities: readonly RankedPriority[],
  maintenance: ReadonlySet<string> = new Set(),
): MuscleGoal[] {
  const goals: Record<string, MuscleGoal> = {};
  priorities.forEach((p, i) => {
    goals[p.muscle] = makeMuscleGoal({
      muscle: p.muscle,
      objective: p.objective,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: i + 1,
    });
  });
  for (const m of maintenance) {
    if (goals[m] !== undefined) continue;
    goals[m] = makeMuscleGoal({
      muscle: m,
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.SUGGERE,
      priority_rank: 99,
    });
  }
  return applyBalanceRules(goals);
}

// =============================================================================
// Finalisation : Profile + MuscleGoals à passer à engine.startUser
// =============================================================================

/**
 * Dérive l'`Objective` global (champ legacy de `Profile`) depuis le draft.
 * - Si programme guidé : on ne peut pas l'extraire ici (besoin du GuidedProgram).
 *   L'appelant peut surcharger via le paramètre `override`.
 * - Sinon : `MuscleObjective` majoritaire parmi les PRIORITAIRE, mappé.
 *   `MAINTIEN` n'existe pas au niveau global → fallback `HYPERTROPHIE`.
 */
export function deriveGlobalObjective(
  draft: OnboardingDraft,
  override?: MuscleObjective,
): Objective {
  const source = override ?? majorityMuscleObjective(draft.priorities);
  switch (source) {
    case MuscleObjective.FORCE:
      return Objective.FORCE;
    case MuscleObjective.ENDURANCE:
      return Objective.ENDURANCE;
    case MuscleObjective.HYPERTROPHIE:
    case MuscleObjective.MAINTIEN:
    default:
      return Objective.HYPERTROPHIE;
  }
}

function majorityMuscleObjective(
  priorities: readonly RankedPriority[],
): MuscleObjective {
  if (priorities.length === 0) return MuscleObjective.HYPERTROPHIE;
  const counts = new Map<MuscleObjective, number>();
  for (const p of priorities) {
    counts.set(p.objective, (counts.get(p.objective) ?? 0) + 1);
  }
  let best: MuscleObjective = MuscleObjective.HYPERTROPHIE;
  let bestCount = -1;
  for (const [obj, n] of counts) {
    if (n > bestCount) {
      best = obj;
      bestCount = n;
    }
  }
  return best;
}

export function buildProfile(
  draft: OnboardingDraft,
  globalObjective: Objective,
): Profile {
  return makeProfile({
    sex: draft.sex,
    age: draft.age,
    level: draft.level,
    objective: globalObjective,
    sessions_per_week: draft.sessionsPerWeek,
    bodyweight_kg: draft.bodyweightKg,
    // Conv #29 — PdC strict : aucun matériel disponible, pour que TOUTES les
    // voies (génération, swap, ajout d'exo) restent en poids du corps pur.
    available_equip:
      draft.equipmentPreference === EquipmentPreference.BODYWEIGHT
        ? new Set<string>()
        : draft.equipment,
    duration_category: draft.durationCategory,
    equipment_preference: draft.equipmentPreference,
    gym_brand: draft.gymBrand,
  });
}

/**
 * Assemble le `Record<string, MuscleGoal>` final, prêt pour `engine.startUser`
 * avec `applyBalance: false`.
 *
 * - PRIORITAIRE : un par muscle de `draft.priorities`, dans l'ordre du ranking.
 * - SUGGERE / MAINTIEN : muscles de `draft.maintenance` (peints en entretien
 *   ou acceptés via la popin d'équilibre).
 * - NON_COUVERT : muscles suggérés par R1-R4 mais refusés. On les inscrit
 *   explicitement pour que le moteur respecte le choix utilisateur (cf.
 *   contrat de balance.ts : "respecte les NON_COUVERT explicites").
 *
 * @param suggestions Output de `computeBalanceSuggestions(draft.priorities,
 *                    draft.maintenance)` au moment de la popin.
 */
export function buildMuscleGoals(
  draft: OnboardingDraft,
  suggestions: readonly MuscleGoal[],
): Record<string, MuscleGoal> {
  const goals: Record<string, MuscleGoal> = {};

  draft.priorities.forEach((p, i) => {
    goals[p.muscle] = makeMuscleGoal({
      muscle: p.muscle,
      objective: p.objective,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: i + 1,
    });
  });

  for (const m of draft.maintenance) {
    if (goals[m] !== undefined) continue; // déjà PRIORITAIRE
    goals[m] = makeMuscleGoal({
      muscle: m,
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.SUGGERE,
      priority_rank: 99,
    });
  }

  for (const sg of suggestions) {
    if (goals[sg.muscle] !== undefined) continue; // déjà couvert
    goals[sg.muscle] = makeMuscleGoal({
      muscle: sg.muscle,
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.NON_COUVERT,
    });
  }

  return goals;
}

// =============================================================================
// Garde-fou
// =============================================================================

/**
 * Vrai si l'utilisateur n'a aucun muscle PRIORITAIRE (H/F/E). Des maintiens
 * seuls ne suffisent pas : le moteur a besoin d'au moins une priorité pour
 * dimensionner le programme.
 */
export function isEmptySelection(draft: OnboardingDraft): boolean {
  return draft.priorities.length === 0;
}

// =============================================================================
// Catalogue UX d'équipements (chips de l'étape 1)
// =============================================================================

export interface EquipmentChip {
  readonly id: string;
  readonly label: string;
  readonly equip: readonly string[];
}

/**
 * Regroupement UX des codes équipement (`exercises.json`) en chips compréhensibles.
 * Chaque chip mappe sur 1..N codes. L'utilisateur peut tout cocher d'un coup
 * via le préset "Salle complète".
 */
export const EQUIPMENT_CHIPS: readonly EquipmentChip[] = [
  { id: 'bb', label: 'Barre olympique + rack', equip: ['bb_oly', 'rack'] },
  { id: 'db', label: 'Haltères', equip: ['db'] },
  { id: 'bench_flat', label: 'Banc plat', equip: ['bench_flat'] },
  { id: 'bench_incl', label: 'Banc inclinable', equip: ['bench_incl', 'bench_decl'] },
  { id: 'pull_bar', label: 'Barre de traction', equip: ['pull_bar', 'assisted_pullup'] },
  { id: 'dip_bar', label: 'Barres parallèles (dips)', equip: ['dip_bar'] },
  { id: 'cable', label: 'Poulies', equip: ['cable_low', 'cable_high', 'cable_double'] },
  { id: 'smith', label: 'Smith machine', equip: ['smith'] },
  {
    id: 'machines_upper',
    label: 'Machines haut du corps',
    equip: [
      'lat_pulldown', 'seated_row', 'chest_press', 'pec_deck',
      'lateral_machine', 'preacher',
    ],
  },
  {
    id: 'machines_lower',
    label: 'Machines bas du corps',
    equip: [
      'leg_press', 'hack_squat', 'leg_curl_lying', 'leg_curl_seated',
      'leg_extension', 'glute_machine', 'calf_standing', 'calf_seated',
      'reverse_hyper', 'glute_ham',
    ],
  },
  {
    id: 'misc',
    label: 'Autres (back ext, ab wheel)',
    equip: ['back_extension', 'ab_wheel'],
  },
];

export const EQUIPMENT_PRESET_FULL_GYM: ReadonlySet<string> = new Set(
  EQUIPMENT_CHIPS.flatMap((c) => c.equip),
);

export const EQUIPMENT_PRESET_HOME_BASIC: ReadonlySet<string> = new Set([
  'db', 'bench_flat', 'pull_bar', 'assisted_pullup',
]);

/** Renvoie les ids des chips entièrement satisfaites par `equipment`. */
export function activeChipIds(equipment: ReadonlySet<string>): Set<string> {
  const active = new Set<string>();
  for (const chip of EQUIPMENT_CHIPS) {
    if (chip.equip.every((e) => equipment.has(e))) {
      active.add(chip.id);
    }
  }
  return active;
}

export function toggleChip(
  equipment: ReadonlySet<string>,
  chip: EquipmentChip,
): Set<string> {
  const next = new Set(equipment);
  const allOn = chip.equip.every((e) => next.has(e));
  if (allOn) {
    for (const e of chip.equip) next.delete(e);
  } else {
    for (const e of chip.equip) next.add(e);
  }
  return next;
}
