/**
 * Splits canoniques, fréquence par muscle, placement des jours.
 * Port 1:1 de prototype/coach_os/split.py.
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

import type { MuscleGoal, WeeklyTemplate } from './models';
import { Level } from './models';
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

export const SPLIT_UL_4X: SplitTemplate = {
  id: 'ul_4x',
  name: 'Upper/Lower 4×',
  sessions_per_week: 4,
  slots: [
    makeSlot('Upper A', SlotKind.UPPER),
    makeSlot('Lower A', SlotKind.LOWER),
    makeSlot('Upper B', SlotKind.UPPER),
    makeSlot('Lower B', SlotKind.LOWER),
  ],
};

export const SPLIT_UL_5X_SPEC: SplitTemplate = {
  id: 'ul_5x_spec',
  name: 'U/L 5× + bonus',
  sessions_per_week: 5,
  slots: [
    makeSlot('Upper A', SlotKind.UPPER),
    makeSlot('Lower A', SlotKind.LOWER),
    makeSlot('Upper B', SlotKind.UPPER),
    makeSlot('Lower B', SlotKind.LOWER),
    // Conv #22.5 — "Spec" renommé "Bonus" (terminologie user-friendly).
    makeSlot('Bonus', SlotKind.FULL),
  ],
};

export const SPLIT_PPL_6X: SplitTemplate = {
  id: 'ppl_6x',
  name: 'PPL 6×',
  sessions_per_week: 6,
  slots: [
    makeSlot('Push A', SlotKind.PUSH),
    makeSlot('Pull A', SlotKind.PULL),
    makeSlot('Legs A', SlotKind.LEGS),
    makeSlot('Push B', SlotKind.PUSH),
    makeSlot('Pull B', SlotKind.PULL),
    makeSlot('Legs B', SlotKind.LEGS),
  ],
};

export const ALL_SPLITS: readonly SplitTemplate[] = [
  SPLIT_FB_2X,
  SPLIT_FB_3X,
  SPLIT_PPL_3X,
  SPLIT_UL_4X,
  SPLIT_UL_5X_SPEC,
  SPLIT_PPL_6X,
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

// =============================================================================
// Sélection du split selon profil (cf. 09 §5.3)
// =============================================================================

/**
 * Choisit le split canonique selon `sessionsPerWeek` + `level`.
 *
 * Règles (09 §5.3) :
 *   - 2 séances → FB 2×
 *   - 3 séances → FB 3× (défaut, Schoenfeld 2019). PPL 3× nécessite opt-in user
 *     explicite (non géré ici, à passer en paramètre quand UX existera).
 *   - 4 séances → U/L 4× (gold standard)
 *   - 5 séances → U/L 5× + spec
 *   - 6 séances → PPL 6× (sauf débutant : fallback U/L 4× avec alerte UX)
 */
export function selectSplit(
  sessionsPerWeek: number,
  _muscleGoals: Record<string, MuscleGoal>,
  level: Level,
): SplitTemplate {
  if (sessionsPerWeek === 2) return SPLIT_FB_2X;
  if (sessionsPerWeek === 3) return SPLIT_FB_3X;
  if (sessionsPerWeek === 4) return SPLIT_UL_4X;
  if (sessionsPerWeek === 5) return SPLIT_UL_5X_SPEC;
  if (sessionsPerWeek === 6) {
    if (level === Level.DEBUTANT) return SPLIT_UL_4X;
    return SPLIT_PPL_6X;
  }
  throw new RangeError(`sessions_per_week=${sessionsPerWeek} hors range [2, 6]`);
}

// =============================================================================
// Placement des jours dans la semaine (cf. 09 §5.5)
// =============================================================================

/** Lundi 5 janvier 2026 (référence). */
export const REFERENCE_MONDAY = new Date(Date.UTC(2026, 0, 5));

const DEFAULT_OFFSETS: Record<number, readonly number[]> = {
  2: [0, 3], //                            lundi, jeudi
  3: [0, 2, 4], //                         lundi, mercredi, vendredi
  4: [0, 1, 3, 4], //                      lundi, mardi, jeudi, vendredi
  5: [0, 1, 3, 4, 5], //                   lundi, mardi, jeudi, vendredi, samedi
  6: [0, 1, 2, 4, 5, 6], //                lun, mar, mer, ven, sam, dim (off jeudi)
};

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Renvoie la liste des dates de séance pour la semaine.
 * Si `userPrefDays` est fourni, on l'utilise (avec validation longueur).
 * Sinon, défaut éprouvé selon `sessions_per_week` (cf. 09 §5.5).
 */
export function placeDaysInWeek(
  split: SplitTemplate,
  userPrefDays: readonly Date[] | null = null,
  referenceMonday: Date = REFERENCE_MONDAY,
): Date[] {
  const n = split.sessions_per_week;
  if (userPrefDays !== null) {
    if (userPrefDays.length !== n) {
      throw new RangeError(
        `user_pref_days a ${userPrefDays.length} jours, attendu ${n} pour split ${split.id}`,
      );
    }
    return userPrefDays.map((d) => new Date(d.getTime()));
  }
  const offsets = DEFAULT_OFFSETS[n];
  if (!offsets) {
    throw new RangeError(`Pas de placement par défaut pour ${n} séances/sem`);
  }
  return offsets.map((off) => addDays(referenceMonday, off));
}

// =============================================================================
// Vérification de la règle 48h (cf. 09 §5.5)
// =============================================================================

export interface FortyEightHourViolation {
  labelI: string;
  labelJ: string;
  sharedMuscles: string[];
  gapDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pour chaque paire de jours qui partagent un muscle (focus), écart ≥ 2 jours.
 *
 * Source : MacDougall 1995, Damas 2016 (synthèse protéique 36-48h post-effort).
 */
export function check48hRule(
  weeklyTemplate: WeeklyTemplate,
  dayDates: readonly Date[],
): FortyEightHourViolation[] {
  if (dayDates.length !== weeklyTemplate.days.length) {
    throw new RangeError(
      `day_dates a ${dayDates.length} entrées, weekly_template.days en a ${weeklyTemplate.days.length}`,
    );
  }
  const violations: FortyEightHourViolation[] = [];
  const days = weeklyTemplate.days;
  for (let i = 0; i < days.length; i += 1) {
    for (let j = i + 1; j < days.length; j += 1) {
      const di = days[i]!;
      const dj = days[j]!;
      const setI = new Set(di.target_muscles_focus);
      const shared: string[] = [];
      for (const m of dj.target_muscles_focus) if (setI.has(m)) shared.push(m);
      if (shared.length === 0) continue;
      const gap = Math.round((dayDates[j]!.getTime() - dayDates[i]!.getTime()) / MS_PER_DAY);
      if (gap < 2) {
        violations.push({
          labelI: di.label,
          labelJ: dj.label,
          sharedMuscles: shared.slice().sort(),
          gapDays: gap,
        });
      }
    }
  }
  return violations;
}
