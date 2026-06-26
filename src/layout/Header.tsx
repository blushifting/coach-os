import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/programme': 'Accueil',
  '/cycle-bilan': 'Bilan de cycle',
  '/seance': 'Séance',
  '/progres': 'Progrès',
  '/catalogue': 'Exercices',
  '/profil': 'Profil',
};

export function Header() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'Kotsh';

  return (
    <header
      // Conv #11c — header sticky avec backdrop-blur sur fond translucide
      // graphite (matche le body chaud). Filet rouge sang sous la bordure
      // basse pour marquer l'identité visuelle.
      // Conv #11h — décalage à gauche pour laisser place au filigrane K
      // (`AppShell.BrandWatermark`, fixed left-3 w-8). `pl-20` (#11i bis) pour
      // créer un écart visuel net entre le K et le titre, plutôt que de les
      // coller.
      // Conv #15-1 — hauteur réduite (h-10) + paddingTop 0.4rem pour matcher
      // le centre vertical de la barre du StepIndicator d'onboarding.
      className="sticky top-0 z-10 flex items-center border-b border-sang-700/25 bg-graphite-950/85 pl-20 pr-5 backdrop-blur-md"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.4rem)' }}
    >
      <div className="flex h-10 w-full items-center justify-between">
        <h1 className="font-display text-2xl uppercase leading-none tracking-[0.06em] text-white">
          {title}
        </h1>
      </div>
    </header>
  );
}
