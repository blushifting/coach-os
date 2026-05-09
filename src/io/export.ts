/**
 * Export complet de l'état Coach OS en un seul fichier JSON.
 * Utilisé par le bouton "Exporter mes données" de la page Profil (Conv #6c).
 */

import { getDb } from '@/db';
import { APP_NAME, EXPORT_VERSION, type ExportPayload } from './schema';

export async function buildExportPayload(): Promise<ExportPayload> {
  const db = getDb();
  const [
    userStateRow,
    sessions,
    feedbacks,
    e1rmSnapshots,
    cycles,
    equipmentOverrides,
    userAddedExercises,
  ] = await Promise.all([
    db.userState.get(1),
    db.sessions.orderBy('seance_date').toArray(),
    db.feedbacks.orderBy('seance_date').toArray(),
    db.e1rmSnapshots.orderBy('date').toArray(),
    db.cycles.orderBy('cycle_index').toArray(),
    db.equipmentOverrides.toArray(),
    db.userAddedExercises.toArray(),
  ]);

  return {
    version: EXPORT_VERSION,
    appName: APP_NAME,
    exportedAt: new Date().toISOString(),
    data: {
      userState: userStateRow?.state ?? null,
      sessions,
      feedbacks,
      e1rmSnapshots,
      cycles,
      equipmentOverrides,
      userAddedExercises,
    },
  };
}

export async function exportToJsonString(): Promise<string> {
  const payload = await buildExportPayload();
  return JSON.stringify(payload, null, 2);
}
