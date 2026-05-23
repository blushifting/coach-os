/**
 * Génère le snapshot JSON démo "persona Alex" — exécuté offline, sortie commitée.
 *
 *   npx tsx scripts/generate-alex-demo.mts
 *
 * Pourquoi un script TS plutôt que le simulator Python du prototype :
 * - L'engine TS est la source de vérité actuelle. Régénérer via Python force
 *   à maintenir un mapping dataclass→SerializedUserState qui drifte à chaque
 *   évolution des types (Conv #11+, #12 ont déjà bougé `MuscleGoal`,
 *   `EquipmentOverride`, `weekly_volume_debt`). Plus simple de scripter sur
 *   l'engine livré.
 * - Pour un tuto pédagogique, on veut un parcours **déterministe** où chaque
 *   phénomène (PR / déload / swap / ajustement RPE / séance ratée) tombe à un
 *   endroit précis et reconnaissable, pas une distribution stochastique.
 *
 * Cf. backlog Conv #13 dans `project_coach_os.md` pour la spec persona.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Catalog } from '../src/engine/catalog';
import { startUser } from '../src/engine/engine';
import {
  ChargeType,
  Level,
  MuscleObjective,
  MuscleStatus,
  Objective,
  ProgressionRule,
  Sex,
  makeMuscleGoal,
  makePlannedExercise,
  makeProfile,
  makeWeeklyTemplate,
  type PlannedExercise,
  type SessionFeedback,
  type SessionPlan,
  type SetFeedback,
  type SetPrescription,
  type UserState,
  type WeeklyTemplate,
  type CycleReview,
} from '../src/engine/models';
import { SuggestedAction } from '../src/engine/models';
import type {
  CycleRow,
  E1rmSnapshotRow,
  FeedbackRow,
  SerializedUserState,
  SessionRow,
} from '../src/db/schema';
import { demoSnapshotSchema, type DemoSnapshot } from '../src/lib/demo-schema';

// =============================================================================
// Constantes scénario
// =============================================================================

/**
 * Aujourd'hui dans la démo = 2026-05-19 (date de génération).
 * Le cycle 2 démarre en début de semaine 4, donc on remonte 7 semaines + 3 jours
 * pour caler le J1 du cycle 1 sur un lundi. → 2026-03-23.
 */
const CYCLE_1_START = '2026-03-23';
const DEMO_TODAY = '2026-05-19';

const ALEX_PROFILE = {
  sex: Sex.HOMME,
  age: 30,
  level: Level.INTERMEDIAIRE,
  /** objectif global = path "force+hypertrophie 50/50" via muscle_goals fins ci-dessous */
  objective: Objective.HYPERTROPHIE,
  sessions_per_week: 4,
  bodyweight_kg: 75,
  available_equip: new Set([
    'barbell',
    'dumbbells',
    'rack',
    'bench',
    'pullup_bar',
    'pull_assist',
    'machine_pulldown',
    'machine_pec',
    'cable',
    'bench_decline',
  ]),
};

/** e1rm initiaux (intermédiaire **début 2e année**, plafond plus accessible
 *  que les standards strengthlevel.com inter "moyen" 2-3 ans).
 *  Conv #17b — baisse ~20 % vs initiaux Conv #16 pour rendre Alex plus
 *  réaliste pour un user qui découvre Coach OS (et éviter l'effet
 *  "200 kg leg press" qui paraît extra-ordinaire). */
const ALEX_INITIAL_E1RM: Record<string, number> = {
  squat_bb_high: 95,
  deadlift_conv: 110,
  bench_bb: 70,
  ohp_bb_standing: 45,
  bb_row: 65,
  pullup_assisted: -25, // assistance plus marquée (Alex peine encore aux tractions)
  bb_curl: 27.5,
  triceps_pushdown_rope: 20,
  leg_press_45: 160,
};

/**
 * Plafonds à poser à la transition cycle 1 → cycle 2, pour les 3 exos
 * swappés (front_squat, pullup, ohp_db_seated). Sans ça, aucun snapshot
 * e1RM n'est créé pour ces exos → ils apparaissent "non calibrés" dans
 * l'UI démo, ce qui casse la cohérence ("Alex est censé être un user
 * confirmé depuis 8+ semaines"). Conv #16.
 */
const ALEX_SWAP_E1RM: Record<string, number> = {
  // Conv #17b — alignés sur les nouveaux plafonds initiaux (Alex inter
  // début 2e année, baisse ~20 %). Logique conservée :
  //  - front squat ≈ 80 % du back squat
  //  - pullup libres ≈ bw seul (75 kg) sans lest (Alex commence tout juste
  //    à tenir les tractions strictes après son cycle assisted)
  //  - ohp DM ≈ −10 % vs OHP barre, **par haltère** (loadLabel DUMBBELL)
  front_squat: 75,
  pullup: 75,
  ohp_db_seated: 20,
};

/** k_user par défaut (cf. prescription.ts, k de Epley standard). */
const DEFAULT_K = 0.0333;

// =============================================================================
// Cycle plans UL 4 jours
// =============================================================================

function makePE(args: {
  id: string;
  base: number;
  prog: number[];
  role?: string;
  intensity?: string;
  rule?: ProgressionRule;
}): PlannedExercise {
  return makePlannedExercise({
    exercise_id: args.id,
    base_sets: args.base,
    progression: args.prog,
    role: args.role ?? null,
    intensity_scheme: args.intensity ?? null,
    progression_rule: args.rule ?? null,
  });
}

/**
 * Progression typique cycle 5w UL : sets 3→4→4→5 puis 2 (déload).
 * Accessoires constants 3 sets sauf déload 2.
 */
const PROG_MAIN = [3, 4, 4, 5, 2];
const PROG_ACC = [3, 3, 3, 3, 2];

function buildCyclePlan(cycleIdx: number, swapped: boolean): WeeklyTemplate {
  /** Cycle 1 : équipements de base. Cycle 2 (post-swaps) : 3 substitutions durables. */
  const squatId = swapped ? 'front_squat' : 'squat_bb_high';
  const pullupId = swapped ? 'pullup' : 'pullup_assisted';
  const ohpId = swapped ? 'ohp_db_seated' : 'ohp_bb_standing';

  return makeWeeklyTemplate({
    cycle_index: cycleIdx,
    rationale:
      cycleIdx === 1
        ? 'Cycle 1 — installation des patterns Upper/Lower 4j force+hypertrophie.'
        : 'Cycle 2 — swaps durables après bilan (front squat / tractions libres / DM haltères).',
    days: [
      {
        day_index: 0,
        label: 'Upper A',
        target_muscles_focus: ['pectoraux', 'triceps', 'deltos_lateraux'],
        exercises: [
          makePE({ id: 'bench_bb', base: 4, prog: PROG_MAIN, role: 'main_push_h', intensity: 'force', rule: ProgressionRule.DOUBLE_PROGRESSION }),
          makePE({ id: pullupId, base: 3, prog: PROG_ACC, role: 'main_pull_v', intensity: 'hyp' }),
          makePE({ id: ohpId, base: 3, prog: PROG_ACC, role: 'main_push_v', intensity: 'hyp' }),
          makePE({ id: 'triceps_pushdown_rope', base: 3, prog: PROG_ACC, intensity: 'hyp' }),
        ],
      },
      {
        day_index: 1,
        label: 'Lower A',
        target_muscles_focus: ['quadriceps', 'fessiers', 'ischios'],
        exercises: [
          makePE({ id: squatId, base: 4, prog: PROG_MAIN, role: 'main_squat', intensity: 'force', rule: ProgressionRule.DOUBLE_PROGRESSION }),
          makePE({ id: 'deadlift_conv', base: 3, prog: PROG_ACC, role: 'main_hinge', intensity: 'force' }),
        ],
      },
      {
        day_index: 2,
        label: 'Upper B',
        target_muscles_focus: ['dos_largeur', 'dos_epaisseur', 'biceps'],
        exercises: [
          makePE({ id: 'bb_row', base: 4, prog: PROG_MAIN, role: 'main_pull_h', intensity: 'force', rule: ProgressionRule.DOUBLE_PROGRESSION }),
          makePE({ id: pullupId, base: 3, prog: PROG_ACC, intensity: 'hyp' }),
          makePE({ id: 'bb_curl', base: 3, prog: PROG_ACC, intensity: 'hyp' }),
          makePE({ id: 'triceps_pushdown_rope', base: 3, prog: PROG_ACC, intensity: 'hyp' }),
        ],
      },
      {
        day_index: 3,
        label: 'Lower B',
        target_muscles_focus: ['ischios', 'fessiers', 'quadriceps'],
        exercises: [
          makePE({ id: 'deadlift_conv', base: 4, prog: PROG_MAIN, role: 'main_hinge', intensity: 'force', rule: ProgressionRule.DOUBLE_PROGRESSION }),
          // Conv #15 — accessoire jambes : leg press au lieu d'un 2e squat.
          // Évite l'effet "dents de scie" sur la courbe Force du squat main
          // (charge/reps différents entre rôle main et accessoire).
          makePE({ id: 'leg_press_45', base: 3, prog: PROG_ACC, intensity: 'hyp' }),
        ],
      },
    ],
    warnings: [],
  });
}

// =============================================================================
// Scénario : séquence de séances scriptées
// =============================================================================

/**
 * Perturbations applicables à une séance scriptée :
 * - `rpeBias` : décale le RPE perçu de toutes les séries (positif = plus dur).
 * - `loadBias` : décale toutes les charges (positif = plus lourd).
 * - `repsDelta` : décale les reps faites (négatif = échec partiel).
 * - `skip` : la séance est marquée 'skipped', aucun feedback enregistré.
 * - `prExo` : exo ciblé par un PR (charge max effective, reps + 2 vs cible).
 */
interface Perturb {
  rpeBias?: number;
  loadBias?: number;
  repsDelta?: number;
  skip?: boolean;
  prExo?: string;
  prExtraReps?: number;
}

interface Scripted {
  /** "C1W1D0" etc. — label de debug uniquement. */
  tag: string;
  cycle: 1 | 2;
  weekInCycle: number;
  dayIdx: 0 | 1 | 2 | 3;
  date: string;
  perturb?: Perturb;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Construit la séquence : 8 semaines complètes (W1-5 cycle 1 + W1-3 cycle 2) +
 * début de sem 4 cycle 2 (lundi Upper A déjà joué). DEMO_TODAY = mardi de
 * W4C2 → la séance du jour (Lower A) est en `currentSession`, pas dans le
 * schedule joué. Total = 33 séances jouées (1 ratée → 32 feedbacks).
 *
 * Calendrier 4j/sem espacés Lu-Me-Ve-Sa (offsets 0, 2, 4, 5). CYCLE_1_START =
 * lundi 2026-03-23, donc lundi de W4C2 = 2026-03-23 + 8×7 = 2026-05-18.
 */
function buildSchedule(): Scripted[] {
  const sched: Scripted[] = [];
  const offsets = [0, 2, 4, 5];
  const baseDate = CYCLE_1_START;
  let weekGlobal = 0;

  // Cycle 1 — 5 semaines
  for (let w = 1; w <= 5; w++) {
    for (let d = 0; d < 4; d++) {
      const date = addDays(baseDate, weekGlobal * 7 + offsets[d]!);
      sched.push({ tag: `C1W${w}D${d}`, cycle: 1, weekInCycle: w, dayIdx: d as 0 | 1 | 2 | 3, date });
    }
    weekGlobal++;
  }
  // Cycle 2 — 3 semaines complètes
  for (let w = 1; w <= 3; w++) {
    for (let d = 0; d < 4; d++) {
      const date = addDays(baseDate, weekGlobal * 7 + offsets[d]!);
      sched.push({ tag: `C2W${w}D${d}`, cycle: 2, weekInCycle: w, dayIdx: d as 0 | 1 | 2 | 3, date });
    }
    weekGlobal++;
  }
  // Cycle 2 sem 4 : seul le lundi Upper A est déjà joué (alimente la couverture
  // de la semaine courante). Mardi (Lower A) = séance du jour, construite à
  // part comme `currentSession` (cf. main).
  {
    const date = addDays(baseDate, weekGlobal * 7 + offsets[0]!);
    sched.push({ tag: 'C2W4D0', cycle: 2, weekInCycle: 4, dayIdx: 0, date });
  }

  // ============== Placement des phénomènes pédagogiques ==============

  const tag = (t: string) => sched.find((s) => s.tag === t)!;

  // W1-W2 : tout normal, légère baisse de RPE perçu = sain (progresse)
  // W3 D0 : RPE bas franchement sur bench → l'algo va monter la charge (saut palier)
  tag('C1W3D0').perturb = { rpeBias: -1.5 }; // bench affiché trop facile
  // Conv #15 — petit saut palier squat à W3D1 pour rendre la courbe Force
  // moins plate avant le PR de W4. +1.25 kg = un cran inc_kg.
  tag('C1W3D1').perturb = { loadBias: 1.25 };
  // W4 D1 : PR sur squat (charge atteinte, +2 reps, charge +2.5 kg pour
  // que le PR soit visible dans la courbe Force).
  tag('C1W4D1').perturb = { prExo: 'squat_bb_high', prExtraReps: 2, loadBias: 2.5 };
  // W5 (déload) : charges réduites côté algo, RPE faible = OK
  for (let d = 0; d < 4; d++) tag(`C1W5D${d}`).perturb = { rpeBias: -0.5 };

  // C2W1 : swaps appliqués (front squat / tractions libres / DM haltères) via cycle plan
  // C2W2 D3 : RPE haut sur deadlift = signal de baisse de charge prochaine
  tag('C2W2D3').perturb = { rpeBias: +1.5, repsDelta: -1 };
  // C2W2 D0 : 1 PR sur bench (deuxième PR)
  tag('C2W2D0').perturb = { prExo: 'bench_bb', prExtraReps: 2 };
  // C2W3 D2 : séance ratée (dette de volume)
  tag('C2W3D2').perturb = { skip: true };

  return sched;
}

// =============================================================================
// Joueur : transforme une Scripted en SessionPlan + SessionFeedback + rows
// =============================================================================

interface PlayerCtx {
  state: UserState;
  catalog: Catalog;
  cycle1Plan: WeeklyTemplate;
  cycle2Plan: WeeklyTemplate;
  sessions: SessionRow[];
  feedbacks: FeedbackRow[];
  e1rmSnapshots: E1rmSnapshotRow[];
  nextSessionId: number;
  nextFeedbackId: number;
  nextSnapshotId: number;
}

/**
 * Construit un SessionPlan **directement à partir du WeeklyTemplate Alex**, sans
 * passer par `generateSession` du moteur.
 *
 * Raison : `generateSession` invoque `buildPrescription` qui s'appuie sur
 * `muscle_goals` + l'état complet du programme. Pour un snapshot démo on veut
 * des prescriptions stables et lisibles, indexées sur `state.e1rm` courant
 * (que `recordFeedback` continue de faire évoluer entre séances). On reste
 * dans le format `SessionPlan` natif, donc l'UI affiche normalement.
 */
function planFromTemplate(
  ctx: PlayerCtx,
  sc: Scripted,
): SessionPlan {
  const plan = sc.cycle === 1 ? ctx.cycle1Plan : ctx.cycle2Plan;
  const day = plan.days[sc.dayIdx]!;
  const weekIdx = Math.max(0, Math.min(4, sc.weekInCycle - 1));
  // RPE cible : 7.5 pour force, 8 pour hyp, sauf W5 déload = 6.
  const rpeTgt = sc.weekInCycle === 5 ? 6.0 : 7.5;

  const items = day.exercises.map((pe) => {
    const ex = ctx.catalog.get(pe.exercise_id);
    const e1rm = ctx.state.e1rm[pe.exercise_id] ?? 50;
    const nSets = pe.progression[weekIdx] ?? pe.base_sets;

    // Reps cible : 5 pour main force, 8 pour hyp, sauf déload = 5.
    const isMainForce = pe.intensity_scheme === 'force';
    const reps = sc.weekInCycle === 5 ? 5 : isMainForce ? 5 : 8;
    // %1RM cible — heuristique pour reps données + RPE cible.
    // Charges déload = 60 % du plafond, force = ~82.5 %, hyp = ~72 %.
    const pct =
      sc.weekInCycle === 5 ? 0.6 : isMainForce ? 0.825 : 0.72;
    let loadKg: number;
    if (ex.charge === ChargeType.BODYWEIGHT_ASSISTED) {
      // assistance : load négatif = poids déchargé. À ~80 % bw, l'assist tombe vers -20.
      loadKg = Math.round((e1rm * pct) / 1.25) * 1.25;
    } else if (ex.charge === ChargeType.BODYWEIGHT) {
      loadKg = 0;
    } else {
      loadKg = Math.round((e1rm * pct) / ex.inc_kg) * ex.inc_kg;
    }

    const prescr: SetPrescription = {
      exercise_id: ex.id,
      reps,
      load_kg: loadKg,
      rpe_target: rpeTgt,
      rest_s: ex.repos_s,
    };
    return { exercise_id: ex.id, sets: Array.from({ length: nSets }, () => prescr) };
  });

  return {
    seance_date: sc.date,
    week_in_cycle: sc.weekInCycle,
    cycle_index: sc.cycle === 1 ? 1 : 2,
    rpe_target: rpeTgt,
    items,
    label: day.label,
  };
}

function feedbackFromPlan(plan: SessionPlan, sc: Scripted): SessionFeedback {
  const p = sc.perturb ?? {};
  const sets: SetFeedback[] = [];
  for (const item of plan.items) {
    for (const sp of item.sets) {
      let reps = sp.reps + (p.repsDelta ?? 0);
      let load = sp.load_kg + (p.loadBias ?? 0);
      let rpe = (sc.weekInCycle === 5 ? 6.0 : 7.5) + (p.rpeBias ?? 0);

      // Application du PR ciblé : reps +N et RPE 10 sur l'exo concerné
      if (p.prExo === item.exercise_id) {
        reps = sp.reps + (p.prExtraReps ?? 2);
        rpe = 9.5;
      }

      reps = Math.max(1, reps);
      rpe = Math.max(5, Math.min(10, rpe));

      sets.push({
        exercise_id: sp.exercise_id,
        reps_done: reps,
        load_kg: load,
        rpe_perceived: Math.round(rpe * 2) / 2,
      });
    }
  }
  return {
    seance_date: plan.seance_date,
    week_in_cycle: plan.week_in_cycle,
    cycle_index: plan.cycle_index,
    rpe_target: plan.rpe_target,
    sets,
    label: plan.label,
  };
}

function snapshotE1rms(ctx: PlayerCtx, sc: Scripted): void {
  for (const [exId, val] of Object.entries(ctx.state.e1rm)) {
    ctx.e1rmSnapshots.push({
      id: ctx.nextSnapshotId++,
      date: sc.date,
      exercise_id: exId,
      e1rm: Math.round(val * 10) / 10,
      cycle_index: sc.cycle === 1 ? 1 : 2,
      week_in_cycle: sc.weekInCycle,
    });
  }
}

/**
 * Met à jour les e1rm des exos touchés de façon **scriptée déterministe**.
 *
 * On n'appelle PAS `recordFeedback` ici : pour un snapshot démo, on veut des
 * plafonds qui montent visiblement et de manière lisible, pas le bruit du
 * filtre EMA qui sur 32 séances avec prescriptions approximatives peut dériver
 * vers le bas. La cohérence affichée (UI Force, banner calibration) prime sur
 * la fidélité algorithmique — l'algo réel sera lu en mode démo via les mêmes
 * selectors, mais sur des valeurs sereines.
 */
function progressE1rms(ctx: PlayerCtx, sc: Scripted, touchedExos: Set<string>): void {
  const p = sc.perturb ?? {};
  for (const exId of touchedExos) {
    const cur = ctx.state.e1rm[exId];
    if (cur === undefined) continue;
    let delta = 0;
    if (sc.weekInCycle === 5) {
      delta = 0; // déload : plafond gelé
    } else if (p.prExo === exId) {
      delta = cur * 0.025; // PR : +2.5 % visible
    } else if (p.rpeBias !== undefined && p.rpeBias > 0.5) {
      delta = -cur * 0.005; // RPE haut : léger recul (informatif)
    } else if (p.rpeBias !== undefined && p.rpeBias < -0.5) {
      delta = cur * 0.015; // RPE bas : saut palier +1.5 %
    } else {
      // Conv #15 — progression rehaussée de +0.4 %/séance à +1.0 %/séance.
      // À ce rythme la charge prescrite (palier inc_kg) bouge réellement
      // sur 5 séances et la courbe Force devient visible (sinon arrondi
      // au palier 1.25 kg gomme tout le progrès).
      delta = cur * 0.01;
    }
    ctx.state.e1rm[exId] = Math.round((cur + delta) * 10) / 10;
  }
}

function playSession(ctx: PlayerCtx, sc: Scripted): void {
  const plan = planFromTemplate(ctx, sc);
  const sessionId = ctx.nextSessionId++;
  const skipped = sc.perturb?.skip === true;

  ctx.sessions.push({
    id: sessionId,
    seance_date: sc.date,
    week_in_cycle: sc.weekInCycle,
    cycle_index: sc.cycle === 1 ? 1 : 2,
    plan,
    status: skipped ? 'skipped' : 'completed',
    created_at: sc.date + 'T18:00:00.000Z',
  });

  if (skipped) return;

  const feedback = feedbackFromPlan(plan, sc);
  // Push manuel dans state.history (l'UI Progrès lit feedbacks via la table
  // dérivée `history.feedbacks`, mais le moteur exploite `state.history`).
  ctx.state.history.push(feedback);

  const touched = new Set(plan.items.map((it) => it.exercise_id));
  progressE1rms(ctx, sc, touched);

  ctx.feedbacks.push({
    id: ctx.nextFeedbackId++,
    session_id: sessionId,
    seance_date: sc.date,
    cycle_index: sc.cycle === 1 ? 1 : 2,
    week_in_cycle: sc.weekInCycle,
    feedback,
    created_at: sc.date + 'T18:00:00.000Z',
  });

  snapshotE1rms(ctx, sc);
}

// =============================================================================
// Review hard-codée du cycle 1
// =============================================================================

function buildCycle1Review(ctx: PlayerCtx): CycleReview {
  // Δ plafond cycle 1 : on remonte au tout 1er snapshot par exo.
  const earliestE1rm: Record<string, number> = {};
  for (const snap of ctx.e1rmSnapshots) {
    if (snap.cycle_index === 1 && earliestE1rm[snap.exercise_id] === undefined) {
      earliestE1rm[snap.exercise_id] = snap.e1rm;
    }
  }
  const latestC1: Record<string, number> = {};
  for (const snap of ctx.e1rmSnapshots) {
    if (snap.cycle_index === 1) latestC1[snap.exercise_id] = snap.e1rm;
  }
  const deltas: Record<string, number> = {};
  const prs: Array<[string, number]> = [];
  for (const exId of Object.keys(latestC1)) {
    const d = (latestC1[exId] ?? 0) - (earliestE1rm[exId] ?? 0);
    deltas[exId] = Math.round(d * 10) / 10;
    if (d > 2) prs.push([exId, Math.round(d * 10) / 10]);
  }
  const volumeTotal = ctx.feedbacks
    .filter((f) => f.cycle_index === 1)
    .reduce(
      (acc, f) =>
        acc + f.feedback.sets.reduce((a, s) => a + s.load_kg * s.reps_done, 0),
      0,
    );

  return {
    cycle_index: 1,
    plafonds_progression: deltas,
    muscles_progresses: ['pectoraux', 'quadriceps', 'dos_largeur', 'ischios', 'fessiers'],
    muscles_plateau: [],
    muscles_undertrained: ['mollets', 'abdos', 'obliques'],
    muscles_overshoot: [],
    adherence_pct: 1,
    volume_total_kg: Math.round(volumeTotal),
    PRs: prs,
    suggested_action: SuggestedAction.CONTINUER_PAREIL,
    warnings: [],
  };
}

// =============================================================================
// Sérialisation UserState
// =============================================================================

function serializeUserState(state: UserState): SerializedUserState {
  return {
    profile: {
      sex: state.profile.sex,
      age: state.profile.age,
      level: state.profile.level,
      objective: state.profile.objective,
      sessions_per_week: state.profile.sessions_per_week,
      bodyweight_kg: state.profile.bodyweight_kg,
      available_equip: [...state.profile.available_equip],
    },
    e1rm: { ...state.e1rm },
    k_user: { ...state.k_user },
    reps_pr: { ...state.reps_pr },
    volume_min: { ...state.volume_min },
    volume_max: { ...state.volume_max },
    current_week_in_cycle: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
    plateau_counter: { ...state.plateau_counter },
    history: state.history,
    last_used_for_muscle: { ...state.last_used_for_muscle },
    muscle_goals: { ...state.muscle_goals },
    current_cycle_plan: state.current_cycle_plan,
    active_guided_program_id: state.active_guided_program_id,
    recovery_mode: state.recovery_mode,
    recovery_weeks_remaining: state.recovery_weeks_remaining,
    equipment_overrides: { ...state.equipment_overrides },
    weekly_volume_debt: { ...state.weekly_volume_debt },
  };
}

// =============================================================================
// Main
// =============================================================================

function main(): void {
  const catalog = new Catalog();

  const profile = makeProfile(ALEX_PROFILE);

  // Objectifs muscle force+hypertrophie 50/50 : priorité force sur 6 muscles
  // structurants, hypertrophie sur les bras/épaules.
  const muscleGoals = {
    pectoraux: makeMuscleGoal({ muscle: 'pectoraux', objective: MuscleObjective.FORCE, status: MuscleStatus.PRIORITAIRE, priority_rank: 1 }),
    quadriceps: makeMuscleGoal({ muscle: 'quadriceps', objective: MuscleObjective.FORCE, status: MuscleStatus.PRIORITAIRE, priority_rank: 2 }),
    dos_largeur: makeMuscleGoal({ muscle: 'dos_largeur', objective: MuscleObjective.FORCE, status: MuscleStatus.PRIORITAIRE, priority_rank: 3 }),
    dos_epaisseur: makeMuscleGoal({ muscle: 'dos_epaisseur', objective: MuscleObjective.FORCE, status: MuscleStatus.PRIORITAIRE, priority_rank: 4 }),
    ischios: makeMuscleGoal({ muscle: 'ischios', objective: MuscleObjective.FORCE, status: MuscleStatus.PRIORITAIRE, priority_rank: 5 }),
    fessiers: makeMuscleGoal({ muscle: 'fessiers', objective: MuscleObjective.FORCE, status: MuscleStatus.PRIORITAIRE, priority_rank: 6 }),
    deltos_lateraux: makeMuscleGoal({ muscle: 'deltos_lateraux', objective: MuscleObjective.HYPERTROPHIE, status: MuscleStatus.SUGGERE, priority_rank: 99 }),
    biceps: makeMuscleGoal({ muscle: 'biceps', objective: MuscleObjective.HYPERTROPHIE, status: MuscleStatus.SUGGERE, priority_rank: 99 }),
    triceps: makeMuscleGoal({ muscle: 'triceps', objective: MuscleObjective.HYPERTROPHIE, status: MuscleStatus.SUGGERE, priority_rank: 99 }),
    trapezes_hauts: makeMuscleGoal({ muscle: 'trapezes_hauts', objective: MuscleObjective.HYPERTROPHIE, status: MuscleStatus.SUGGERE, priority_rank: 99 }),
    mollets: makeMuscleGoal({ muscle: 'mollets', objective: MuscleObjective.MAINTIEN, status: MuscleStatus.NON_COUVERT, priority_rank: 99 }),
    abdos: makeMuscleGoal({ muscle: 'abdos', objective: MuscleObjective.MAINTIEN, status: MuscleStatus.NON_COUVERT, priority_rank: 99 }),
    deltos_posterieurs: makeMuscleGoal({ muscle: 'deltos_posterieurs', objective: MuscleObjective.HYPERTROPHIE, status: MuscleStatus.SUGGERE, priority_rank: 99 }),
    obliques: makeMuscleGoal({ muscle: 'obliques', objective: MuscleObjective.MAINTIEN, status: MuscleStatus.NON_COUVERT, priority_rank: 99 }),
    lombaires: makeMuscleGoal({ muscle: 'lombaires', objective: MuscleObjective.MAINTIEN, status: MuscleStatus.SUGGERE, priority_rank: 99 }),
  };

  const state = startUser(profile, catalog, { muscleGoals });
  // Précharge e1rm + k_user pour qu'Alex démarre le cycle 1 calibré
  for (const [id, val] of Object.entries(ALEX_INITIAL_E1RM)) {
    state.e1rm[id] = val;
    state.k_user[id] = DEFAULT_K;
  }

  const cycle1Plan = buildCyclePlan(1, false);
  const cycle2Plan = buildCyclePlan(2, true);
  state.current_cycle_plan = cycle1Plan;
  state.cycle_index = 1;
  state.current_week_in_cycle = 1;

  const ctx: PlayerCtx = {
    state,
    catalog,
    cycle1Plan,
    cycle2Plan,
    sessions: [],
    feedbacks: [],
    e1rmSnapshots: [],
    nextSessionId: 1,
    nextFeedbackId: 1,
    nextSnapshotId: 1,
  };

  const cycles: CycleRow[] = [
    { cycle_index: 1, start_date: CYCLE_1_START, end_date: null, programme_id: null, review: null },
  ];

  const schedule = buildSchedule();
  let lastCycleProcessed = 1;

  for (const sc of schedule) {
    if (sc.cycle === 2 && lastCycleProcessed === 1) {
      // Bascule cycle 1 → cycle 2 : on hard-code la review (pas d'appel moteur)
      const c1 = cycles[0]!;
      c1.end_date = addDays(CYCLE_1_START, 5 * 7 - 1);
      c1.review = buildCycle1Review(ctx);
      state.current_cycle_plan = cycle2Plan;
      state.cycle_index = 2;
      state.current_week_in_cycle = 1;
      // Conv #16 — poser les plafonds initiaux pour les exos swappés. Sans
      // ça, `snapshotE1rms` ne crée jamais d'entrée pour eux (la fonction
      // n'itère que sur state.e1rm) → l'UI les voit "non calibrés".
      for (const [id, val] of Object.entries(ALEX_SWAP_E1RM)) {
        if (state.e1rm[id] === undefined) state.e1rm[id] = val;
      }
      cycles.push({
        cycle_index: 2,
        start_date: addDays(CYCLE_1_START, 5 * 7),
        end_date: null,
        programme_id: null,
        review: null,
      });
      lastCycleProcessed = 2;
    }
    state.current_week_in_cycle = sc.weekInCycle;
    state.cycle_index = sc.cycle === 1 ? 1 : 2;
    playSession(ctx, sc);
  }

  // Position finale : sem 4 cycle 2, mardi — Upper A (lundi) déjà joué, Lower A
  // (aujourd'hui = DEMO_TODAY) est la séance en cours.
  state.current_week_in_cycle = 4;
  state.cycle_index = 2;

  // Construit la séance "Lower A mardi" en mémoire — pas insérée dans history,
  // sera posée sur `currentSessionPlan` + `currentSessionId` du store par
  // `enterDemoMode`. Date = DEMO_TODAY (mardi 2026-05-19) qui correspond
  // bien à l'offset 1 (Mer/Ma) du calendrier hebdo… non : offsets sont
  // [Lu=0, Mer=2, Ve=4, Sa=5]. Donc le dayIdx=1 du programme tombe
  // calendairement mercredi. On ajuste : la séance "du jour" pour la démo
  // est dayIdx 1 mais on la date au mardi (DEMO_TODAY) pour qu'elle
  // s'affiche bien "aujourd'hui" dans l'UI calendrier.
  const currentSessionPlan = planFromTemplate(ctx, {
    tag: 'C2W4D1-current',
    cycle: 2,
    weekInCycle: 4,
    dayIdx: 1,
    date: DEMO_TODAY,
  });

  // Conv #15 vague 3 — Alex a aussi 2 séances **prévues** plus tard dans la
  // semaine (Upper B le jeudi, Lower B le samedi). Sans ça, la démo
  // montrait uniquement les séances passées + celle du jour, l'utilisateur
  // ne voyait jamais une case "planned" (bleu) dans le calendrier.
  const PLANNED_OFFSETS: Array<{ dayIdx: 0 | 1 | 2 | 3; offset: number }> = [
    { dayIdx: 2, offset: 2 }, // jeudi (Upper B)
    { dayIdx: 3, offset: 4 }, // samedi (Lower B)
  ];
  for (const p of PLANNED_OFFSETS) {
    const date = addDays(DEMO_TODAY, p.offset);
    const plan = planFromTemplate(ctx, {
      tag: `C2W4D${p.dayIdx}-planned`,
      cycle: 2,
      weekInCycle: 4,
      dayIdx: p.dayIdx,
      date,
    });
    ctx.sessions.push({
      id: ctx.nextSessionId++,
      seance_date: date,
      week_in_cycle: 4,
      cycle_index: 2,
      plan,
      status: 'planned',
      created_at: DEMO_TODAY + 'T08:00:00.000Z',
    });
  }

  const snapshot: DemoSnapshot = {
    persona: {
      id: 'alex',
      label: "Découvre Kotsh via le profil d'Alex",
      summary:
        "Pour te montrer comment l'app marche en pratique, on va parcourir ensemble le profil d'Alex — un utilisateur fictif qui a effectué 8 semaines d'entraînement (les 5 du cycle 1 + 3 sur les 5 du cycle 2 en cours). Tu verras un programme actif, des séances passées, des plafonds qui progressent, et un bilan de cycle — tout ce que tu auras toi-même dans quelques semaines. Tes vraies données restent intactes pendant la visite.",
    },
    generated_at: DEMO_TODAY,
    user_state: serializeUserState(state),
    history: {
      sessions: ctx.sessions,
      feedbacks: ctx.feedbacks,
      e1rmSnapshots: ctx.e1rmSnapshots,
      cycles,
    },
    current_session: {
      id: -1,
      plan: currentSessionPlan,
    },
  };

  // Validation Zod — on plante ici si la forme ne matche pas (sécurité au build).
  demoSnapshotSchema.parse(snapshot);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(__dirname, '..', 'public', 'demo');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'alex.json');
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

  // eslint-disable-next-line no-console
  console.log(
    `[demo] alex.json écrit : ${ctx.sessions.length} séances, ${ctx.feedbacks.length} feedbacks, ${ctx.e1rmSnapshots.length} snapshots e1rm, ${cycles.length} cycles.`,
  );
}

main();
