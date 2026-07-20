import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { TabBar, tabIndexOf } from './TabBar';

export function TabbedLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  // Conv #66 — la page entre du côté d'où elle vient : aller vers un onglet
  // situé à droite la fait entrer par la droite. Le fondu neutre d'avant ne
  // disait rien du déplacement.
  //
  // Hors barre d'onglets (séance, bilan… → index −1), aucun ordre à invoquer :
  // on retombe sur le fondu vertical d'origine.
  const tabIdx = tabIndexOf(pathname);
  const prevTabIdx = useRef(tabIdx);
  const pageAnim =
    tabIdx < 0 || prevTabIdx.current < 0
      ? 'motion-safe:animate-page-fade'
      : tabIdx >= prevTabIdx.current
        ? 'motion-safe:animate-page-in-right'
        : 'motion-safe:animate-page-in-left';
  useEffect(() => {
    prevTabIdx.current = tabIdx;
  }, [tabIdx]);

  // Conv #15 vague 2 — repart en haut à chaque changement d'onglet (sinon
  // un scroll laissé sur Catalogue reste appliqué quand on revient sur
  // Programme, ce qui désoriente).
  useEffect(() => {
    if (mainRef.current !== null) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <>
      <Header />
      <main ref={mainRef} className="flex-1 overflow-y-auto px-5 py-4">
        {/* Bloc C 1.16 — transition de page cohérente à chaque changement de
            route. La clé relance l'anim. Conv #66 — le sens vient de l'ordre des
            onglets (cf. `pageAnim`). `min-h-full` + flex : une page peut choisir
            d'occuper la hauteur restante (accueil : rythme vertical aéré). */}
        <div key={pathname} className={`flex min-h-full flex-col ${pageAnim}`}>
          <Outlet />
        </div>
      </main>
      <TabBar />
    </>
  );
}
