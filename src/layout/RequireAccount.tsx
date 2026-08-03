/**
 * Chantier F — l'app est réservée aux adresses de l'allowlist.
 *
 * Garde posée devant TOUTES les routes sauf `/welcome` : sans compte lié, on
 * n'atteint ni l'accueil, ni l'onboarding, ni quoi que ce soit d'autre.
 *
 * Trois précisions qui comptent :
 *
 * 1. **Sans couche cloud configurée, la garde est inerte.** C'est la règle de
 *    tout le chantier : `npm run dev` sans `.env.local`, Vitest et Playwright
 *    tournent exactement comme avant.
 * 2. **Tant que la session n'est pas résolue, on n'affiche rien de définitif.**
 *    Rediriger sur `/welcome` pendant la seconde où `initAuth()` travaille
 *    ferait clignoter l'écran de connexion sous le nez de quelqu'un qui est
 *    parfaitement connecté.
 * 3. **Un appareil déjà lié à un compte reste utilisable même sans session
 *    valide.** Ce n'est pas un adoucissement du verrou : la déconnexion et la
 *    suppression de compte effacent ce marqueur (`clearReconciled()`), donc un
 *    appareil rendu ou prêté est bien verrouillé. Le seul cas couvert ici est
 *    l'accident — jeton expiré pendant une séance en sous-sol sans réseau, où
 *    `getSession()` ne peut pas rafraîchir. Sans cette tolérance, l'app se
 *    fermerait au nez de son utilisateur, au milieu de sa séance, en lui
 *    rendant ses propres données inaccessibles. La `CompteSection` affiche
 *    alors « Me connecter » pour rétablir la sauvegarde.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { SplashScreen } from '@/components/SplashScreen';
import { readReconciledUserId } from '@/lib/backup';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export type AccessDecision = 'allow' | 'wait' | 'signin';

/**
 * Fonction pure — c'est elle que les tests couvrent. L'ordre des clauses est
 * la règle : `wait` doit passer avant tout refus, sinon l'écran de connexion
 * clignote au démarrage de quelqu'un de parfaitement connecté.
 */
export function decideAccess(args: {
  cloudConfigured: boolean;
  ready: boolean;
  signedIn: boolean;
  deviceLinked: boolean;
}): AccessDecision {
  if (!args.cloudConfigured) return 'allow';
  if (!args.ready) return 'wait';
  if (args.signedIn) return 'allow';
  return args.deviceLinked ? 'allow' : 'signin';
}

export function RequireAccount() {
  const ready = useAuthStore((s) => s.ready);
  const signedIn = useAuthStore((s) => s.userId !== null);

  const decision = decideAccess({
    cloudConfigured: isSupabaseConfigured(),
    ready,
    signedIn,
    deviceLinked: readReconciledUserId() !== null,
  });

  if (decision === 'wait') return <SplashScreen />;
  if (decision === 'signin') return <Navigate to="/welcome" replace />;
  return <Outlet />;
}
