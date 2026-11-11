/**
 * Dump 2.4, étape 1 (D6) — la semaine du cycle se lit sur la date.
 */

import { describe, it, expect } from 'vitest';
import {
  alignWeeksOnDates,
  prescriptionWeek,
  weekOfCycle,
} from '@/engine/cycle-week';

describe('weekOfCycle — tranches de 7 jours depuis le début du cycle', () => {
  // Cycle 4 d'Azur : commencé le mardi 20/10/2026 → semaines du mardi au lundi.
  const debut = '2026-10-20';

  it('le jour du début et les six suivants sont en semaine 1', () => {
    expect(weekOfCycle('2026-10-20', debut)).toBe(1);
    expect(weekOfCycle('2026-10-26', debut)).toBe(1); // lundi : dernier jour
  });

  it('le 8ᵉ jour ouvre la semaine 2', () => {
    expect(weekOfCycle('2026-10-27', debut)).toBe(2);
    expect(weekOfCycle('2026-10-28', debut)).toBe(2);
    expect(weekOfCycle('2026-10-30', debut)).toBe(2);
  });

  it('les semaines 3 à 5 suivent la même grille', () => {
    expect(weekOfCycle('2026-11-03', debut)).toBe(3);
    expect(weekOfCycle('2026-11-11', debut)).toBe(4);
    expect(weekOfCycle('2026-11-17', debut)).toBe(5);
    expect(weekOfCycle('2026-11-23', debut)).toBe(5);
  });

  it('après la fin prévue du cycle, la semaine 6 existe', () => {
    expect(weekOfCycle('2026-11-24', debut)).toBe(6);
  });

  it('une date avant le début du cycle compte en semaine 1', () => {
    expect(weekOfCycle('2026-10-18', debut)).toBe(1);
  });

  it("l'heure d'une date ISO complète ne compte pas", () => {
    expect(weekOfCycle('2026-10-26T23:30:00.000Z', debut)).toBe(1);
  });

  it("le changement d'heure ne décale pas la grille", () => {
    // Passage à l'heure d'hiver le 25/10/2026.
    expect(weekOfCycle('2026-11-02', '2026-10-20')).toBe(2);
    expect(weekOfCycle('2026-11-03', '2026-10-20')).toBe(3);
  });
});

describe('prescriptionWeek — ramène la semaine dans 1..5', () => {
  it('une semaine 6 se prescrit dans les tables de la semaine 5', () => {
    expect(prescriptionWeek(6)).toBe(5);
    expect(prescriptionWeek(3)).toBe(3);
  });
});

describe('alignWeeksOnDates — réparation des numéros enregistrés', () => {
  const cycles = [{ cycle_index: 4, start_date: '2026-10-20' }];

  it("recale une séance programmée d'avance sur la semaine de sa date", () => {
    // Le 23/10, Azur a programmé la séance du 30/10 : enregistrée « semaine 1 ».
    const rows = [
      { seance_date: '2026-10-30', cycle_index: 4, week_in_cycle: 1, plan: { week_in_cycle: 1 } },
    ];
    const [row] = alignWeeksOnDates(
      rows,
      cycles,
      (r) => r.seance_date,
      (r, week) => ({ plan: { ...r.plan, week_in_cycle: week } }),
    );
    expect(row!.week_in_cycle).toBe(2);
    expect(row!.plan.week_in_cycle).toBe(2);
    // L'original n'est pas modifié.
    expect(rows[0]!.week_in_cycle).toBe(1);
  });

  it("laisse intact un élément dont le cycle n'est pas connu", () => {
    const row = { seance_date: '2026-10-30', cycle_index: 9, week_in_cycle: 3 };
    expect(alignWeeksOnDates([row], cycles, (r) => r.seance_date)[0]).toBe(row);
  });
});
