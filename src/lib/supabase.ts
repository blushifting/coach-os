/**
 * Chantier F-1 — client Supabase (singleton paresseux).
 *
 * Règle structurante : **sans variables d'environnement, toute la couche cloud
 * est inerte**. `getSupabase()` renvoie `null`, aucun appelant ne tente quoi
 * que ce soit, et `npm run dev`, les tests Vitest et les e2e Playwright
 * tournent sans réseau et sans modification. C'est ce qui protège le dev et
 * la CI, pas une astuce de test.
 *
 * La clé publiable finit dans le bundle JS : c'est le design normal de
 * Supabase. La sécurité repose entièrement sur les policies RLS côté Postgres
 * (cf. `recherche/12_supabase.md §1.1`). La clé `service_role` ne doit JAMAIS
 * arriver ici.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * La couche cloud est-elle branchée ? Faux dès qu'une des deux variables
 * manque — c'est le cas en dev local sans `.env.local`, en test et en e2e.
 */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
}

let client: SupabaseClient | null = null;

/**
 * Client partagé, créé à la première demande. `null` si la couche cloud n'est
 * pas configurée — tous les appelants doivent traiter ce cas.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client === null) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Retour de la redirection OAuth : le code d'autorisation arrive dans
        // l'URL, supabase-js l'échange contre une session puis nettoie l'URL.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/**
 * URL de retour après le détour par Google. Doit correspondre **exactement**
 * à une des « Redirect URLs » déclarées dans le dashboard Supabase (pas de
 * joker : une liste trop large est une faille classique de vol de jeton).
 *
 * `BASE_URL` vaut `/coach-os/` en dev comme en prod → on obtient
 * `http://localhost:5173/coach-os/` ou `https://blushifting.github.io/coach-os/`.
 */
export function oauthRedirectTo(): string {
  return window.location.origin + import.meta.env.BASE_URL;
}
