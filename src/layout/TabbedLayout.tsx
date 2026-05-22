import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { TabBar } from './TabBar';

export function TabbedLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

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
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
