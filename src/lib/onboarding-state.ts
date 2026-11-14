/**
 * État local du wizard d'onboarding (Conv #4b, refonte Conv #28).
 *
 * `OnboardingDraft` = state mutable manipulé par OnboardingPage.tsx pendant
 * les 4 étapes. À la fin, on dérive :
 *   - un `Profile` via `buildProfile()`
 *   - un `Record<string, MuscleGoal>` final via `buildMuscleGoals()`
 *
 * Le moteur (`engine.startUser`) est appelé une seule fois, à la validation
 * finale, avec les intentions telles que choisies (les muscles proposés par la
 * fenêtre « Équilibre » n'y sont que s'ils ont été acceptés).
 */

import {
  DurationCategory,
  EquipmentPreference,
  GymBrand,
  Level,
  MuscleIntention,
  Sex,
  makeMuscleGoal,
  makeProfile,
  type MuscleGoal,
  type Profile,
  type UserState,
} from '@/engine/models';
import { applyBalanceRules } from '@/engine/balance';

/** Un muscle à développer ; l'ordre de la liste fait office de rang. */
export interface RankedPriority {
  readonly muscle: string;
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

  // Étape 2 : muscles à développer (dans l'ordre du ranking ; l'ordre de
  // sélection fait office de rang, réordonnable dans la liste)
  readonly priorities: readonly RankedPriority[];

  // Étape 2 : muscles à entretenir (choisis à la main ou acceptés via la
  // popin d'équilibre R1-R4).
  readonly maintenance: ReadonlySet<string>;

  // Étape 3 : mode de construction
  /**
   * Mode de construction du programme :
   *  - `'auto'`   : le moteur remplit (sur-mesure).
   *  - `'manual'` : grille vide, l'utilisateur remplit lui-même (jours nus +
   *    jauges de volume). Default : `'auto'`.
   */
  readonly buildMode: 'auto' | 'manual';
  /**
   * Durée MAX par séance (plafond patterns/séance).
   * Sert au nouveau path co-construit (mode custom seulement).
   * Default : MEDIUM (≤ 1h30).
   */
  readonly durationCategory: DurationCategory;
  /**
   * Préférence d'équipement (machines / poids libres / aucune).
   * Sert au tri auto des exos à l'onboarding.
   */
  readonly equipmentPreference: EquipmentPreference;
  /**
   * Marque dominante de la salle. Affecte uniquement les
   * intitulés affichés des exos machine. Default : NONE.
   */
  readonly gymBrand: GymBrand;
  /**
   * Exos choisis par l'user lorsqu'il swap dans le récap final.
   * Clé = `${dayIdx}:${cellIdx}`, valeur = `exercise_id`. Vide tant que
   * l'user n'a pas modifié les exos auto-pickés. En mode guidé : non utilisé.
   */
  readonly chosenVariantsPerCell: Readonly<Record<string, string>>;
}

// =============================================================================
// Préset par défaut (étape 2 garde-fou : "Préset par défaut")
// =============================================================================

/**
 * Préset full-body : un programme léger pour qui ne veut pas choisir muscle par
 * muscle (dump 2.4, étape 6, choix d'Azur en conv #84).
 *
 * 3 muscles à développer, les trois grands mouvements (poussée, tirage
 * vertical, squat), + 4 à entretenir. Simulé à 3 séances : 19, 17 et 16
 * séries, environ 67, 57 et 40 min (l'ancien préset à 5 + 6 muscles donnait
 * 27, 23 et 20 séries, jusqu'à 92 min, au-delà de l'alerte de 75 min).
 *
 *  - Entretien : ischios (équilibre des quadriceps, règle R2), deltos latéraux
 *    (des élévations latérales, pas de développé), deltos postérieurs
 *    (équilibre de l'épaule), abdos (gainage).
 *  - Absents, couverts par les polyarticulaires : dos épaisseur (tractions,
 *    soulevé de terre), fessiers et adducteurs (squats), biceps (tractions),
 *    triceps et deltos antérieurs (développés), trapèzes hauts, mollets,
 *    obliques, lombaires.
 *
 * NB : la popin d'équilibre suggérerait des muscles absents (dos épaisseur,
 * biceps, lombaires…) → elle est pré-déclinée à l'application du préset (cf.
 * `balanceKeyOf` + `onPresetApplied` dans OnboardingPage).
 */
export const PRESET_DEFAULT_PRIORITIES: readonly RankedPriority[] = [
  { muscle: 'pectoraux' },
  { muscle: 'dos_largeur' },
  { muscle: 'quadriceps' },
];

/** Entretien ciblé du préset full-body (4 muscles, pas « tous les autres »). */
export const PRESET_DEFAULT_MAINTENANCE: ReadonlySet<string> = new Set([
  'ischios',
  'deltos_lateraux',
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
    // Niveau retiré de l'UI (auto-calibration cycle après cycle).
    // Default INTERMEDIAIRE = milieu juste pour les V_min/V_max init.
    level: Level.INTERMEDIAIRE,
    sessionsPerWeek: 3,
    // Équipement retiré de l'UI. Default = salle complète ; le mode
    // custom co-construit n'utilise plus ce filtre (préférence = simple prefill).
    equipment: new Set<string>(EQUIPMENT_PRESET_FULL_GYM),
    priorities: [],
    maintenance: new Set<string>(),
    buildMode: 'auto',
    durationCategory: DurationCategory.MEDIUM,
    equipmentPreference: EquipmentPreference.NO_PREFERENCE,
    gymBrand: GymBrand.NONE,
    chosenVariantsPerCell: {},
  };
}

/**
 * Initialise un draft depuis `UserState` pour le mode "partial
 * restart" : l'utilisateur revient sur l'onboarding (Step2→5) pour modifier
 * ses priorités / programme. On préserve les choix existants comme point
 * de départ.
 */
export function draftFromUserState(state: UserState): OnboardingDraft {
  const priorities: RankedPriority[] = [];
  const maintenance = new Set<string>();
  for (const g of Object.values(state.muscle_goals)) {
    if (g.intention === MuscleIntention.DEVELOPPER) {
      priorities.push({ muscle: g.muscle });
    } else {
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
 * À partir des muscles à développer et à entretenir de l'étape 2, calcule la
 * liste des muscles à proposer en entretien par R1-R4 (fonction pure de `balance.ts`). Les muscles
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
    prios: priorities.map((p) => p.muscle),
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
      intention: MuscleIntention.DEVELOPPER,
      priority_rank: i + 1,
    });
  });
  for (const m of maintenance) {
    if (goals[m] !== undefined) continue;
    goals[m] = makeMuscleGoal({ muscle: m, intention: MuscleIntention.ENTRETENIR });
  }
  return applyBalanceRules(goals);
}

// =============================================================================
// Finalisation : Profile + MuscleGoals à passer à engine.startUser
// =============================================================================

export function buildProfile(draft: OnboardingDraft): Profile {
  return makeProfile({
    sex: draft.sex,
    age: draft.age,
    level: draft.level,
    sessions_per_week: draft.sessionsPerWeek,
    bodyweight_kg: draft.bodyweightKg,
    // PdC strict : aucun matériel disponible, pour que TOUTES les
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
 * Assemble le `Record<string, MuscleGoal>` final, prêt pour `engine.startUser`.
 *
 * - Développer : un par muscle de `draft.priorities`, dans l'ordre du ranking.
 * - Entretenir : muscles de `draft.maintenance` (choisis à la main ou acceptés
 *   via la popin d'équilibre).
 * Un muscle proposé par R1-R4 puis refusé n'a simplement pas d'intention.
 */
export function buildMuscleGoals(draft: OnboardingDraft): Record<string, MuscleGoal> {
  const goals: Record<string, MuscleGoal> = {};

  draft.priorities.forEach((p, i) => {
    goals[p.muscle] = makeMuscleGoal({
      muscle: p.muscle,
      intention: MuscleIntention.DEVELOPPER,
      priority_rank: i + 1,
    });
  });

  for (const m of draft.maintenance) {
    if (goals[m] !== undefined) continue; // déjà à développer
    goals[m] = makeMuscleGoal({ muscle: m, intention: MuscleIntention.ENTRETENIR });
  }

  return goals;
}

// =============================================================================
// Garde-fou
// =============================================================================

/**
 * Vrai si l'utilisateur n'a aucun muscle à développer. Des muscles à
 * entretenir seuls ne suffisent pas : le moteur a besoin d'au moins un muscle
 * à développer pour dimensionner le programme.
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

