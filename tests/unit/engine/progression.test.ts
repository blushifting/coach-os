/**
 * Dump 2.4, étape 4 — la règle unique de progression (double progression dans
 * la fourchette de l'exercice, crans appris sur les charges réellement saisies).
 * Conception : Kotsh/recherche/14_progression_charge.md.
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import { makeEquipmentOverride, makeUserState } from '@/engine/models';
import type { SessionFeedback, SetFeedback, UserState } from '@/engine/models';
import {
  BODYWEIGHT_REPS_CAP,
  INTERNAL_RPE,
  RECOVERY_RPE,
  buildPrescription,
  knownLoads,
  lastSessionSets,
  nextLoadDown,
  nextLoadUp,
  nextSetTarget,
  predictedReps,
  progressesByReps,
  rangeTrapIn,
  repRangeSuggestion,
  referenceOf,
  REP_RANGES,
  catalogRepRangeKey,
  repRangeKeyOf,
  repRangeOf,
  sessionTarget,
} from '@/engine/progression';

import { deserializeUserState, serializeUserState } from '@/db/serialize';

import { profile } from './_helpers';

const catalog = new Catalog();
const pecDeck = catalog.get('pec_deck'); // catalogue 10–15 → fourchette 10–16
const pulldown = catalog.get('lat_pulldown'); // catalogue 8–12 → fourchette 8–13
const pushup = catalog.get('pushup'); // poids du corps pur, catalogue 8–20 → 10–16
const legRaise = catalog.get('hanging_leg_raise'); // lestable, 8–15
const dips = catalog.get('dips_assisted'); // assisté, 6–12

function set(exercise_id: string, reps_done: number, load_kg: number, rpe = 9): SetFeedback {
  return { exercise_id, reps_done, load_kg, rpe_perceived: rpe };
}

function session(date: string, sets: SetFeedback[], week = 1): SessionFeedback {
  return {
    seance_date: date,
    week_in_cycle: week,
    cycle_index: 1,
    rpe_target: 9,
    sets,
    label: 'A',
  };
}

function stateWith(history: SessionFeedback[]): UserState {
  const st = makeUserState(profile());
  st.history = history;
  return st;
}

/** Historique d'Azur au pec deck : pile à 52, 59, 66 kg. */
const PEC_HISTORY = [
  session('2026-09-01', [set('pec_deck', 15, 52), set('pec_deck', 14, 52)]),
  session('2026-09-04', [set('pec_deck', 12, 59), set('pec_deck', 11, 59)]),
  session('2026-09-29', [set('pec_deck', 16, 59), set('pec_deck', 12, 66), set('pec_deck', 13, 66)]),
];

describe('fourchette et famille', () => {
  it('trois fourchettes, largeurs progressives, jamais au-delà de 16', () => {
    expect(REP_RANGES).toEqual({
      heavy: { low: 6, high: 10 },
      medium: { low: 8, high: 13 },
      light: { low: 10, high: 16 },
    });
  });

  it('le catalogue est rangé dans la fourchette au milieu le plus proche', () => {
    expect(catalogRepRangeKey(pecDeck)).toBe('light'); // 10–15
    expect(catalogRepRangeKey(pulldown)).toBe('medium'); // 8–12
    expect(catalogRepRangeKey(catalog.get('cable_lateral_raise'))).toBe('light'); // 12–20
    expect(catalogRepRangeKey(catalog.get('bench_bb'))).toBe('heavy'); // 6–10
  });

  it("le choix de l'utilisateur prime ; une clé inconnue est ignorée", () => {
    const st = makeUserState(profile());
    expect(repRangeOf(st, pecDeck)).toEqual({ low: 10, high: 16 });
    st.rep_ranges['pec_deck'] = 'medium';
    expect(repRangeKeyOf(st, pecDeck)).toBe('medium');
    expect(repRangeOf(st, pecDeck)).toEqual({ low: 8, high: 13 });
    (st.rep_ranges as Record<string, string>)['pec_deck'] = 'inconnue';
    expect(repRangeKeyOf(st, pecDeck)).toBe('light');
  });

  it('poids du corps pur et lestable sans lest progressent en reps ; avec lest, en charge', () => {
    const st = makeUserState(profile());
    expect(progressesByReps(st, pushup)).toBe(true);
    // Lestable : au poids du corps par défaut, il y reste (#63, rappelé en #82).
    expect(progressesByReps(st, legRaise)).toBe(true);
    st.equipment_overrides['hanging_leg_raise'] = makeEquipmentOverride({ pdc_only: false });
    expect(progressesByReps(st, legRaise)).toBe(false);
    expect(progressesByReps(st, pecDeck)).toBe(false);
  });
});

describe('historique : dernière séance et charges connues', () => {
  it('les charges connues sont celles déjà saisies, triées, sans doublon', () => {
    expect(knownLoads(PEC_HISTORY, 'pec_deck')).toEqual([52, 59, 66]);
    expect(knownLoads(PEC_HISTORY, 'pec_deck', [73, 59])).toEqual([52, 59, 66, 73]);
  });

  it('la dernière séance est la plus récente par date, pas par ordre de saisie', () => {
    const late = session('2026-10-01', [set('pec_deck', 10, 66)]);
    const early = session('2026-08-01', [set('pec_deck', 15, 45)]);
    expect(lastSessionSets([late, early], 'pec_deck')).toEqual([set('pec_deck', 10, 66)]);
  });

  it('une séance de semaine 5 (récupération possible) ne sert de référence que faute d’autre', () => {
    const normal = session('2026-10-01', [set('pec_deck', 12, 66)], 4);
    const recovery = session('2026-10-08', [set('pec_deck', 14, 59)], 5);
    expect(lastSessionSets([normal, recovery], 'pec_deck')).toEqual([set('pec_deck', 12, 66)]);
    expect(lastSessionSets([recovery], 'pec_deck')).toEqual([set('pec_deck', 14, 59)]);
  });

  it('jamais fait → null', () => {
    expect(lastSessionSets(PEC_HISTORY, 'lat_pulldown')).toBeNull();
  });
});

describe('crans', () => {
  it('cran suivant = charge connue juste au-dessus (la pile réelle)', () => {
    expect(nextLoadUp([52, 59, 66], 59, 1)).toBe(66);
    expect(nextLoadDown([52, 59, 66], 59, 1)).toBe(52);
  });

  it('au-delà de la plus lourde : cran habituel de la machine', () => {
    expect(nextLoadUp([52, 59, 66], 66, 1)).toBe(73);
  });

  it('une charge isolée ne fait pas inventer un cran intermédiaire (pas de 64 sur la pile)', () => {
    expect(nextLoadUp([45, 52, 54, 59], 59, 1)).toBe(66);
  });

  it('les charges lointaines (calibration ratée) ne comptent pas', () => {
    expect(nextLoadUp([20, 50, 52], 52, 1)).toBe(54);
  });

  it('une seule charge connue : incrément du catalogue', () => {
    expect(nextLoadUp([40], 40, 2.5)).toBe(42.5);
    expect(nextLoadDown([40], 40, 2.5)).toBe(37.5);
  });

  it('jamais sous zéro', () => {
    expect(nextLoadDown([2], 2, 5)).toBe(0);
  });
});

describe('référence d’une séance', () => {
  it('charge la plus lourde ayant atteint le bas de la fourchette, et ses meilleures reps', () => {
    const sets = [set('pec_deck', 16, 59), set('pec_deck', 12, 66), set('pec_deck', 13, 66)];
    expect(referenceOf(pecDeck, sets, repRangeOf(null, pecDeck))).toEqual({ load_kg: 66, reps: 13 });
  });

  it('une série lourde sous le bas ne fait pas référence', () => {
    const sets = [set('pec_deck', 12, 59), set('pec_deck', 7, 66)];
    expect(referenceOf(pecDeck, sets, repRangeOf(null, pecDeck))).toEqual({ load_kg: 59, reps: 12 });
  });

  it('aucune série au bas : la charge la plus lourde', () => {
    const sets = [set('pec_deck', 8, 66), set('pec_deck', 7, 66)];
    expect(referenceOf(pecDeck, sets, repRangeOf(null, pecDeck))).toEqual({ load_kg: 66, reps: 8 });
  });

  it('assisté : la référence est la MOINDRE assistance', () => {
    const sets = [set('dips_assisted', 10, 30), set('dips_assisted', 8, 20)];
    expect(referenceOf(dips, sets, repRangeOf(null, dips))).toEqual({ load_kg: 20, reps: 8 });
  });
});

describe('prescription de la séance suivante', () => {
  const e1rm = 90;

  it('dans la fourchette : même charge, une rep de plus', () => {
    const st = stateWith(PEC_HISTORY); // dernière : 13 × 66
    expect(sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: e1rm, recovery: false })).toEqual({
      load_kg: 66,
      reps: 14,
    });
  });

  it('jamais au-dessus du haut de la fourchette', () => {
    const st = stateWith([session('2026-10-01', [set('pec_deck', 14, 66)])]);
    expect(sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: e1rm, recovery: false }).reps).toBe(15);
  });

  it('haut atteint : cran suivant, reps prévues par le Plafond et bornées à la fourchette', () => {
    const st = stateWith([...PEC_HISTORY, session('2026-10-02', [set('pec_deck', 16, 66)])]);
    const t = sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: e1rm, recovery: false });
    expect(t.load_kg).toBe(73);
    expect(t.reps).toBeGreaterThanOrEqual(10);
    expect(t.reps).toBeLessThanOrEqual(16);
  });

  it('sous le bas : cran inférieur', () => {
    const st = stateWith([...PEC_HISTORY, session('2026-10-02', [set('pec_deck', 8, 66)])]);
    expect(sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: e1rm, recovery: false }).load_kg).toBe(59);
  });

  it('suit la charge choisie par l’utilisateur la dernière fois (plus de prescription en retard)', () => {
    const st = stateWith([
      session('2026-10-01', [set('lat_pulldown', 10, 52)]),
      session('2026-10-05', [set('lat_pulldown', 11, 54), set('lat_pulldown', 10, 54)]),
    ]);
    expect(sessionTarget({ state: st, exercise: pulldown, e1rmTotal: 70, recovery: false })).toEqual({
      load_kg: 54,
      reps: 12,
    });
  });

  it('ne prescrit qu’une charge déjà utilisée (pas de 53 kg entre 52 et 54)', () => {
    const st = stateWith([
      session('2026-10-01', [set('lat_pulldown', 13, 52)]),
      session('2026-10-03', [set('lat_pulldown', 9, 54)]),
      session('2026-10-05', [set('lat_pulldown', 13, 52)]),
    ]);
    expect(sessionTarget({ state: st, exercise: pulldown, e1rmTotal: 70, recovery: false }).load_kg).toBe(54);
  });

  it('jamais fait : charge estimée depuis le Plafond, au milieu de la fourchette', () => {
    const st = stateWith([]);
    const t = sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: 100, recovery: false });
    expect(t.reps).toBe(13);
    expect(t.load_kg).toBeGreaterThan(0);
    expect(t.load_kg).toBeLessThan(100);
  });

  it('récupération : charge connue sous 90 %, mêmes reps', () => {
    const st = stateWith(PEC_HISTORY); // normal : 66 × 14
    expect(sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: e1rm, recovery: true })).toEqual({
      load_kg: 59,
      reps: 14,
    });
  });

  it('la prescription ne dépend ni de l’intention ni du Plafond quand l’exercice a été fait', () => {
    const st = stateWith(PEC_HISTORY);
    const a = sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: 50, recovery: false });
    const b = sessionTarget({ state: st, exercise: pecDeck, e1rmTotal: 150, recovery: false });
    expect(a).toEqual(b);
  });
});

describe('poids du corps : seules les reps progressent, jamais de lest imposé', () => {
  it('une rep de plus que la meilleure série de la dernière fois, charge 0', () => {
    const st = stateWith([session('2026-10-01', [set('pushup', 20, 0), set('pushup', 18, 0)])]);
    expect(sessionTarget({ state: st, exercise: pushup, e1rmTotal: 100, recovery: false })).toEqual({
      load_kg: 0,
      reps: 21,
    });
  });

  it('au-delà du haut de la fourchette on continue en reps (pas de passage au lest)', () => {
    const st = stateWith([session('2026-10-01', [set('hanging_leg_raise', 22, 0)])]);
    expect(sessionTarget({ state: st, exercise: legRaise, e1rmTotal: 100, recovery: false })).toEqual({
      load_kg: 0,
      reps: 23,
    });
  });

  it('plafonné à BODYWEIGHT_REPS_CAP', () => {
    const st = stateWith([session('2026-10-01', [set('pushup', 35, 0)])]);
    expect(sessionTarget({ state: st, exercise: pushup, e1rmTotal: 100, recovery: false }).reps).toBe(
      BODYWEIGHT_REPS_CAP,
    );
  });

  it('jamais fait : bas de la fourchette', () => {
    const st = stateWith([]);
    expect(sessionTarget({ state: st, exercise: pushup, e1rmTotal: 100, recovery: false })).toEqual({
      load_kg: 0,
      reps: 10,
    });
  });

  it('avec du lest choisi : règle des charges', () => {
    const st = stateWith([session('2026-10-01', [set('hanging_leg_raise', 15, 5)])]);
    st.equipment_overrides['hanging_leg_raise'] = makeEquipmentOverride({ pdc_only: false });
    const t = sessionTarget({ state: st, exercise: legRaise, e1rmTotal: 120, recovery: false });
    expect(t.load_kg).toBeGreaterThan(5);
  });
});

describe('assisté : le cran plus dur est une assistance plus faible', () => {
  it('haut atteint → moins d’assistance', () => {
    const st = stateWith([
      session('2026-09-01', [set('dips_assisted', 8, 30)]),
      session('2026-10-01', [set('dips_assisted', 12, 25)]),
    ]);
    const t = sessionTarget({ state: st, exercise: dips, e1rmTotal: 70, recovery: false });
    expect(t.load_kg).toBeLessThan(25);
  });
});

describe('prévision de reps depuis le Plafond', () => {
  it('à l’effort de référence, bornée à la fourchette', () => {
    const range = repRangeOf(null, pecDeck);
    // Plafond 100 : à 75 kg, n_équiv ≈ 10, reps à RPE 9 ≈ 9 → bornées à 10.
    expect(predictedReps(pecDeck, 100, 75, 80, range)).toBe(10);
    expect(predictedReps(pecDeck, 100, 30, 80, range)).toBe(16);
    expect(predictedReps(pecDeck, null, 30, 80, range)).toBe(10);
  });
});

describe('en séance : la même règle série après série', () => {
  const st = stateWith(PEC_HISTORY);

  it('haut atteint → cran suivant pour les séries d’après', () => {
    const t = nextSetTarget({ state: st, exercise: pecDeck, e1rmTotal: 90, load_kg: 59, reps: 16 });
    expect(t?.load_kg).toBe(66);
    expect(t?.reps).not.toBeNull();
  });

  it('sous le bas → cran inférieur', () => {
    const t = nextSetTarget({ state: st, exercise: pecDeck, e1rmTotal: 90, load_kg: 66, reps: 8 });
    expect(t?.load_kg).toBe(59);
  });

  it('dans la fourchette → même charge, reps inchangées', () => {
    expect(nextSetTarget({ state: st, exercise: pecDeck, e1rmTotal: 90, load_kg: 66, reps: 12 })).toEqual({
      load_kg: 66,
      reps: null,
    });
  });

  it('une charge saisie dans la séance compte comme connue', () => {
    const t = nextSetTarget({
      state: st,
      exercise: pecDeck,
      e1rmTotal: 90,
      load_kg: 66,
      reps: 16,
      sessionLoads: [69],
    });
    expect(t?.load_kg).toBe(69);
  });

  it('poids du corps → rien ne change', () => {
    expect(nextSetTarget({ state: st, exercise: pushup, e1rmTotal: 90, load_kg: 0, reps: 25 })).toBeNull();
  });
});

describe('buildPrescription', () => {
  it('effort interne 9 en semaine normale, 6 en récupération ; repos du catalogue', () => {
    const st = stateWith(PEC_HISTORY);
    const normal = buildPrescription(pecDeck, 90, st.profile, { state: st });
    expect(normal).toEqual({
      exercise_id: 'pec_deck',
      reps: 14,
      load_kg: 66,
      rpe_target: INTERNAL_RPE,
      rest_s: pecDeck.repos_s,
    });
    const rec = buildPrescription(pecDeck, 90, st.profile, { state: st, deloadActive: true });
    expect(rec.rpe_target).toBe(RECOVERY_RPE);
    expect(rec.load_kg).toBe(59);
  });

  it('sans état : exercice traité comme jamais fait', () => {
    const p = buildPrescription(pecDeck, 100, profile());
    expect(p.reps).toBe(13);
    expect(p.load_kg).toBeGreaterThan(0);
  });
});

describe('fourchette trop étroite pour les crans : proposition de fin de séance', () => {
  const raise = catalog.get('cable_lateral_raise');
  const range = REP_RANGES.medium; // 8–13

  it('piège dans une séance : le haut atteint, puis une série plus lourde sous le bas', () => {
    const sets = [set('cable_lateral_raise', 13, 9), set('cable_lateral_raise', 7, 11)];
    expect(rangeTrapIn(raise, sets, null, range)).toEqual({ fromLoad: 9, fromReps: 13, toLoad: 11, toReps: 7 });
  });

  it('piège d’une séance à l’autre : terminé en haut, la suivante démarre plus lourd sous le bas', () => {
    const prev = [set('cable_lateral_raise', 13, 9)];
    const cur = [set('cable_lateral_raise', 7, 11), set('cable_lateral_raise', 12, 9)];
    expect(rangeTrapIn(raise, cur, prev, range)?.toLoad).toBe(11);
  });

  it('pas de piège si la série plus lourde reste dans la fourchette', () => {
    const sets = [set('cable_lateral_raise', 13, 9), set('cable_lateral_raise', 9, 11)];
    expect(rangeTrapIn(raise, sets, null, range)).toBeNull();
  });

  /** Élévation latérale piégée deux fois… mais déjà en 10–16 (rangement du catalogue). */
  function trapped(): UserState {
    return stateWith([
      session('2026-10-01', [set('cable_lateral_raise', 16, 9), set('cable_lateral_raise', 7, 11)]),
      session('2026-10-04', [set('cable_lateral_raise', 16, 9), set('cable_lateral_raise', 6, 11)]),
    ]);
  }

  it('deux séances de suite piégées → proposer la fourchette plus large', () => {
    const pulldownTrap = stateWith([
      session('2026-10-01', [set('lat_pulldown', 13, 52), set('lat_pulldown', 7, 60)]),
      session('2026-10-04', [set('lat_pulldown', 13, 52), set('lat_pulldown', 6, 60)]),
    ]);
    const sg = repRangeSuggestion(pulldownTrap, pulldown);
    expect(sg).toEqual({
      exercise_id: 'lat_pulldown',
      from: 'medium',
      to: 'light',
      trap: { fromLoad: 52, fromReps: 13, toLoad: 60, toReps: 6 },
    });
  });

  it('une seule séance piégée ne suffit pas', () => {
    const st = stateWith([
      session('2026-10-01', [set('lat_pulldown', 12, 52)]),
      session('2026-10-04', [set('lat_pulldown', 13, 52), set('lat_pulldown', 6, 60)]),
    ]);
    expect(repRangeSuggestion(st, pulldown)).toBeNull();
  });

  it('un choix explicite (même « garder ») coupe les propositions', () => {
    const st = stateWith([
      session('2026-10-01', [set('lat_pulldown', 13, 52), set('lat_pulldown', 7, 60)]),
      session('2026-10-04', [set('lat_pulldown', 13, 52), set('lat_pulldown', 6, 60)]),
    ]);
    st.rep_ranges['lat_pulldown'] = 'medium';
    expect(repRangeSuggestion(st, pulldown)).toBeNull();
  });

  it('déjà la plus large, ou poids du corps : rien à proposer', () => {
    expect(repRangeSuggestion(trapped(), raise)).toBeNull(); // 10–16, la plus large
    expect(repRangeSuggestion(stateWith([]), pushup)).toBeNull();
  });

  it('le choix de fourchette survit à la sauvegarde ; une clé inconnue est ignorée', () => {
    const st = makeUserState(profile());
    st.rep_ranges = { pec_deck: 'medium' };
    const back = deserializeUserState(serializeUserState(st));
    expect(back.rep_ranges).toEqual({ pec_deck: 'medium' });
    const raw = { ...serializeUserState(st), rep_ranges: { pec_deck: 'xxl', lat_pulldown: 'heavy' } };
    expect(deserializeUserState(raw).rep_ranges).toEqual({ lat_pulldown: 'heavy' });
    const { rep_ranges: _absent, ...old } = serializeUserState(st);
    void _absent;
    expect(deserializeUserState(old).rep_ranges).toEqual({});
  });
});
