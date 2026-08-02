/**
 * Chantier F-1 — sauvegarde automatique vers le cloud.
 * Chantier F-2 — relecture des sauvegardes (liste + payload).
 *
 * Principe (doc 12 §0.3) : **pas de sync incrémentale**. Le multi-appareil
 * ayant été abandonné, on pousse le `ExportPayload` entier — celui du bouton
 * « Exporter mes données », déjà versionné, zod-validé et testé — dans une
 * unique colonne `jsonb`. Un snapshot ≈ 300 Ko après 7 mois d'entraînement,
 * contre 5 Go de bande passante incluse : trois ordres de grandeur de marge.
 *
 * Deux règles non négociables :
 *   1. **Jamais sur le chemin critique.** Aucun appelant n'attend le résultat,
 *      aucune erreur réseau ne remonte à l'écran. `pushSnapshot` ne jette pas.
 *   2. **Jamais en mode démo.** Le snapshot d'Alex n'a rien à faire dans le
 *      cloud de qui que ce soit.
 */

import { buildExportPayload } from '@/io/export';
import type { SessionRow } from '@/db/schema';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useCoachOsStore } from '@/store';

// =============================================================================
// Drapeaux persistés (localStorage — aucun besoin d'une migration Dexie)
// =============================================================================

const KEY_DIRTY = 'coach-os.backup-dirty';
const KEY_LAST_AT = 'coach-os.backup-last-at';
const KEY_RECONCILED = 'coach-os.backup-reconciled-user';

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible (mode privé) — on dégrade sans bruit */
  }
}

/** Des changements locaux attendent d'être envoyés. */
export function isBackupDirty(): boolean {
  return lsGet(KEY_DIRTY) === '1';
}

/** Date ISO du dernier envoi réussi sur cet appareil, ou `null`. */
export function readLastBackupAt(): string | null {
  return lsGet(KEY_LAST_AT);
}

/**
 * Cet appareil a-t-il déjà été réconcilié avec ce compte ? Tant que non, on ne
 * pousse rien à l'aveugle (cf. `lib/auth.ts`).
 */
export function readReconciledUserId(): string | null {
  return lsGet(KEY_RECONCILED);
}

export function markReconciled(userId: string): void {
  lsSet(KEY_RECONCILED, userId);
}

export function clearReconciled(): void {
  lsSet(KEY_RECONCILED, null);
}

/**
 * Appelé après un effacement local complet (`resetApp`). Sans ça, le drapeau
 * « à envoyer » survivrait à la remise à zéro et on pousserait un état vide
 * par-dessus la sauvegarde cloud au premier déclencheur venu.
 */
export function clearLocalBackupFlags(): void {
  lsSet(KEY_DIRTY, null);
  lsSet(KEY_LAST_AT, null);
  useAuthStore.setState({ lastBackupAt: null });
}

/**
 * Chantier F-2 — après une restauration réussie, l'appareil porte **exactement**
 * le contenu de la sauvegarde `at`. Il n'y a donc rien à envoyer, et la
 * « dernière sauvegarde » affichée dans le Profil est celle qu'on vient de
 * remettre en place. Sans ça, l'app repousserait aussitôt une copie conforme.
 */
export function markRestored(at: string): void {
  lsSet(KEY_DIRTY, null);
  lsSet(KEY_LAST_AT, at);
  useAuthStore.setState({ lastBackupAt: at });
}

// =============================================================================
// Gardes
// =============================================================================

export type BackupSkip =
  | 'not_configured'
  | 'signed_out'
  | 'demo'
  | 'conflict'
  | 'offline';

export interface BackupContext {
  readonly configured: boolean;
  readonly userId: string | null;
  readonly demoMode: boolean;
  readonly hasConflict: boolean;
  readonly online: boolean;
}

/**
 * Gardes dans l'ordre du doc 12 §3.2 : configuré → connecté → pas en mode
 * démo → en ligne. Le conflit s'intercale avant le réseau : tant que
 * l'utilisateur n'a pas tranché, on n'écrase rien.
 *
 * Fonction pure — c'est elle que les tests couvrent.
 */
export function evaluateBackupGuards(ctx: BackupContext): BackupSkip | null {
  if (!ctx.configured) return 'not_configured';
  if (ctx.userId === null) return 'signed_out';
  if (ctx.demoMode) return 'demo';
  if (ctx.hasConflict) return 'conflict';
  if (!ctx.online) return 'offline';
  return null;
}

function currentContext(force: boolean): BackupContext {
  const auth = useAuthStore.getState();
  return {
    configured: isSupabaseConfigured(),
    userId: auth.userId,
    demoMode: useCoachOsStore.getState().demoMode,
    hasConflict: !force && auth.conflict !== null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  };
}

// =============================================================================
// Construction de la ligne poussée
// =============================================================================

/**
 * Colonnes dénormalisées à côté du `jsonb` : elles ne servent à rien
 * aujourd'hui, elles servent au futur cron de notifications (doc 12 §5), qui
 * sans elles devrait fouiller du JSON à chaque exécution. Coût nul maintenant.
 *
 * `created_at` est **volontairement absent** : c'est `now()` côté serveur,
 * jamais une horloge client.
 */
export interface SnapshotRow {
  readonly user_id: string;
  readonly payload: unknown;
  readonly app_version: string;
  readonly next_session_date: string | null;
  readonly last_active_at: string;
  readonly timezone: string | null;
}

/** Date (clé `YYYY-MM-DD`) de la prochaine séance planifiée, ou `null`. */
export function nextPlannedSessionDate(
  sessions: readonly SessionRow[],
  today: Date,
): string | null {
  const todayKey = toDateKey(today);
  let best: string | null = null;
  for (const s of sessions) {
    if (s.status !== 'planned') continue;
    if (s.seance_date < todayKey) continue;
    if (best === null || s.seance_date < best) best = s.seance_date;
  }
  return best;
}

function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function localTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function buildSnapshotRow(args: {
  userId: string;
  payload: unknown;
  appVersion: string;
  sessions: readonly SessionRow[];
  now: Date;
  timezone: string | null;
}): SnapshotRow {
  return {
    user_id: args.userId,
    payload: args.payload,
    app_version: args.appVersion,
    next_session_date: nextPlannedSessionDate(args.sessions, args.now),
    last_active_at: args.now.toISOString(),
    timezone: args.timezone,
  };
}

// =============================================================================
// Envoi
// =============================================================================

export type BackupResult =
  | { readonly ok: true; readonly at: string }
  | { readonly ok: false; readonly skipped: BackupSkip }
  | { readonly ok: false; readonly error: string };

/** Un seul envoi en vol : les demandes concurrentes fusionnent. */
let inFlight: Promise<BackupResult> | null = null;

/** Exposé pour les tests — vérifie la fusion sans toucher au réseau. */
export function coalesce(run: () => Promise<BackupResult>): Promise<BackupResult> {
  if (inFlight !== null) return inFlight;
  const p = run().finally(() => {
    inFlight = null;
  });
  inFlight = p;
  return p;
}

/** Exposé pour les tests. */
export function hasBackupInFlight(): boolean {
  return inFlight !== null;
}

function humanError(message: string): string {
  if (message.includes('SNAPSHOT_TOO_LARGE')) {
    return 'Ta sauvegarde dépasse la taille autorisée. Préviens Azur.';
  }
  return 'La sauvegarde en ligne a échoué. On réessaiera au prochain lancement.';
}

/**
 * Envoie un snapshot complet. Ne jette jamais, renvoie toujours un statut.
 *
 * `force` ne contourne que la garde de conflit (l'utilisateur a explicitement
 * choisi d'écraser le cloud avec cet appareil) — jamais le mode démo ni
 * l'absence de compte.
 */
export async function pushSnapshot(
  options: { force?: boolean } = {},
): Promise<BackupResult> {
  const force = options.force ?? false;
  const skip = evaluateBackupGuards(currentContext(force));
  if (skip !== null) return { ok: false, skipped: skip };

  return coalesce(async () => {
    const auth = useAuthStore.getState();
    const supabase = getSupabase();
    if (supabase === null || auth.userId === null) {
      return { ok: false, skipped: 'not_configured' as const };
    }
    try {
      const payload = await buildExportPayload();
      const row = buildSnapshotRow({
        userId: auth.userId,
        payload,
        appVersion: __APP_VERSION__,
        sessions: useCoachOsStore.getState().history.sessions,
        now: new Date(),
        timezone: localTimezone(),
      });
      const { error } = await supabase.from('snapshots').insert(row);
      if (error !== null) {
        return { ok: false, error: humanError(error.message) };
      }
      const at = new Date().toISOString();
      lsSet(KEY_LAST_AT, at);
      lsSet(KEY_DIRTY, null);
      useAuthStore.setState({ lastBackupAt: at });
      return { ok: true, at };
    } catch (e) {
      return { ok: false, error: humanError((e as Error).message ?? '') };
    }
  });
}

/**
 * Point d'entrée des déclencheurs métier (fin de séance, fin de cycle, modif
 * de profil…). Marque l'état comme « à envoyer » puis lance l'envoi **sans
 * l'attendre**. Si l'envoi échoue ou est sauté, le drapeau reste posé et le
 * prochain lancement de l'app rattrape.
 */
export function requestBackup(): void {
  lsSet(KEY_DIRTY, '1');
  void pushSnapshot();
}

/** Rattrapage à l'ouverture de l'app : n'envoie que s'il y a du retard. */
export async function pushIfDirty(): Promise<BackupResult | null> {
  if (!isBackupDirty()) return null;
  return pushSnapshot();
}

// =============================================================================
// Lecture (chantier F-2)
// =============================================================================

/**
 * Une sauvegarde disponible en ligne, **sans son payload** : la liste sert à
 * choisir, on ne télécharge les ~300 Ko qu'au moment de restaurer.
 */
export interface CloudSnapshotMeta {
  readonly id: number;
  /** Horodatage serveur (`now()` à l'insertion), jamais une horloge client. */
  readonly createdAt: string;
  /** Version de l'app qui a produit la sauvegarde. */
  readonly appVersion: string;
}

export type CloudRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const READ_ERROR =
  'Impossible de joindre tes sauvegardes en ligne. Vérifie ta connexion internet et réessaie.';

/**
 * Normalise les lignes renvoyées par PostgREST, du plus récent au plus ancien.
 * Fonction pure — c'est elle que les tests couvrent (le tri ne dépend pas de
 * la clause `order` du serveur, qu'on ne veut pas avoir à croire sur parole).
 */
export function toSnapshotMetas(rows: readonly unknown[]): CloudSnapshotMeta[] {
  const metas: CloudSnapshotMeta[] = [];
  for (const raw of rows) {
    if (raw === null || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    metas.push({
      id,
      createdAt: String(row.created_at ?? ''),
      appVersion: String(row.app_version ?? '?'),
    });
  }
  metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return metas;
}

/**
 * Les sauvegardes du compte connecté (la rétention serveur en garde 10).
 * Ne jette jamais. RLS garantit qu'on ne voit que les siennes.
 */
export async function listSnapshots(): Promise<CloudRead<CloudSnapshotMeta[]>> {
  const supabase = getSupabase();
  const userId = useAuthStore.getState().userId;
  if (supabase === null || userId === null) {
    return { ok: false, error: READ_ERROR };
  }
  try {
    const { data, error } = await supabase
      .from('snapshots')
      .select('id, created_at, app_version')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error !== null) return { ok: false, error: READ_ERROR };
    return { ok: true, value: toSnapshotMetas(data ?? []) };
  } catch {
    return { ok: false, error: READ_ERROR };
  }
}

/**
 * Télécharge le payload d'une sauvegarde — la plus récente si `id` est omis.
 * Ne jette jamais. Le contenu n'est **pas** validé ici : c'est `importPayload`
 * qui le passe au zod de l'export, exactement comme un fichier importé à la
 * main.
 */
export async function fetchSnapshot(
  id?: number,
): Promise<CloudRead<{ payload: unknown; meta: CloudSnapshotMeta }>> {
  const supabase = getSupabase();
  const userId = useAuthStore.getState().userId;
  if (supabase === null || userId === null) {
    return { ok: false, error: READ_ERROR };
  }
  try {
    let query = supabase
      .from('snapshots')
      .select('id, created_at, app_version, payload')
      .eq('user_id', userId);
    if (id !== undefined) query = query.eq('id', id);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1);
    if (error !== null) return { ok: false, error: READ_ERROR };
    const row = (data ?? [])[0];
    if (row === undefined) {
      return {
        ok: false,
        error: "Cette sauvegarde n'existe plus. Choisis-en une autre dans la liste.",
      };
    }
    const meta = toSnapshotMetas([row])[0];
    if (meta === undefined) return { ok: false, error: READ_ERROR };
    return { ok: true, value: { payload: (row as { payload: unknown }).payload, meta } };
  } catch {
    return { ok: false, error: READ_ERROR };
  }
}
