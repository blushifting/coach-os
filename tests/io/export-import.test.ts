import { describe, it, expect } from 'vitest';
import { Catalog } from '@/engine/catalog';
import { startUser } from '@/engine/engine';
import { txCommitSessionFeedback, txInitUser, txSaveSessionPlan } from '@/db/transactions';
import { exportToJsonString, buildExportPayload } from '@/io/export';
import {
  importPayload,
  importFromJsonString,
  parseExportJson,
  ImportValidationError,
} from '@/io/import';
import { APP_NAME, EXPORT_VERSION } from '@/io/schema';
import { loadUserState } from '@/db/repositories/userState.repo';
import { listAllSessions } from '@/db/repositories/sessions.repo';
import { listAllFeedbacks } from '@/db/repositories/feedbacks.repo';
import { listAllSnapshots } from '@/db/repositories/e1rmSnapshots.repo';
import { listAllCycles } from '@/db/repositories/cycles.repo';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';
import type { SessionFeedback, SessionPlan } from '@/engine/models';

async function seedDb() {
  const state = startUser(makeTestProfile(), new Catalog(), {
    muscleGoals: makeTestMuscleGoals(),
  });
  state.equipment_overrides['bench_barbell'] = {
    inc_kg: 1,
    min_load_kg: 20,
    max_load_kg: 200,
    pdc_only: null,
  };
  await txInitUser(state, 'starting_strength');

  const plan: SessionPlan = {
    seance_date: '2026-05-10',
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 7,
    label: 'A',
    items: [],
  };
  const sessionId = await txSaveSessionPlan(plan, state);

  state.e1rm['bench_barbell'] = 100;
  const feedback: SessionFeedback = {
    seance_date: '2026-05-10',
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 7,
    label: 'A',
    sets: [
      { exercise_id: 'bench_barbell', reps_done: 8, load_kg: 80, rpe_perceived: 8 },
    ],
  };
  await txCommitSessionFeedback({ feedback, state, sessionId });
}

describe('io/export', () => {
  it('buildExportPayload contient version, appName et 7 sections', async () => {
    await seedDb();
    const payload = await buildExportPayload();
    expect(payload.version).toBe(EXPORT_VERSION);
    expect(payload.appName).toBe(APP_NAME);
    expect(payload.data.userState).not.toBeNull();
    expect(payload.data.sessions).toHaveLength(1);
    expect(payload.data.feedbacks).toHaveLength(1);
    expect(payload.data.e1rmSnapshots).toHaveLength(1);
    expect(payload.data.cycles).toHaveLength(1);
    expect(payload.data.equipmentOverrides).toHaveLength(1);
    expect(payload.data.userAddedExercises).toHaveLength(0);
  });

  it('exportToJsonString produit un JSON valide qui re-parse', async () => {
    await seedDb();
    const json = await exportToJsonString();
    expect(() => parseExportJson(json)).not.toThrow();
  });
});

describe('io/import — validation Zod', () => {
  it('rejette un JSON malformé', () => {
    expect(() => parseExportJson('{not json')).toThrow(ImportValidationError);
  });

  it('rejette un payload sans version', () => {
    expect(() =>
      parseExportJson(JSON.stringify({ appName: 'coach-os', data: {} })),
    ).toThrow(ImportValidationError);
  });

  it('rejette un appName étranger', () => {
    expect(() =>
      parseExportJson(
        JSON.stringify({
          version: 1,
          appName: 'autre-app',
          exportedAt: '2026-05-10T00:00:00Z',
          data: {
            userState: null,
            sessions: [],
            feedbacks: [],
            e1rmSnapshots: [],
            cycles: [],
            equipmentOverrides: [],
            userAddedExercises: [],
          },
        }),
      ),
    ).toThrow(ImportValidationError);
  });

  it('rejette une version inconnue', () => {
    expect(() =>
      parseExportJson(
        JSON.stringify({
          version: 999,
          appName: 'coach-os',
          exportedAt: '2026-05-10T00:00:00Z',
          data: {
            userState: null,
            sessions: [],
            feedbacks: [],
            e1rmSnapshots: [],
            cycles: [],
            equipmentOverrides: [],
            userAddedExercises: [],
          },
        }),
      ),
    ).toThrow(ImportValidationError);
  });

  it('accepte un payload vide bien formé', () => {
    const payload = parseExportJson(
      JSON.stringify({
        version: 1,
        appName: 'coach-os',
        exportedAt: '2026-05-10T00:00:00Z',
        data: {
          userState: null,
          sessions: [],
          feedbacks: [],
          e1rmSnapshots: [],
          cycles: [],
          equipmentOverrides: [],
          userAddedExercises: [],
        },
      }),
    );
    expect(payload.data.userState).toBeNull();
  });
});

describe('io — round-trip export → import → réimport', () => {
  it('réimport restaure exactement le même contenu DB', async () => {
    await seedDb();
    const json = await exportToJsonString();

    // Re-trigger setup ne se fait qu'entre tests : on simule un reset interne
    // ici en réimportant par-dessus (importPayload clear puis bulk-add).
    await importFromJsonString(json);

    const us = await loadUserState();
    expect(us?.profile.bodyweight_kg).toBe(80);
    expect(us?.equipment_overrides['bench_barbell']?.inc_kg).toBe(1);
    expect(await listAllSessions()).toHaveLength(1);
    expect(await listAllFeedbacks()).toHaveLength(1);
    expect(await listAllSnapshots()).toHaveLength(1);
    expect(await listAllCycles()).toHaveLength(1);
  });

  it('importPayload remplace tout (clear puis insert)', async () => {
    await seedDb();
    expect(await listAllSessions()).toHaveLength(1);

    const emptyPayload = {
      version: EXPORT_VERSION,
      appName: APP_NAME,
      exportedAt: new Date().toISOString(),
      data: {
        userState: null,
        sessions: [],
        feedbacks: [],
        e1rmSnapshots: [],
        cycles: [],
        equipmentOverrides: [],
        userAddedExercises: [],
      },
    };
    await importPayload(emptyPayload);

    expect(await loadUserState()).toBeNull();
    expect(await listAllSessions()).toHaveLength(0);
    expect(await listAllFeedbacks()).toHaveLength(0);
  });
});
