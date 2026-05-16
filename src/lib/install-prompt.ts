/**
 * Gestion de l'installation PWA.
 *
 * Capture l'événement `beforeinstallprompt` au plus tôt (le navigateur le
 * fire une seule fois, souvent avant que le composant Welcome ne soit
 * monté). On le stocke en module-level et on l'expose via `triggerInstall()`.
 *
 * Détection de l'état "déjà installé" via `display-mode: standalone`
 * (Chrome/Android/desktop) ou `navigator.standalone` (iOS Safari).
 *
 * En mode dev (`import.meta.env.DEV`), on considère l'app comme installée
 * pour ne pas bloquer `npm run dev` ni les e2e Playwright.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function hasNativeInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export async function triggerInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * En dev, on traite l'app comme installée pour ne pas bloquer le dev server
 * et les tests e2e (qui tournent sur Vite dev).
 */
export function isInstalledOrDev(): boolean {
  if (import.meta.env.DEV) return true;
  return isStandalone();
}
