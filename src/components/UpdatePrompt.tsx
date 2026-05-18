import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/Button';
import { cn } from '@/lib/cn';

/**
 * Bannière de notification de mise à jour PWA.
 *
 * Le service worker (configuré en `registerType: 'prompt'` dans
 * `vite.config.ts`) détecte une nouvelle version en arrière-plan dès que
 * l'app est ouverte. `useRegisterSW` expose `needRefresh` qui passe à `true`
 * quand un nouveau SW est en attente d'activation. Le bouton "Mettre à jour"
 * appelle `updateServiceWorker(true)` qui active le nouveau SW et recharge
 * la page. **Les données IndexedDB sont préservées** (le reload ne touche
 * que les fichiers JS/CSS/HTML cachés par Workbox).
 *
 * En dev (`devOptions.enabled: false`), le hook ne déclenche jamais
 * `needRefresh` — le composant reste invisible.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-prompt"
      className={cn(
        'fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-3 sm:max-w-sm',
        'rounded-2xl border border-sang-500/30 bg-anthracite-900/95 p-4',
        'shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm',
      )}
    >
      <p className="text-sm font-medium text-white">
        Nouvelle version disponible
      </p>
      <p className="mt-1 text-xs text-anthracite-300">
        Tes données de séances et de progression seront conservées.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => void updateServiceWorker(true)}
          data-testid="update-prompt-reload"
        >
          Mettre à jour
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNeedRefresh(false)}
          data-testid="update-prompt-dismiss"
        >
          Plus tard
        </Button>
      </div>
    </div>
  );
}
