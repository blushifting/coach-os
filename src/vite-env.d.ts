/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

/** Numéro de version injecté au build depuis `package.json` (Conv #14a). */
declare const __APP_VERSION__: string;

/**
 * Chantier F — variables d'environnement de la couche cloud (Supabase).
 *
 * Absentes en dev et en test : toute la couche cloud est alors **inerte**
 * (cf. `isSupabaseConfigured`). Elles sont injectées au build GitHub Actions
 * depuis les secrets du dépôt. Les deux valeurs sont publiques par design —
 * la sécurité repose entièrement sur les policies RLS côté Postgres.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
