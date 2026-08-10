/**
 * Sélecteurs purs pour l'écran Bilan de cycle (Conv #5a).
 *
 * Le moteur expose `lastCycleReview` après `useEngine.endOfCycle()`. Si l'user
 * arrive sur la page après un reload (donc `lastCycleReview` est null), on
 * retombe sur le dernier `CycleRow.review` non-null en DB.
 */

import type { Catalog } from '@/engine/catalog';
import { generateCycleReview } from '@/engine/lifecycle';
import type { CycleReview, UserState } from '@/engine/models';
import type { CycleRow, FeedbackRow } from '@/db/schema';
import { isCycleFinished } from '@/lib/dashboard';

export function pickReviewToDisplay(
  lastCycleReview: CycleReview | null,
  cycles: ReadonlyArray<CycleRow>,
): CycleReview | null {
  if (lastCycleReview !== null) return lastCycleReview;
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i]!;
    if (c.review !== null) return c.review;
  }
  return null;
}

/**
 * Conv #76 — bilan du cycle **en cours**, calculé à la volée.
 *
 * Un `CycleReview` n'existait en mémoire (`lastCycleReview`) ou en base
 * (`CycleRow.review`) qu'**après** `endOfCycle()`, c'est-à-dire après que
 * l'utilisateur ait choisi la suite. Or c'est le bilan qui porte ce choix :
 * l'accueil affichait « Cycle terminé », le lien ouvrait la page, et la page
 * répondait « Aucun bilan disponible » — sans autre issue, puisque le
 * calendrier s'arrête à la fin de la semaine 5.
 *
 * On calcule donc la review du cycle courant dès qu'il est terminé.
 * `generateCycleReview` est une fonction **pure** (aucune mutation de `state`,
 * contrairement à `engine.endOfCycle` qui enchaîne sur
 * `adjustVolumeBoundsAtCycleEnd`) : l'afficher avant validation ne change rien
 * à l'état. Elle sera recalculée à l'identique — mêmes entrées — au moment où
 * l'utilisateur valide, et c'est cette exécution-là qui persiste.
 *
 * Retourne `null` si le cycle n'est pas terminé, ou s'il a déjà sa review
 * archivée (cas d'un cycle clos : la version persistée fait foi).
 */
export function pickPendingCycleReview(args: {
  userState: UserState | null;
  catalog: Catalog | null;
  cycles: ReadonlyArray<CycleRow>;
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index' | 'feedback'>>;
  today: Date;
}): CycleReview | null {
  const { userState, catalog, cycles, feedbacks, today } = args;
  if (userState === null || catalog === null) return null;
  const stored = cycles.find((c) => c.cycle_index === userState.cycle_index);
  if (stored?.review != null) return null;
  if (!isCycleFinished(userState, feedbacks, cycles, today)) return null;
  return generateCycleReview(userState, catalog);
}

/**
 * Muscles à la fois **surchargés** et **en recul** sur le cycle — le signal qui
 * déclenche l'alerte de dosage du bilan (Conv #76).
 *
 * La conjonction est le fond du sujet. Reculer sans excès de volume peut tenir
 * au sommeil ou à une mauvaise période : on n'accuse pas le programme.
 * Encaisser beaucoup de volume sans rien perdre, c'est qu'on le supporte : on
 * ne dit rien non plus. Seul le croisement des deux désigne un problème de
 * dosage.
 *
 * Les deux listes sont **persistées** dans chaque `CycleReview` : l'alerte
 * fonctionne donc aussi sur les bilans archivés, sans champ ni migration.
 * Corollaire heureux : les muscles listés sont exactement ceux qui
 * apparaissent en rouge sur la silhouette « Progression par muscle ».
 */
export function overloadedMuscles(review: CycleReview): string[] {
  const declining = new Set(review.muscles_plateau);
  return review.muscles_overshoot.filter((m) => declining.has(m));
}

/*
 * Conv #76 — `suggestedActionLabel` supprimée avec la ligne « Kotsh te
 * suggère… » qu'elle alimentait. `suggestNextAction` ne reposait que sur deux
 * seuils (assiduité < 60 %, ou ≥ 3 muscles en recul), ignorait les muscles en
 * progrès, ne distinguait pas un cycle qui progresse d'un cycle qui stagne, et
 * ne conditionnait aucun comportement — les deux boutons restaient identiques
 * dans les deux cas. Le bilan porte désormais une alerte de dosage, factuelle
 * et actionnable (cf. `OverloadAlert`).
 *
 * Le champ `suggested_action` reste produit et persisté : il vit dans les
 * bilans archivés et dans le schéma de la démo.
 */
