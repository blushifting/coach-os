/**
 * Chantier F — capture du retour OAuth, **avant que React ne monte**.
 *
 * Google et Supabase déposent le résultat de la connexion dans l'URL de
 * retour : `?code=…` en cas de succès, `?error=…&error_description=…` quand
 * l'allowlist refuse l'adresse. Or cette URL de retour est la racine de l'app,
 * et la racine redirige aussitôt (`/` → `/programme` → `/welcome` tant qu'il
 * n'y a pas de programme). Une redirection de React Router **jette la query
 * string**.
 *
 * Conséquence mesurée : le code d'autorisation comme le message de refus
 * étaient détruits avant que `initAuth()` ou supabase-js ne regardent l'URL.
 * D'où une connexion qui réussissait côté Google sans jamais ouvrir de session
 * dans l'app, et un refus d'allowlist parfaitement silencieux.
 *
 * D'où ce module : `captureOAuthReturn()` est appelée en tout premier dans
 * `main.tsx`, avant le rendu ; elle met les paramètres de côté et nettoie
 * l'URL. `initAuth()` les consomme ensuite à son rythme. L'échange du code se
 * fait alors à la main (`exchangeCodeForSession`) plutôt que par
 * `detectSessionInUrl` : on ne peut pas confier la lecture de l'URL à un
 * client qui s'initialise après le premier rendu — et le faire nous-mêmes
 * permet de signaler un échange raté au lieu de le laisser passer sans un mot.
 */

/** Paramètres d'erreur bruts, tels qu'ils arrivent dans l'URL. */
export interface OAuthErrorParams {
  readonly error: string;
  readonly code: string;
  readonly description: string;
}

export interface OAuthReturn {
  /** Code d'autorisation à échanger contre une session, ou `null`. */
  readonly code: string | null;
  /** Refus / annulation, à traduire par `interpretOAuthError`. */
  readonly error: OAuthErrorParams | null;
}

const EMPTY: OAuthReturn = { code: null, error: null };

let captured: OAuthReturn = EMPTY;

/**
 * Lit un retour OAuth dans une query string et un fragment. Les deux sont
 * inspectés : le flux PKCE répond dans la query, mais GoTrue renvoie certaines
 * erreurs dans le fragment.
 *
 * Fonction pure — c'est elle que les tests couvrent.
 */
export function readOAuthReturn(search: string, hash: string): OAuthReturn {
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const pick = (key: string): string | null =>
    query.get(key) ?? fragment.get(key);

  const error = pick('error');
  if (error !== null) {
    return {
      code: null,
      error: {
        error,
        code: pick('error_code') ?? '',
        description: pick('error_description') ?? '',
      },
    };
  }

  const code = pick('code');
  return code === null ? EMPTY : { code, error: null };
}

/**
 * À appeler une seule fois, le plus tôt possible dans le démarrage.
 *
 * Ne touche à l'URL que si elle porte effectivement un retour OAuth : sinon un
 * lien profond légitime (`/cycle-bilan?cycle=2`) perdrait ses paramètres.
 */
export function captureOAuthReturn(): void {
  if (typeof window === 'undefined') return;
  const found = readOAuthReturn(window.location.search, window.location.hash);
  if (found.code === null && found.error === null) return;
  captured = found;
  window.history.replaceState({}, '', window.location.pathname);
}

/**
 * Consommation unique : un rechargement de page ne doit pas rejouer le retour
 * (un code d'autorisation ne s'échange qu'une fois, et une erreur déjà lue ne
 * doit pas se ré-afficher).
 */
export function takeOAuthReturn(): OAuthReturn {
  const value = captured;
  captured = EMPTY;
  return value;
}
