/**
 * Dump 2.4, n° 26 — « Tu as fait la séance C » alors que les séances ont été
 * renommées : le nom vient du jour du programme, pas du label de rotation.
 */

import { describe, it, expect } from 'vitest';
import { dayDisplayName } from '@/lib/session-label';

describe('dayDisplayName — nom du jour du programme', () => {
  const plan = {
    days: [
      { label: 'A', custom_name: 'Push A' },
      { label: 'B', custom_name: 'Push B' },
      { label: 'C', custom_name: null },
    ],
  };

  it('affiche le nom choisi pour le jour qui porte ce label', () => {
    expect(dayDisplayName('A', plan)).toBe('Push A');
    expect(dayDisplayName('B', plan)).toBe('Push B');
  });

  it("retombe sur le label quand le jour n'a pas été renommé", () => {
    expect(dayDisplayName('C', plan)).toBe('C');
  });

  it('hors programme (séance libre, pas de programme), garde le label', () => {
    expect(dayDisplayName('Séance libre', plan)).toBe('Séance libre');
    expect(dayDisplayName('Full A', null)).toBe('A — Full');
  });
});
