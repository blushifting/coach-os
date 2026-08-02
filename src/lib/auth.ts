/**
 * Chantier F-1 — compte cloud : connexion Google, réconciliation, sortie.
 *
 * Le magic link par email est mort-né (Supabase refuse de délivrer aux
 * adresses hors équipe du projet sans SMTP tiers) → **Google OAuth
 * uniquement**, et le contrôle d'accès se fait par une allowlist d'adresses
 * côté Postgres, qui refuse l'inscription via un trigger sur `auth.users`.
 *
 * Ce module ne touche jamais à Dexie : l'effacement local est du ressort de
 * `resetApp()` (`hooks/useEngine.ts`), que l'UI appelle après un retour `ok`.
 */

import type { Session } from '@supabase/supabase-js';
import {
  clearReconciled,
  markReconciled,
  pushIfDirty,
  pushSnapshot,
  readLastBackupAt,
  readReconciledUserId,
} from '@/lib/backup';
import { getSupabase, isSupabaseConfigured, oauthRedirectTo } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useCoachOsStore } from '@/store';

export const NOT_ALLOWED_MESSAGE =
  "Cette adresse n'est pas autorisée. Demande à Azur de l'ajouter, puis réessaie.";

const GENERIC_SIGNIN_ERROR =
  'La connexion a échoué. Vérifie ta connexion internet et réessaie.';

// =============================================================================
// Interception de l'erreur de retour OAuth
// =============================================================================

/**
 * Le refus de l'allowlist remonte de Postgres jusqu'à l'URL de retour sous une
 * forme illisible (« Database error saving new user », `unexpected_failure`).
 * Comme le SEUL trigger posé sur `auth.users` est celui de l'allowlist, une
 * erreur serveur à l'inscription veut dire ça et rien d'autre.
 *
 * Lit puis **nettoie** les paramètres d'erreur de l'URL (query et fragment) —
 * sinon un simple rechargement de page ré-afficherait l'erreur.
 */
export function takeOAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error = search.get('error') ?? hash.get('error');
  if (error === null) return null;
  const description =
    search.get('error_description') ?? hash.get('error_description') ?? '';
  const code = search.get('error_code') ?? hash.get('error_code') ?? '';
  window.history.replaceState({}, '', window.location.pathname);
  return interpretOAuthError({ error, code, description });
}

/** Fonction pure — c'est elle que les tests couvrent. */
export function interpretOAuthError(args: {
  error: string;
  code: string;
  description: string;
}): string {
  const haystack = `${args.error} ${args.code} ${args.description}`.toLowerCase();
  if (
    haystack.includes('email_not_allowed') ||
    haystack.includes('database error') ||
    haystack.includes('unexpected_failure')
  ) {
    return NOT_ALLOWED_MESSAGE;
  }
  if (haystack.includes('access_denied')) {
    return 'Connexion annulée.';
  }
  return GENERIC_SIGNIN_ERROR;
}

// =============================================================================
// Démarrage
// =============================================================================

function applySession(session: Session | null): void {
  useAuthStore.setState({
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
  });
}

let initialized = false;

/**
 * À appeler une fois au démarrage, **après** `bootstrap()` : la réconciliation
 * a besoin de savoir si cet appareil porte déjà des données, information qui
 * vient du store moteur.
 */
export async function initAuth(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const oauthError = takeOAuthErrorFromUrl();
  const supabase = getSupabase();
  if (supabase === null) {
    useAuthStore.setState({ ready: true, error: oauthError });
    return;
  }

  useAuthStore.setState({
    error: oauthError,
    lastBackupAt: readLastBackupAt(),
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const previous = useAuthStore.getState().userId;
    applySession(session);
    const next = session?.user.id ?? null;
    if (next !== null && next !== previous) void reconcile();
  });

  const { data } = await supabase.auth.getSession();
  applySession(data.session);
  useAuthStore.setState({ ready: true });
  if (data.session !== null) await reconcile();
}

// =============================================================================
// Réconciliation à la connexion (doc 12 §3.2)
// =============================================================================

/**
 * Trois cas, un seul point de décision :
 *   - **A** — cet appareil a des données, le cloud est vide → envoi immédiat,
 *     sans rien demander (c'est le cas d'Azur au premier branchement).
 *   - **B** — appareil vierge, cloud plein → on le dit ; la restauration
 *     arrive en F-2.
 *   - **C** — les deux ont des données → dialogue explicite, jamais silencieux.
 *
 * Une fois réconcilié, l'appareil est marqué pour ce compte : on ne repose
 * plus la question à chaque lancement.
 */
export async function reconcile(): Promise<void> {
  const supabase = getSupabase();
  const userId = useAuthStore.getState().userId;
  if (supabase === null || userId === null) return;

  if (readReconciledUserId() === userId) {
    await pushIfDirty();
    return;
  }

  const { data, error } = await supabase
    .from('snapshots')
    .select('created_at, app_version')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  // Réseau ou projet en pause : on ne conclut rien, on retentera au prochain
  // lancement. Surtout ne pas prendre « pas de réponse » pour « cloud vide ».
  if (error !== null) return;

  const localHasData = useCoachOsStore.getState().userState !== null;
  const cloud = data?.[0] ?? null;

  if (cloud === undefined || cloud === null) {
    // Cas A (ou appareil vierge + cloud vide : rien à envoyer).
    if (!localHasData) {
      markReconciled(userId);
      return;
    }
    const result = await pushSnapshot({ force: true });
    if (result.ok) markReconciled(userId);
    return;
  }

  useAuthStore.setState({
    conflict: {
      cloudAt: String(cloud.created_at),
      cloudAppVersion: String(cloud.app_version ?? '?'),
      localHasData,
    },
  });
}

/**
 * L'utilisateur tranche le conflit en faveur de cet appareil. Rien n'est perdu
 * côté cloud : les 10 dernières sauvegardes sont conservées par la rétention
 * serveur, donc F-2 pourra toujours remonter le temps.
 */
export async function keepThisDevice(): Promise<{ ok: boolean; error?: string }> {
  const userId = useAuthStore.getState().userId;
  if (userId === null) return { ok: false };
  const localHasData = useCoachOsStore.getState().userState !== null;
  useAuthStore.setState({ busy: true, error: null });
  try {
    if (!localHasData) {
      markReconciled(userId);
      useAuthStore.setState({ conflict: null });
      return { ok: true };
    }
    const result = await pushSnapshot({ force: true });
    if (!result.ok) {
      const message = 'error' in result ? result.error : GENERIC_SIGNIN_ERROR;
      useAuthStore.setState({ error: message });
      return { ok: false, error: message };
    }
    markReconciled(userId);
    useAuthStore.setState({ conflict: null });
    return { ok: true };
  } finally {
    useAuthStore.setState({ busy: false });
  }
}

// =============================================================================
// Connexion / sortie
// =============================================================================

/**
 * Redirection pleine page vers Google. Au retour, `detectSessionInUrl` échange
 * le code contre une session et `onAuthStateChange` déclenche la
 * réconciliation.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) return;
  useAuthStore.setState({ busy: true, error: null });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirectTo() },
  });
  if (error !== null) {
    useAuthStore.setState({ busy: false, error: GENERIC_SIGNIN_ERROR });
  }
  // Succès : la page part vers Google, inutile de relâcher `busy`.
}

/**
 * Sortie « je me suis trompé de compte » : on quitte la session sans toucher
 * aux données locales. Rien à voir avec la déconnexion depuis le Profil.
 */
export async function abortSignIn(): Promise<void> {
  const supabase = getSupabase();
  useAuthStore.setState({ conflict: null, error: null });
  if (supabase === null) return;
  await supabase.auth.signOut();
  applySession(null);
}

/**
 * Déconnexion depuis le Profil — **action destructrice** : elle sert à passer
 * l'appareil à quelqu'un d'autre, donc elle efface les données locales.
 *
 * Contrat : on n'efface RIEN tant que le cloud n'a pas confirmé avoir reçu la
 * sauvegarde. L'effacement lui-même reste à l'appelant (`resetApp()`), qui
 * n'est appelé que si cette fonction renvoie `ok`.
 */
export async function backupThenSignOut(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = getSupabase();
  if (supabase === null) return { ok: false, error: GENERIC_SIGNIN_ERROR };
  useAuthStore.setState({ busy: true, error: null });
  try {
    const result = await pushSnapshot({ force: true });
    if (!result.ok) {
      const message =
        'error' in result
          ? result.error
          : "Impossible d'envoyer ta sauvegarde maintenant. Vérifie ta connexion internet avant de te déconnecter — sinon tes données de cet appareil seraient perdues.";
      useAuthStore.setState({ error: message });
      return { ok: false, error: message };
    }
    await supabase.auth.signOut();
    clearReconciled();
    applySession(null);
    useAuthStore.setState({ conflict: null });
    return { ok: true };
  } finally {
    useAuthStore.setState({ busy: false });
  }
}

/**
 * Suppression de compte (RGPD). Une fonction SQL `security definer` suffit —
 * le `on delete cascade` de `snapshots` fait le ménage. L'effacement local
 * reste à l'appelant.
 */
export async function deleteCloudAccount(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = getSupabase();
  if (supabase === null) return { ok: false, error: GENERIC_SIGNIN_ERROR };
  useAuthStore.setState({ busy: true, error: null });
  try {
    const { error } = await supabase.rpc('delete_my_account');
    if (error !== null) {
      const message =
        'La suppression du compte a échoué. Réessaie dans un moment.';
      useAuthStore.setState({ error: message });
      return { ok: false, error: message };
    }
    await supabase.auth.signOut();
    clearReconciled();
    applySession(null);
    useAuthStore.setState({ conflict: null });
    return { ok: true };
  } finally {
    useAuthStore.setState({ busy: false });
  }
}

/** Envoi manuel depuis le Profil (bouton « Sauvegarder maintenant »). */
export async function backupNow(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  useAuthStore.setState({ busy: true, error: null });
  try {
    const result = await pushSnapshot();
    if (result.ok) return { ok: true };
    const message =
      'error' in result
        ? result.error
        : 'Sauvegarde impossible pour le moment.';
    useAuthStore.setState({ error: message });
    return { ok: false, error: message };
  } finally {
    useAuthStore.setState({ busy: false });
  }
}
