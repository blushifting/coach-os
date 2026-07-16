/**
 * Wrapper minimal autour de la Vibration API (Conv #11i piste E).
 *
 * - Android Chrome + Firefox supportent `navigator.vibrate`.
 * - iOS Safari ne supporte **pas** la Vibration API web (et probablement
 *   jamais — Apple privilégie le haptique natif). Les appels sont alors
 *   silencieux.
 * - Préférences utilisateur "réduire les mouvements" : `prefers-reduced-motion`
 *   désactive les vibrations (politesse vis-à-vis des utilisateurs
 *   sensibles aux stimuli vestibulaires).
 *
 * Patterns : un nombre = durée en ms. Un tableau = pattern (vibrer/pause/...).
 */

import { prefersReducedMotion } from '@/lib/motion';

export type HapticEvent =
  | 'tap-soft' // tap minimal (préview, hover-style)
  | 'set-done' // série validée
  | 'set-undone' // série déverrouillée
  | 'session-done' // séance terminée
  | 'pr' // nouveau record personnel (e1RM en hausse)
  | 'error'; // saisie invalide

const PATTERNS: Record<HapticEvent, number | number[]> = {
  'tap-soft': 10,
  'set-done': 25,
  'set-undone': 12,
  'session-done': [40, 60, 40, 60, 80],
  pr: [30, 50, 30, 50, 30, 50, 80],
  error: [15, 40, 15],
};

export function triggerHaptic(event: HapticEvent): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate(PATTERNS[event]);
  } catch {
    /* API présente mais bloquée par le navigateur */
  }
}
