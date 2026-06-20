/**
 * Splits canoniques, fréquence par muscle, placement des jours.
 *
 * Référence : recherche/09_programmation.md §5.
 *
 * Bibliothèque V1 (6 splits) :
 *   - Full Body 2× : débutants / seniors temps limité
 *   - Full Body 3× : débutants standard (défaut 3 séances)
 *   - PPL 3× : intermédiaires temps limité (opt-in seulement)
 *   - Upper/Lower 4× : intermédiaires (gold standard)
 *   - U/L 5× + spec : intermédiaires/avancés
 *   - PPL 6× : avancés
 *
 * Splits exclus V1 : Bro split 5×, splits >6×/sem ou doubles séances/jour.
 *
 * Sources : Schoenfeld 2019 (fréquence), Helms 2018, Israetel 2017.
 */

import {
  UPPER_BODY,
  LOWER_BODY,
  PUSH_MUSCLES,
  PULL_MUSCLES,
  CORE_MUSCLES,
} from './balance';

// =============================================================================
// Types : SlotKind, SplitSlot, SplitTemplate
// =============================================================================

export enum SlotKind {
  FULL = 'full',
  UPPER = 'upper',
  LOWER = 'lower',
  PUSH = 'push',
  PULL = 'pull',
  LEGS = 'legs',
}

export interface SplitSlot {
  readonly label: string;
  readonly kind: SlotKind;
}

export interface SplitTemplate {
  readonly id: string;
  readonly name: string;
  readonly sessions_per_week: number;
  readonly slots: readonly SplitSlot[];
}

function makeSlot(label: string, kind: SlotKind): SplitSlot {
  return { label, kind };
}

// =============================================================================
// Définition des 6 splits canoniques V1
// =============================================================================

export const SPLIT_FB_2X: SplitTemplate = {
  id: 'fb_2x',
  name: 'Full Body 2×',
  sessions_per_week: 2,
  slots: [makeSlot('Full A', SlotKind.FULL), makeSlot('Full B', SlotKind.FULL)],
};

export const SPLIT_FB_3X: SplitTemplate = {
  id: 'fb_3x',
  name: 'Full Body 3×',
  sessions_per_week: 3,
  slots: [
    makeSlot('Full A', SlotKind.FULL),
    makeSlot('Full B', SlotKind.FULL),
    makeSlot('Full C', SlotKind.FULL),
  ],
};

export const SPLIT_PPL_3X: SplitTemplate = {
  id: 'ppl_3x',
  name: 'PPL 3×',
  sessions_per_week: 3,
  slots: [
    makeSlot('Push', SlotKind.PUSH),
    makeSlot('Pull', SlotKind.PULL),
    makeSlot('Legs', SlotKind.LEGS),
  ],
};

// Conv #28 — lettre GLOBALE par séance dans toute la semaine (la lettre
// identifie la séance, le préfixe décrit le contenu). Les seeds ci-dessous
// suivent la convention ; `renumberSessionLabels` réassigne de toute façon
// les lettres dans l'ordre final après le tri neuro.
export const SPLIT_UL_4X: SplitTemplate = {
  id: 'ul_4x',
  name: 'Upper/Lower 4×',
  sessions_per_week: 4,
  slots: [
    makeSlot('Upper A', SlotKind.UPPER),
    makeSlot('Lower B', SlotKind.LOWER),
    makeSlot('Upper C', SlotKind.UPPER),
    makeSlot('Lower D', SlotKind.LOWER),
  ],
};

export const SPLIT_UL_5X_SPEC: SplitTemplate = {
  id: 'ul_5x_spec',
  name: 'U/L 5× + focus',
  sessions_per_week: 5,
  slots: [
    makeSlot('Upper A', SlotKind.UPPER),
    makeSlot('Lower B', SlotKind.LOWER),
    makeSlot('Upper C', SlotKind.UPPER),
    makeSlot('Lower D', SlotKind.LOWER),
    // Conv #22.5 "Spec" → "Bonus" ; Conv #28 → "Focus" (la séance qui
    // re-cible les muscles prioritaires — lisible après « Séance E — »).
    makeSlot('Focus', SlotKind.FULL),
  ],
};

export const SPLIT_PPL_6X: SplitTemplate = {
  id: 'ppl_6x',
  name: 'PPL 6×',
  sessions_per_week: 6,
  slots: [
    makeSlot('Push A', SlotKind.PUSH),
    makeSlot('Pull B', SlotKind.PULL),
    makeSlot('Legs C', SlotKind.LEGS),
    makeSlot('Push D', SlotKind.PUSH),
    makeSlot('Pull E', SlotKind.PULL),
    makeSlot('Legs F', SlotKind.LEGS),
  ],
};

// =============================================================================
// Conv #39 — structures additionnelles (catalogue élargi)
// =============================================================================
// Couvrent les distributions musculaires atypiques que les 6 canoniques
// laissaient mal servies (haut du corps seul → séances jambes vides, etc.).
// Le scorer (skeleton_builder) choisit la meilleure ; le filet Full Body N×
// garantit toujours une solution sans séance vide. AUCUN nouveau SlotKind :
// tout réutilise FULL/UPPER/LOWER/PUSH/PULL/LEGS.

// Push/Pull (haut du corps sans jambes) — 2× / 4× / 6×.
export const SPLIT_PUSH_PULL_2X: SplitTemplate = {
  id: 'push_pull_2x',
  name: 'Push/Pull 2×',
  sessions_per_week: 2,
  slots: [makeSlot('Push A', SlotKind.PUSH), makeSlot('Pull B', SlotKind.PULL)],
};

export const SPLIT_PUSH_PULL_4X: SplitTemplate = {
  id: 'push_pull_4x',
  name: 'Push/Pull 4×',
  sessions_per_week: 4,
  slots: [
    makeSlot('Push A', SlotKind.PUSH),
    makeSlot('Pull B', SlotKind.PULL),
    makeSlot('Push C', SlotKind.PUSH),
    makeSlot('Pull D', SlotKind.PULL),
  ],
};

export const SPLIT_PUSH_PULL_6X: SplitTemplate = {
  id: 'push_pull_6x',
  name: 'Push/Pull 6×',
  sessions_per_week: 6,
  slots: [
    makeSlot('Push A', SlotKind.PUSH),
    makeSlot('Pull B', SlotKind.PULL),
    makeSlot('Push C', SlotKind.PUSH),
    makeSlot('Pull D', SlotKind.PULL),
    makeSlot('Push E', SlotKind.PUSH),
    makeSlot('Pull F', SlotKind.PULL),
  ],
};

// Upper/Lower/Full — compromis 3 séances entre full body et split.
export const SPLIT_ULF_3X: SplitTemplate = {
  id: 'ulf_3x',
  name: 'Upper/Lower/Full 3×',
  sessions_per_week: 3,
  slots: [
    makeSlot('Upper A', SlotKind.UPPER),
    makeSlot('Lower B', SlotKind.LOWER),
    makeSlot('Full C', SlotKind.FULL),
  ],
};

// PPL + Upper/Lower — split 5 séances moderne (alternative au U/L + Focus).
export const SPLIT_PPL_UL_5X: SplitTemplate = {
  id: 'ppl_ul_5x',
  name: 'PPL + Upper/Lower 5×',
  sessions_per_week: 5,
  slots: [
    makeSlot('Push A', SlotKind.PUSH),
    makeSlot('Pull B', SlotKind.PULL),
    makeSlot('Legs C', SlotKind.LEGS),
    makeSlot('Upper D', SlotKind.UPPER),
    makeSlot('Lower E', SlotKind.LOWER),
  ],
};

// Upper/Lower 6× (haute fréquence équilibrée haut/bas).
export const SPLIT_UL_6X: SplitTemplate = {
  id: 'ul_6x',
  name: 'Upper/Lower 6×',
  sessions_per_week: 6,
  slots: [
    makeSlot('Upper A', SlotKind.UPPER),
    makeSlot('Lower B', SlotKind.LOWER),
    makeSlot('Upper C', SlotKind.UPPER),
    makeSlot('Lower D', SlotKind.LOWER),
    makeSlot('Upper E', SlotKind.UPPER),
    makeSlot('Lower F', SlotKind.LOWER),
  ],
};

// Full Body N× — filet universel (jamais de séance vide, choisi en dernier
// recours via un bonus canonique faible).
function fullBodySplit(n: number): SplitTemplate {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return {
    id: `fb_${n}x`,
    name: `Full Body ${n}×`,
    sessions_per_week: n,
    slots: Array.from({ length: n }, (_, i) =>
      makeSlot(`Full ${letters[i] ?? String(i + 1)}`, SlotKind.FULL),
    ),
  };
}
export const SPLIT_FB_4X = fullBodySplit(4);
export const SPLIT_FB_5X = fullBodySplit(5);
export const SPLIT_FB_6X = fullBodySplit(6);

export const ALL_SPLITS: readonly SplitTemplate[] = [
  // Canoniques.
  SPLIT_FB_2X,
  SPLIT_FB_3X,
  SPLIT_PPL_3X,
  SPLIT_UL_4X,
  SPLIT_UL_5X_SPEC,
  SPLIT_PPL_6X,
  // Conv #39 — additionnelles.
  SPLIT_PUSH_PULL_2X,
  SPLIT_PUSH_PULL_4X,
  SPLIT_PUSH_PULL_6X,
  SPLIT_ULF_3X,
  SPLIT_PPL_UL_5X,
  SPLIT_UL_6X,
  // Filets Full Body.
  SPLIT_FB_4X,
  SPLIT_FB_5X,
  SPLIT_FB_6X,
];

// =============================================================================
// Catégorisation muscle → SlotKind éligible
// =============================================================================

/**
 * Muscles canoniques (MUSCLES) qui ne sont dans aucune liste push/pull/
 * upper/lower mais qu'on veut quand même rattacher à certains slots non-FULL.
 * Conv #17c — sans ce patch, `parameterizeSplit` ignorait silencieusement
 * `obliques` (sur UL/PPL/LEGS) et `trapezes_hauts` (sur PPL), ce qui faisait
 * qu'un user marquant ces muscles PRIORITAIRES + split UL/PPL se retrouvait
 * sans aucun exo dédié. Les constantes PUSH/PULL/CORE de `balance.ts`
 * **ne sont pas modifiées** pour préserver le comportement par défaut des
 * règles R1 (push/pull balance) et R3 (core suggéré).
 *
 *  - `obliques` : assimilable au core, éligible à tous les slots non-FULL.
 *  - `trapezes_hauts` : mouvements de tirage scapulaire (shrug, upright row)
 *    → naturel sur PULL en plus d'UPPER.
 */
const SLOT_EXTRA_MUSCLES: Record<SlotKind, ReadonlySet<string>> = {
  [SlotKind.FULL]: new Set(),
  [SlotKind.UPPER]: new Set(['obliques']),
  [SlotKind.LOWER]: new Set(['obliques']),
  [SlotKind.PUSH]: new Set(['obliques']),
  [SlotKind.PULL]: new Set(['obliques', 'trapezes_hauts']),
  [SlotKind.LEGS]: new Set(['obliques']),
};

/**
 * True si ce muscle est éligible à un slot de ce type.
 *   - FULL : tous les muscles
 *   - UPPER : haut du corps + core + extras (obliques)
 *   - LOWER : bas du corps + core + extras (obliques)
 *   - PUSH : groupes spécifiques + core + extras (obliques)
 *   - PULL : groupes spécifiques + core + extras (obliques, trapezes_hauts)
 *   - LEGS : bas du corps + core + extras (obliques)
 */
export function muscleBelongsToSlot(muscle: string, kind: SlotKind): boolean {
  if (kind === SlotKind.FULL) return true;

  const isCore = (CORE_MUSCLES as readonly string[]).includes(muscle);
  if (SLOT_EXTRA_MUSCLES[kind].has(muscle)) return true;

  switch (kind) {
    case SlotKind.UPPER:
      return (UPPER_BODY as readonly string[]).includes(muscle) || isCore;
    case SlotKind.LOWER:
      return (LOWER_BODY as readonly string[]).includes(muscle) || isCore;
    case SlotKind.PUSH:
      return (PUSH_MUSCLES as readonly string[]).includes(muscle) || isCore;
    case SlotKind.PULL:
      return (PULL_MUSCLES as readonly string[]).includes(muscle) || isCore;
    case SlotKind.LEGS:
      return (LOWER_BODY as readonly string[]).includes(muscle) || isCore;
    default:
      return false;
  }
}

