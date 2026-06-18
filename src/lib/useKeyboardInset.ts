import { useEffect, useState } from 'react';

/**
 * Bloc I (Conv #34) — hauteur (px) masquée en bas de l'écran par le clavier
 * virtuel, mesurée via l'API `visualViewport`.
 *
 * Sur iOS, le clavier ne réduit PAS le viewport de mise en page (`innerHeight`
 * reste plein) ni `dvh` : un bottom-sheet ancré en bas passe donc sous le
 * clavier. `visualViewport.height` reflète, lui, la zone réellement visible.
 * On en déduit l'inset = `innerHeight − visualViewport.height − offsetTop`,
 * qu'on applique au `Sheet` pour le remonter au-dessus du clavier.
 *
 * Renvoie 0 si l'API est absente ou si aucun clavier n'est ouvert (et sur
 * Android où `interactive-widget=resizes-content` a déjà réduit le viewport).
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const bottom = window.innerHeight - vv.height - vv.offsetTop;
      // Seuil anti-bruit : on ignore les micro-écarts (barres d'URL animées…).
      setInset(bottom > 80 ? Math.round(bottom) : 0);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
