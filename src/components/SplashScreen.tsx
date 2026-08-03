/**
 * Écran d'attente du démarrage. Deux appelants :
 *
 * - `AppShell`, tant que la base locale n'est pas hydratée ;
 * - `RequireAccount`, entre l'hydratation et la résolution de la session
 *   cloud — montrer l'écran de connexion pendant cette fenêtre le ferait
 *   clignoter sous le nez de quelqu'un de parfaitement connecté.
 *
 * Vit dans son propre fichier plutôt que dans `AppShell` : `RequireAccount`
 * est testé unitairement, et importer `AppShell` y ferait entrer `UpdatePrompt`
 * et son module virtuel `virtual:pwa-register/react`, que Vitest ne sait pas
 * résoudre.
 */

export function SplashScreen() {
  return (
    <div
      className="flex flex-1 items-center justify-center"
      data-testid="app-splash"
      aria-busy="true"
      aria-label="Chargement"
    >
      <img
        src={`${import.meta.env.BASE_URL}icon.svg`}
        alt=""
        className="h-16 w-16 animate-pulse"
      />
    </div>
  );
}
