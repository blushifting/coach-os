/**
 * Tests purs sur `src/lib/session-suggestion.ts` — suggestion prédictive de
 * séance / repos au planning (Conv #30, modèle rotation stricte + cadence).
 *
 * La fonction ne dépend ni du catalog ni des muscles : rotation par labels
 * (A→B→C…) + repos quand on atteint le max d'affilée pour la fréquence.
 */

import { describe, expect, it } from 'vitest';
import {
  suggestNextSession,
  type RecentSession,
} from '@/lib/session-suggestion';

function rs(date: string, label: string): RecentSession {
  return { date, label };
}

// Labels de rotation génériques (l'algo ne lit que l'ordre + le label).
const FB3 = ['A', 'B', 'C']; // Full Body 3×/sem
const UL4 = ['A', 'B', 'C', 'D']; // Upper/Lower 4×/sem
const SIX = ['A', 'B', 'C', 'D', 'E', 'F']; // 6×/sem

describe('suggestNextSession — Full Body 3×/sem (repos après chaque séance)', () => {
  it('la veille d’une séance → repos conseillé', () => {
    const out = suggestNextSession('2026-06-10', FB3, [rs('2026-06-09', 'A')], 3);
    expect(out).toEqual({ kind: 'rest', recentLabels: ['A'] });
  });

  it('un jour de repos après A → enchaîne sur B (rotation)', () => {
    const out = suggestNextSession('2026-06-10', FB3, [rs('2026-06-08', 'A')], 3);
    expect(out).toEqual({ kind: 'session', dayIndex: 1, previousLabel: 'A' });
  });

  it('le lendemain de B (A · repos · B) → repos conseillé', () => {
    const recent = [rs('2026-06-06', 'A'), rs('2026-06-08', 'B')];
    const out = suggestNextSession('2026-06-09', FB3, recent, 3);
    expect(out).toEqual({ kind: 'rest', recentLabels: ['B'] });
  });

  it('après A · repos · B · repos → enchaîne sur C, jamais re-A', () => {
    const recent = [rs('2026-06-06', 'A'), rs('2026-06-08', 'B')];
    const out = suggestNextSession('2026-06-10', FB3, recent, 3);
    expect(out).toEqual({ kind: 'session', dayIndex: 2, previousLabel: 'B' });
  });

  it('après C → la rotation boucle sur A', () => {
    const out = suggestNextSession('2026-06-10', FB3, [rs('2026-06-08', 'C')], 3);
    expect(out).toEqual({ kind: 'session', dayIndex: 0, previousLabel: 'C' });
  });
});

describe('suggestNextSession — 4×/sem (paires, max 2 d’affilée)', () => {
  it('la veille de A → enchaîne sur B (1 seule séance, sous le max)', () => {
    const out = suggestNextSession('2026-06-10', UL4, [rs('2026-06-09', 'A')], 4);
    expect(out).toEqual({ kind: 'session', dayIndex: 1, previousLabel: 'A' });
  });

  it('A puis B consécutifs → repos conseillé', () => {
    const recent = [rs('2026-06-08', 'A'), rs('2026-06-09', 'B')];
    const out = suggestNextSession('2026-06-10', UL4, recent, 4);
    expect(out).toEqual({ kind: 'rest', recentLabels: ['A', 'B'] });
  });

  it('A · B · repos · C → enchaîne sur D', () => {
    const recent = [
      rs('2026-06-06', 'A'),
      rs('2026-06-07', 'B'),
      rs('2026-06-09', 'C'),
    ];
    const out = suggestNextSession('2026-06-10', UL4, recent, 4);
    expect(out).toEqual({ kind: 'session', dayIndex: 3, previousLabel: 'C' });
  });
});

describe('suggestNextSession — 6×/sem (rotation complète puis repos)', () => {
  it('5 séances d’affilée (A→E) → enchaîne sur F (sous le max de 6)', () => {
    const recent = [
      rs('2026-06-05', 'A'),
      rs('2026-06-06', 'B'),
      rs('2026-06-07', 'C'),
      rs('2026-06-08', 'D'),
      rs('2026-06-09', 'E'),
    ];
    const out = suggestNextSession('2026-06-10', SIX, recent, 6);
    expect(out).toEqual({ kind: 'session', dayIndex: 5, previousLabel: 'E' });
  });

  it('6 séances d’affilée (A→F) → repos conseillé', () => {
    const recent = [
      rs('2026-06-04', 'A'),
      rs('2026-06-05', 'B'),
      rs('2026-06-06', 'C'),
      rs('2026-06-07', 'D'),
      rs('2026-06-08', 'E'),
      rs('2026-06-09', 'F'),
    ];
    const out = suggestNextSession('2026-06-10', SIX, recent, 6);
    expect(out).toEqual({
      kind: 'rest',
      recentLabels: ['A', 'B', 'C', 'D', 'E', 'F'],
    });
  });
});

describe('suggestNextSession — cas limites', () => {
  it('aucun historique récent → null', () => {
    expect(suggestNextSession('2026-06-10', FB3, [], 3)).toBeNull();
  });

  it('dernière séance hors fenêtre (> 14 j) → null', () => {
    const out = suggestNextSession('2026-06-10', FB3, [rs('2026-05-20', 'A')], 3);
    expect(out).toBeNull();
  });

  it('aucun jour-template → null', () => {
    expect(suggestNextSession('2026-06-10', [], [rs('2026-06-09', 'A')], 3)).toBeNull();
  });

  it('ignore les séances datées le jour cible ou après (non actées)', () => {
    // 4×/sem : A (J-2) + B (J-1) déjà faits, D planifié APRÈS J → ignoré.
    const recent = [
      rs('2026-06-08', 'A'),
      rs('2026-06-09', 'B'),
      rs('2026-06-11', 'D'), // postérieur → ignoré
    ];
    const out = suggestNextSession('2026-06-10', UL4, recent, 4);
    expect(out).toEqual({ kind: 'rest', recentLabels: ['A', 'B'] });
  });

  it('label inconnu dans la rotation → redémarre la rotation à l’index 0', () => {
    // "Séance libre" hors templates, la veille d’un jour de repos.
    const out = suggestNextSession('2026-06-10', FB3, [rs('2026-06-08', 'Libre')], 3);
    expect(out).toEqual({ kind: 'session', dayIndex: 0, previousLabel: 'Libre' });
  });
});
