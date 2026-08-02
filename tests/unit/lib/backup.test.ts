/**
 * Chantier F-1 — gardes et construction du snapshot cloud (`lib/backup.ts`).
 *
 * Ces tests tournent **sans réseau et sans variables d'environnement** : c'est
 * précisément ce qu'ils vérifient en premier. Si un jour la couche cloud
 * cessait d'être inerte en test, toute la suite deviendrait dépendante d'un
 * projet Supabase joignable — c'est le scénario que ce fichier interdit.
 */

import { describe, expect, it } from 'vitest';
import type { SessionRow } from '@/db/schema';
import type { SessionPlan } from '@/engine/models';
import {
  buildSnapshotRow,
  coalesce,
  evaluateBackupGuards,
  fetchSnapshot,
  hasBackupInFlight,
  listSnapshots,
  markRestored,
  nextPlannedSessionDate,
  pushSnapshot,
  toSnapshotMetas,
  type BackupContext,
  type BackupResult,
} from '@/lib/backup';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useCoachOsStore } from '@/store';
import { useAuthStore } from '@/store/auth';

const OK: BackupContext = {
  configured: true,
  userId: 'u-1',
  demoMode: false,
  hasConflict: false,
  online: true,
};

function session(seance_date: string, status: SessionRow['status']): SessionRow {
  return {
    seance_date,
    week_in_cycle: 1,
    cycle_index: 1,
    plan: { days: [] } as unknown as SessionPlan,
    status,
    created_at: `${seance_date}T08:00:00.000Z`,
  };
}

describe('couche cloud inerte sans configuration', () => {
  it('isSupabaseConfigured est faux en test (aucune variable VITE_SUPABASE_*)', () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('pushSnapshot ne tente rien et ne jette pas', async () => {
    const result = await pushSnapshot();
    expect(result).toEqual({ ok: false, skipped: 'not_configured' });
    expect(hasBackupInFlight()).toBe(false);
  });

  it('pushSnapshot reste inerte même en forçant', async () => {
    const result = await pushSnapshot({ force: true });
    expect(result).toEqual({ ok: false, skipped: 'not_configured' });
  });
});

describe('evaluateBackupGuards', () => {
  it('laisse passer quand tout est réuni', () => {
    expect(evaluateBackupGuards(OK)).toBeNull();
  });

  it('refuse sans configuration', () => {
    expect(evaluateBackupGuards({ ...OK, configured: false })).toBe(
      'not_configured',
    );
  });

  it('refuse sans compte lié', () => {
    expect(evaluateBackupGuards({ ...OK, userId: null })).toBe('signed_out');
  });

  it('refuse en mode démo — le snapshot d\'Alex ne part jamais en ligne', () => {
    expect(evaluateBackupGuards({ ...OK, demoMode: true })).toBe('demo');
  });

  it('refuse tant qu\'un conflit n\'est pas tranché', () => {
    expect(evaluateBackupGuards({ ...OK, hasConflict: true })).toBe('conflict');
  });

  it('refuse hors ligne', () => {
    expect(evaluateBackupGuards({ ...OK, online: false })).toBe('offline');
  });

  it('ordonne les gardes : la configuration prime sur le mode démo', () => {
    expect(
      evaluateBackupGuards({ ...OK, configured: false, demoMode: true }),
    ).toBe('not_configured');
  });

  it('ordonne les gardes : le mode démo prime sur le réseau', () => {
    expect(evaluateBackupGuards({ ...OK, demoMode: true, online: false })).toBe(
      'demo',
    );
  });
});

describe('coalescing', () => {
  it('fusionne les demandes concurrentes en un seul envoi', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = async (): Promise<BackupResult> => {
      calls += 1;
      await gate;
      return { ok: true, at: '2026-08-02T10:00:00.000Z' };
    };

    const a = coalesce(run);
    const b = coalesce(run);
    const c = coalesce(run);
    expect(hasBackupInFlight()).toBe(true);
    release();
    const results = await Promise.all([a, b, c]);

    expect(calls).toBe(1);
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    expect(hasBackupInFlight()).toBe(false);
  });

  it('relance un envoi une fois le précédent terminé', async () => {
    let calls = 0;
    const run = async (): Promise<BackupResult> => {
      calls += 1;
      return { ok: false, skipped: 'offline' };
    };
    await coalesce(run);
    await coalesce(run);
    expect(calls).toBe(2);
  });
});

describe('nextPlannedSessionDate', () => {
  const today = new Date(2026, 7, 2); // 2 août 2026

  it('renvoie null sans séance planifiée', () => {
    expect(nextPlannedSessionDate([], today)).toBeNull();
    expect(
      nextPlannedSessionDate([session('2026-08-05', 'completed')], today),
    ).toBeNull();
  });

  it('ignore les séances planifiées déjà passées', () => {
    expect(
      nextPlannedSessionDate([session('2026-07-30', 'planned')], today),
    ).toBeNull();
  });

  it('renvoie la plus proche à venir, aujourd\'hui compris', () => {
    const rows = [
      session('2026-08-09', 'planned'),
      session('2026-08-02', 'planned'),
      session('2026-08-04', 'planned'),
      session('2026-07-28', 'planned'),
    ];
    expect(nextPlannedSessionDate(rows, today)).toBe('2026-08-02');
  });
});

describe('buildSnapshotRow', () => {
  const row = buildSnapshotRow({
    userId: 'u-42',
    payload: { version: 1 },
    appVersion: '1.45.0',
    sessions: [session('2026-08-04', 'planned')],
    now: new Date('2026-08-02T09:30:00.000Z'),
    timezone: 'Europe/Paris',
  });

  it('n\'écrit jamais created_at — c\'est now() côté serveur', () => {
    expect(Object.keys(row)).not.toContain('created_at');
  });

  it('porte les colonnes dénormalisées du futur cron de notifications', () => {
    expect(row.next_session_date).toBe('2026-08-04');
    expect(row.timezone).toBe('Europe/Paris');
    expect(row.last_active_at).toBe('2026-08-02T09:30:00.000Z');
  });

  it('porte le user_id et la version de l\'app', () => {
    expect(row.user_id).toBe('u-42');
    expect(row.app_version).toBe('1.45.0');
    expect(row.payload).toEqual({ version: 1 });
  });
});

// =============================================================================
// Chantier F-2 — lecture
// =============================================================================

describe('toSnapshotMetas', () => {
  it('trie du plus récent au plus ancien sans faire confiance au serveur', () => {
    const metas = toSnapshotMetas([
      { id: 1, created_at: '2026-08-01T10:00:00.000Z', app_version: '1.45.0' },
      { id: 3, created_at: '2026-08-03T10:00:00.000Z', app_version: '2.0.0' },
      { id: 2, created_at: '2026-08-02T10:00:00.000Z', app_version: '2.0.0' },
    ]);
    expect(metas.map((m) => m.id)).toEqual([3, 2, 1]);
  });

  it('écarte les lignes inexploitables plutôt que de produire un NaN', () => {
    const metas = toSnapshotMetas([
      null,
      'bruit',
      { created_at: '2026-08-01T10:00:00.000Z' },
      { id: 7, created_at: '2026-08-01T10:00:00.000Z', app_version: '2.0.0' },
    ]);
    expect(metas).toHaveLength(1);
    expect(metas[0]?.id).toBe(7);
  });

  it('remplace une version manquante par un point d\'interrogation', () => {
    const metas = toSnapshotMetas([{ id: 1, created_at: '2026-08-01T10:00:00.000Z' }]);
    expect(metas[0]?.appVersion).toBe('?');
  });
});

describe('lecture inerte sans configuration', () => {
  it('listSnapshots échoue proprement, sans jeter', async () => {
    const result = await listSnapshots();
    expect(result.ok).toBe(false);
  });

  it('fetchSnapshot échoue proprement, sans jeter', async () => {
    const result = await fetchSnapshot(42);
    expect(result.ok).toBe(false);
  });
});

describe('markRestored', () => {
  it('aligne la dernière sauvegarde sur celle qu\'on vient de remettre', () => {
    useAuthStore.setState({ lastBackupAt: null });
    markRestored('2026-08-01T10:00:00.000Z');
    expect(useAuthStore.getState().lastBackupAt).toBe('2026-08-01T10:00:00.000Z');
    useAuthStore.setState({ lastBackupAt: null });
  });
});

describe('garde mode démo, branchée sur le vrai store', () => {
  it('le store en mode démo produit un contexte refusé', () => {
    useCoachOsStore.setState({ demoMode: true });
    useAuthStore.setState({ userId: 'u-1' });
    const ctx: BackupContext = {
      configured: true,
      userId: useAuthStore.getState().userId,
      demoMode: useCoachOsStore.getState().demoMode,
      hasConflict: false,
      online: true,
    };
    expect(evaluateBackupGuards(ctx)).toBe('demo');
    useCoachOsStore.setState({ demoMode: false });
    useAuthStore.setState({ userId: null });
  });
});
