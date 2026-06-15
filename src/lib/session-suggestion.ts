/**
 * Suggestion prédictive de séance au moment de planifier (Conv #30).
 *
 * Remplace l'ancien « rythme imposé » du calendrier (`weeklyTrainingPattern`,
 * retiré) ET la 1re version « chevauchement musculaire » (Conv #30, abandonnée :
 * elle ne respectait pas la rotation et ne cadençait pas le repos).
 *
 * Modèle retenu : **rotation stricte + cadence selon la fréquence**. La
 * séparation des muscles est déjà gérée par la structure du split (l'algo qui
 * construit A/B/C…) ; la suggestion n'a pas à la refaire. Elle se contente, au
 * moment de planifier le jour J :
 *   1. de compter les **jours d'entraînement consécutifs** juste avant J
 *      (on s'arrête au 1er jour de repos) ;
 *   2. si ce nombre atteint le **max autorisé pour la fréquence** → repos ;
 *   3. sinon → **séance suivante en rotation stricte** (dernière + 1, en boucle).
 *
 * On ne regarde QUE les séances datées avant J (faites ou planifiées) : tout ce
 * qui est prévu après J est ignoré (« non acté »).
 */

/** Sécurité anti-boucle + fenêtre de pertinence de l'historique récent. */
const MAX_LOOKBACK_DAYS = 14;

/**
 * Max de séances d'affilée avant un repos conseillé, selon la fréquence hebdo.
 * Validé avec Azur (Conv #30) : 3×=A·repos·B·repos·C·repos ; 4×=paires
 * (AB·repos·CD·repos) ; 5×=blocs de 3 ; 6×=rotation complète ABCDEF puis repos.
 */
const CADENCE: Readonly<Record<number, number>> = { 3: 1, 4: 2, 5: 3, 6: 6 };

function maxConsecutiveBeforeRest(sessionsPerWeek: number): number {
  const n = Math.round(sessionsPerWeek);
  if (CADENCE[n] !== undefined) return CADENCE[n]!;
  if (n <= 3) return 1; // 1-2×/sem : repos entre chaque
  return n; // 7×+ : pas de repos forcé avant la rotation complète
}

/** Une séance récente (faite ou planifiée). */
export interface RecentSession {
  readonly date: string; // YYYY-MM-DD
  readonly label: string;
}

export type SessionSuggestion =
  | {
      readonly kind: 'session';
      /** Index du jour-template du cycle à enchaîner (rotation stricte). */
      readonly dayIndex: number;
      /** Label de la dernière séance (pour « tu as fait X »), ou null. */
      readonly previousLabel: string | null;
    }
  | {
      readonly kind: 'rest';
      /** Labels de la série consécutive, dans l'ordre chronologique. */
      readonly recentLabels: readonly string[];
    }
  | null;

/** YYYY-MM-DD décalé de `delta` jours (calcul calendaire local). */
function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Calcule la suggestion pour `targetDate`. Renvoie `null` s'il n'y a aucun
 * jour-template ou aucun historique récent (rien à prédire).
 *
 * @param dayLabels Labels des jours du cycle, dans l'ordre de rotation (A, B…).
 * @param recent    Séances récentes (faites + planifiées), date + label.
 * @param sessionsPerWeek Fréquence hebdo (fixe la cadence de repos).
 */
export function suggestNextSession(
  targetDate: string,
  dayLabels: readonly string[],
  recent: readonly RecentSession[],
  sessionsPerWeek: number,
): SessionSuggestion {
  if (dayLabels.length === 0) return null;

  // Séances strictement avant J, dans la fenêtre récente, indexées par date.
  const windowCutoff = shiftDay(targetDate, -MAX_LOOKBACK_DAYS);
  const byDate = new Map<string, string[]>();
  let lastLabel: string | null = null;
  let lastDate = '';
  for (const s of recent) {
    if (s.date >= targetDate) continue; // on ignore J et tout ce qui suit
    if (s.date < windowCutoff) continue; // trop ancien → non pertinent
    const labels = byDate.get(s.date) ?? [];
    labels.push(s.label);
    byDate.set(s.date, labels);
    if (s.date > lastDate) {
      lastDate = s.date;
      lastLabel = s.label;
    }
  }
  if (lastLabel === null) return null; // pas d'historique récent

  // Jours d'entraînement consécutifs avant J (stop au 1er jour de repos).
  const recentLabels: string[] = []; // du plus récent au plus ancien
  let consecutive = 0;
  let cursor = shiftDay(targetDate, -1);
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const labels = byDate.get(cursor);
    if (labels === undefined) break;
    consecutive += 1;
    recentLabels.push(...labels);
    cursor = shiftDay(cursor, -1);
  }

  // Repos conseillé si on a atteint le max d'affilée pour cette fréquence.
  if (consecutive >= maxConsecutiveBeforeRest(sessionsPerWeek)) {
    return { kind: 'rest', recentLabels: recentLabels.slice().reverse() };
  }

  // Sinon : rotation stricte (dernière séance + 1, en boucle).
  const lastIdx = dayLabels.indexOf(lastLabel);
  const nextIdx = lastIdx >= 0 ? (lastIdx + 1) % dayLabels.length : 0;
  return { kind: 'session', dayIndex: nextIdx, previousLabel: lastLabel };
}
