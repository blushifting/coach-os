/**
 * Dump 2.4, étape 1 (D6) — **une seule définition de la semaine : les dates.**
 *
 * La semaine *k* d'un cycle est la tranche de 7 jours qui commence à
 * `début du cycle + 7 × (k − 1)`. Le jour de départ dépend donc du cycle (un
 * cycle commencé un mardi a des semaines du mardi au lundi) : c'est voulu.
 *
 * C'est le **seul** calcul de « quelle semaine est-ce » de l'application.
 * Le champ `week_in_cycle` porté par les séances, les feedbacks et les
 * instantanés de Plafond n'en est plus qu'une copie : il est posé par ce calcul
 * à l'écriture et recalculé à la lecture (`alignWeeksOnDates`), parce que le
 * numéro enregistré a longtemps été celui du jour de *création* de la séance
 * (une séance programmée d'avance restait dans la semaine où on l'avait
 * programmée — n° 2 du dump).
 *
 * Pas de plafond à 5 : une séance faite après la fin prévue du cycle, avant que
 * l'utilisateur ne le clôture, tombe en semaine 6 (ou plus). C'est la
 * prescription, pas ce calcul, qui ramène la semaine dans 1..5.
 */

/** Nombre de semaines prévues dans un cycle (4 de travail + 1 de récupération). */
export const CYCLE_WEEKS = 5;

/** Jours entiers entre deux dates `YYYY-MM-DD` (b − a), insensible aux heures d'été. */
function daysBetween(a: string, b: string): number {
  const toUtc = (key: string): number => {
    const [y, m, d] = key.slice(0, 10).split('-').map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/**
 * Semaine du cycle (1, 2, …) qui contient `dateKey`, pour un cycle commencé le
 * `cycleStart`. Les deux sont des dates `YYYY-MM-DD` (une date ISO complète est
 * acceptée, seule sa partie date compte).
 *
 * Une date antérieure au début du cycle compte en semaine 1 : cela arrive pour
 * une séance programmée avant la première séance réelle, quand le début du
 * cycle est ré-ancré sur celle-ci.
 */
export function weekOfCycle(dateKey: string, cycleStart: string): number {
  const diff = daysBetween(cycleStart, dateKey);
  if (diff < 0) return 1;
  return Math.floor(diff / 7) + 1;
}

/** Semaine ramenée dans 1..5, pour la prescription (tables indexées par semaine). */
export function prescriptionWeek(week: number): number {
  return Math.max(1, Math.min(CYCLE_WEEKS, week));
}

interface CycleStartRow {
  readonly cycle_index: number;
  readonly start_date: string;
}

/** Date de début du cycle `cycleIndex`, ou `null` s'il n'est pas connu. */
export function cycleStartOf(
  cycles: ReadonlyArray<CycleStartRow>,
  cycleIndex: number,
): string | null {
  return cycles.find((c) => c.cycle_index === cycleIndex)?.start_date ?? null;
}

interface WeekStamped {
  week_in_cycle: number;
  cycle_index: number;
}

/**
 * Recalcule `week_in_cycle` d'une liste d'éléments datés à partir de leur date
 * et du début de leur cycle. Renvoie de **nouveaux** objets quand la semaine
 * change (les autres sont rendus tels quels). Un élément dont le cycle est
 * inconnu garde sa valeur : on ne devine pas.
 *
 * `inner` permet de réaligner aussi la copie imbriquée (le `feedback` d'une
 * ligne de feedback, le `plan` d'une ligne de séance).
 */
export function alignWeeksOnDates<T extends WeekStamped>(
  rows: ReadonlyArray<T>,
  cycles: ReadonlyArray<CycleStartRow>,
  dateOf: (row: T) => string,
  inner?: (row: T, week: number) => Partial<T>,
): T[] {
  return rows.map((row) => {
    const start = cycleStartOf(cycles, row.cycle_index);
    if (start === null) return row;
    const week = weekOfCycle(dateOf(row), start);
    if (week === row.week_in_cycle && inner === undefined) return row;
    return { ...row, week_in_cycle: week, ...(inner?.(row, week) ?? {}) };
  });
}
