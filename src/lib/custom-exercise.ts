/**
 * Helpers pour la création d'un exercice "custom" par l'utilisateur (Conv #21b).
 *
 * Pourquoi ce fichier sépare ces utilitaires :
 *  - La logique de défauts (inc_kg, reps_hyp, repos) selon la
 *    charge / le type d'exercice est non-triviale et mérite d'être testée
 *    indépendamment du composant React.
 *  - La détection de doublon (par nom + par profil "pattern/charge/muscles
 *    primaires") sert au formulaire mais peut être réutilisée ailleurs
 *    (import JSON, futur outil de fusion).
 *  - La génération d'un `ExerciseDict` à partir d'un brouillon partiel est
 *    isolée pour qu'on puisse l'appeler depuis un test ou un script.
 */

import type { ExerciseDict, Exercise } from '@/engine/models';

/** Charges supportées par le moteur (cf. `ChargeType` dans `engine/models.ts`). */
export const CHARGE_OPTIONS = [
  { value: 'barbell', label: 'Barre olympique' },
  { value: 'dumbbell', label: 'Haltères (par haltère)' },
  { value: 'machine_stack', label: 'Machine guidée (pile)' },
  { value: 'cable', label: 'Poulie / Câble' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'bodyweight_loaded', label: 'Poids du corps + lest' },
  { value: 'bodyweight_assisted', label: 'Poids du corps assisté' },
] as const;

/** Patterns de mouvement existants dans le catalogue. */
export const PATTERN_OPTIONS = [
  { value: 'push_h', label: 'Pousser horizontal (pec, triceps)' },
  { value: 'push_v', label: 'Pousser vertical (épaules)' },
  { value: 'pull_h', label: 'Tirer horizontal (dos épaisseur)' },
  { value: 'pull_v', label: 'Tirer vertical (dos largeur)' },
  { value: 'squat', label: 'Squat / quads dominants' },
  { value: 'hinge', label: 'Hinge / ischios fessiers' },
  { value: 'lunge', label: 'Fente unilatéral' },
  { value: 'core', label: 'Gainage / abdos' },
  { value: 'isolation', label: 'Isolation (bras, deltos, mollets…)' },
] as const;

/**
 * Incrément de charge par défaut selon la charge — aligné sur Conv #21
 * (1 kg partout sauf DUMBBELL à 2 kg/haltère, BW à 0).
 */
export function defaultIncKg(charge: string): number {
  if (charge === 'dumbbell') return 2;
  if (charge === 'bodyweight') return 0;
  return 1;
}

/**
 * Fourchette de reps "hypertrophie" par défaut selon le type :
 *  - compound : 6-10 reps (force/hyp mix)
 *  - isolation : 10-15 reps (volume orienté hyp)
 */
export function defaultRepsHyp(type: 'compound' | 'isolation'): [number, number] {
  return type === 'compound' ? [6, 10] : [10, 15];
}

/** Fourchette force par défaut. Isolation = pas de phase force pure. */
export function defaultRepsForce(
  type: 'compound' | 'isolation',
): [number, number] | null {
  return type === 'compound' ? [3, 5] : null;
}

/** Repos par défaut : 180 s pour compound lourd, 90 s pour isolation. */
export function defaultRepos(type: 'compound' | 'isolation'): number {
  return type === 'compound' ? 180 : 90;
}

/**
 * Slugifie un nom français en id ASCII utilisable comme clé.
 *   "Squat front à la barre" → "squat_front_a_la_barre"
 *
 * Stratégie naïve (NFD pour les accents, replace tout non-alphanum, trim
 * underscores). Si collision avec un id existant, on ajoute un suffixe
 * incrémental (`_2`, `_3`…) côté caller.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** Génère un id unique sur la base de `name`, en évitant `existingIds`. */
export function uniqueId(name: string, existingIds: ReadonlySet<string>): string {
  const base = slugify(name) || 'custom';
  if (!existingIds.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const cand = `${base}_${i}`;
    if (!existingIds.has(cand)) return cand;
  }
  // Fallback ultra-improbable.
  return `${base}_${Date.now()}`;
}

/**
 * Brouillon de l'utilisateur en cours d'édition. Sous-ensemble des champs
 * de `ExerciseDict` + `muscles` désormais en `Record<muscle, number>`.
 * Les champs hors brouillon sont dérivés via `buildExerciseDict`.
 */
export interface CustomExerciseDraft {
  nom_fr: string;
  pattern: string;
  type: 'compound' | 'isolation';
  charge: string;
  equip: string[];
  uni: boolean;
  muscles: Record<string, number>;
  note: string;
}

export const EMPTY_DRAFT: CustomExerciseDraft = {
  nom_fr: '',
  pattern: 'isolation',
  type: 'isolation',
  charge: 'dumbbell',
  equip: [],
  uni: false,
  muscles: {},
  note: '',
};

/**
 * Convertit un brouillon validé en `ExerciseDict` prêt à persister. Pose les
 * valeurs auto (inc_kg, reps_hyp, repos) à partir des choix de
 * l'user.
 *
 * `existingIds` doit contenir tous les ids du catalog (défaut + customs déjà
 * créés) pour éviter une collision d'id.
 */
export function buildExerciseDict(
  draft: CustomExerciseDraft,
  existingIds: ReadonlySet<string>,
): ExerciseDict {
  const id = uniqueId(draft.nom_fr, existingIds);
  const repsHyp = defaultRepsHyp(draft.type);
  const repsForce = defaultRepsForce(draft.type);
  // Conserve uniquement les muscles avec coef > 0.
  const muscles: Record<string, number> = {};
  for (const [m, c] of Object.entries(draft.muscles)) {
    if (typeof c === 'number' && c > 0) muscles[m] = c;
  }
  return {
    id,
    nom_fr: draft.nom_fr.trim(),
    synonymes: [],
    pattern: draft.pattern,
    type: draft.type,
    charge: draft.charge,
    equip: draft.equip.map((e) => e.trim()).filter((e) => e.length > 0),
    uni: draft.uni,
    muscles,
    subst: id, // pas de substitut connu pour un custom
    inc_kg: defaultIncKg(draft.charge),
    reps_hyp: repsHyp,
    reps_force: repsForce ?? repsHyp, // l'ExerciseDict attend un tuple non-null
    repos_s: defaultRepos(draft.type),
    dif: 'moyen',
    tags: [],
    note: draft.note.trim(),
  } as ExerciseDict;
}

// =============================================================================
// Validation + détection de doublon
// =============================================================================

export interface DraftValidationError {
  field: keyof CustomExerciseDraft;
  message: string;
}

/**
 * Valide le brouillon et retourne la liste des erreurs (vide = OK pour
 * persister). Erreurs FR pour affichage direct dans le formulaire.
 */
export function validateDraft(draft: CustomExerciseDraft): DraftValidationError[] {
  const errs: DraftValidationError[] = [];
  if (draft.nom_fr.trim().length < 3) {
    errs.push({ field: 'nom_fr', message: 'Le nom doit faire au moins 3 caractères.' });
  }
  if (!CHARGE_OPTIONS.some((c) => c.value === draft.charge)) {
    errs.push({ field: 'charge', message: 'Choisir un type de charge valide.' });
  }
  if (!PATTERN_OPTIONS.some((p) => p.value === draft.pattern)) {
    errs.push({ field: 'pattern', message: 'Choisir un pattern de mouvement valide.' });
  }
  const totalMuscleCoef = Object.values(draft.muscles).reduce(
    (a, b) => a + (typeof b === 'number' ? b : 0),
    0,
  );
  if (totalMuscleCoef <= 0) {
    errs.push({
      field: 'muscles',
      message: 'Sélectionne au moins un muscle travaillé.',
    });
  }
  return errs;
}

/**
 * Normalise un nom pour comparaison de doublon : NFD, lowercase, retire
 * accents + tout non-alphanum, compresse les espaces.
 */
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type DuplicateMatchKind = 'exact-name' | 'similar-profile';

export interface DuplicateMatch {
  readonly kind: DuplicateMatchKind;
  readonly exercise: Exercise;
}

/**
 * Détecte si le brouillon ressemble à un exo existant du catalogue.
 *
 *  - `exact-name` : le nom normalisé est strictement identique à un nom
 *    existant (ou à un synonyme). Forte présomption de doublon — UI bloque.
 *  - `similar-profile` : même `pattern` + même `charge` + l'ensemble des
 *    muscles primaires (coef ≥ 1) est identique. UI demande confirmation
 *    "tu es sûr que ce n'est pas X ?" mais n'empêche pas l'ajout (l'user
 *    peut avoir une variation pertinente, ex. tempo, pause).
 *
 * Retourne le PREMIER match trouvé (ordre catalog) — on ne liste pas tous
 * les matches pour rester simple côté UI. Si l'user veut, il refait une
 * recherche après refus.
 */
export function findDuplicate(
  draft: CustomExerciseDraft,
  catalogExos: ReadonlyArray<Exercise>,
): DuplicateMatch | null {
  const normalized = normalizeName(draft.nom_fr);
  if (normalized.length === 0) return null;

  // 1. Match exact sur nom_fr OU synonyme
  for (const ex of catalogExos) {
    if (normalizeName(ex.nom_fr) === normalized) {
      return { kind: 'exact-name', exercise: ex };
    }
    for (const syn of ex.synonymes) {
      if (normalizeName(syn) === normalized) {
        return { kind: 'exact-name', exercise: ex };
      }
    }
  }

  // 2. Match par profil : pattern + charge + muscles primaires (coef ≥ 1)
  const draftPrimaires = new Set(
    Object.entries(draft.muscles)
      .filter(([, c]) => typeof c === 'number' && c >= 0.99)
      .map(([m]) => m),
  );
  if (draftPrimaires.size === 0) return null;

  for (const ex of catalogExos) {
    if (ex.pattern !== draft.pattern) continue;
    if (ex.charge !== draft.charge) continue;
    const exPrimaires = new Set(
      Object.entries(ex.muscles)
        .filter(([, c]) => c >= 0.99)
        .map(([m]) => m),
    );
    if (exPrimaires.size !== draftPrimaires.size) continue;
    let allMatch = true;
    for (const m of exPrimaires) {
      if (!draftPrimaires.has(m)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      return { kind: 'similar-profile', exercise: ex };
    }
  }

  return null;
}
