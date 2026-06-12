/**
 * Règles d'équilibre R1-R4 pour la sélection des muscles cibles.
 *
 * Référence : recherche/09_programmation.md §4.
 *
 * Sources scientifiques :
 *   - R1 (Push:Pull) : Cools et al. 2014 (déséquilibres scapulo-huméraux),
 *     Schoenfeld & Contreras 2014 (programmation antagoniste)
 *   - R2 (Quadri↔Ischios) : Heiderscheit et al. 2011 (claquages ischios)
 *   - R3 (Core) : McGill 2007 (Low Back Disorders)
 *   - R4 (Rear delts) : Cools 2014, Borstad 2006 (ratio rotateurs ant/post)
 *
 * Contrat de `applyBalanceRules` :
 *   - Entrée : Record<muscle, MuscleGoal> courant (PRIORITAIRES + éventuels overrides).
 *   - Sortie : MuscleGoal[] des SUGGERE à AJOUTER.
 *     - Ne contient QUE les nouveaux muscles, pas ceux déjà présents.
 *     - Tous en objective=MAINTIEN, status=SUGGERE, priority_rank=99.
 *     - Pas de doublons.
 *     - Respecte les NON_COUVERT explicites (pas de re-suggestion).
 */

import type { MuscleGoal } from './models';
import { MuscleObjective, MuscleStatus } from './models';

// =============================================================================
// Catégorisation des muscles
// =============================================================================

// R1 — "Push" : pectoraux + deltos latéraux + triceps (push-dominants pour la balance,
// cf. 09 §4.2 R1, Cools 2014).
export const PUSH_MUSCLES = [
  'pectoraux',
  'deltos_lateraux',
  'triceps',
] as const;

// R1 — "Pull" : dos largeur + dos épaisseur + deltos postérieurs + biceps.
export const PULL_MUSCLES = [
  'dos_largeur',
  'dos_epaisseur',
  'deltos_posterieurs',
  'biceps',
] as const;

// Découpe haut/bas pour la sélection de split (utilisé par split.ts).
export const UPPER_BODY = [
  'pectoraux',
  'dos_largeur',
  'dos_epaisseur',
  'trapezes_hauts',
  'deltos_lateraux',
  'deltos_posterieurs',
  'biceps',
  'triceps',
] as const;

export const LOWER_BODY = [
  'quadriceps',
  'ischios',
  'fessiers',
  'mollets',
] as const;

// R3 — Core
export const CORE_MUSCLES = ['abdos', 'lombaires'] as const;

// R4 — Si l'un de ces muscles est PRIORITAIRE, deltos_posterieurs en MAINTIEN.
export const R4_TRIGGERS = ['pectoraux', 'deltos_lateraux', 'triceps'] as const;

// =============================================================================
// Helpers internes
// =============================================================================

function makeSuggested(muscle: string): MuscleGoal {
  return {
    muscle,
    objective: MuscleObjective.MAINTIEN,
    status: MuscleStatus.SUGGERE,
    priority_rank: 99,
  };
}

function isAlreadyCovered(muscle: string, goals: Record<string, MuscleGoal>): boolean {
  const g = goals[muscle];
  if (!g) return false;
  return g.status !== MuscleStatus.NON_COUVERT;
}

function isNonCouvert(muscle: string, goals: Record<string, MuscleGoal>): boolean {
  const g = goals[muscle];
  return g !== undefined && g.status === MuscleStatus.NON_COUVERT;
}

function addUnique(
  suggested: MuscleGoal[],
  muscle: string,
  goals: Record<string, MuscleGoal>,
  alreadyAdded: Set<string>,
): void {
  if (alreadyAdded.has(muscle)) return;
  if (isAlreadyCovered(muscle, goals)) return;
  if (isNonCouvert(muscle, goals)) return;
  suggested.push(makeSuggested(muscle));
  alreadyAdded.add(muscle);
}

function getPriorities(goals: Record<string, MuscleGoal>): Set<string> {
  const out = new Set<string>();
  for (const [m, g] of Object.entries(goals)) {
    if (g.status === MuscleStatus.PRIORITAIRE) out.add(m);
  }
  return out;
}

// =============================================================================
// Règles individuelles
// =============================================================================

function applyR1PushPull(
  goals: Record<string, MuscleGoal>,
  suggested: MuscleGoal[],
  alreadyAdded: Set<string>,
): void {
  const priorities = getPriorities(goals);
  let pushP = 0;
  let pullP = 0;
  for (const m of priorities) {
    if ((PUSH_MUSCLES as readonly string[]).includes(m)) pushP += 1;
    if ((PULL_MUSCLES as readonly string[]).includes(m)) pullP += 1;
  }
  if (pushP > pullP) {
    for (const m of PULL_MUSCLES) addUnique(suggested, m, goals, alreadyAdded);
  } else if (pullP > pushP) {
    for (const m of PUSH_MUSCLES) addUnique(suggested, m, goals, alreadyAdded);
  }
}

function applyR2QuadriIschios(
  goals: Record<string, MuscleGoal>,
  suggested: MuscleGoal[],
  alreadyAdded: Set<string>,
): void {
  const priorities = getPriorities(goals);
  if (priorities.has('quadriceps')) addUnique(suggested, 'ischios', goals, alreadyAdded);
  if (priorities.has('ischios')) addUnique(suggested, 'quadriceps', goals, alreadyAdded);
}

function applyR3Core(
  goals: Record<string, MuscleGoal>,
  suggested: MuscleGoal[],
  alreadyAdded: Set<string>,
): void {
  for (const m of CORE_MUSCLES) addUnique(suggested, m, goals, alreadyAdded);
}

function applyR4RearDelts(
  goals: Record<string, MuscleGoal>,
  suggested: MuscleGoal[],
  alreadyAdded: Set<string>,
): void {
  const priorities = getPriorities(goals);
  if ((R4_TRIGGERS as readonly string[]).some((m) => priorities.has(m))) {
    addUnique(suggested, 'deltos_posterieurs', goals, alreadyAdded);
  }
}

// =============================================================================
// Point d'entrée
// =============================================================================

/**
 * Applique R1-R4 et retourne la liste des SUGGERE à ajouter.
 * Cf. 09_programmation.md §4.3.
 */
export function applyBalanceRules(
  muscleGoals: Record<string, MuscleGoal>,
): MuscleGoal[] {
  const suggested: MuscleGoal[] = [];
  const alreadyAdded = new Set<string>();

  applyR1PushPull(muscleGoals, suggested, alreadyAdded);
  applyR2QuadriIschios(muscleGoals, suggested, alreadyAdded);
  applyR3Core(muscleGoals, suggested, alreadyAdded);
  applyR4RearDelts(muscleGoals, suggested, alreadyAdded);

  return suggested;
}
