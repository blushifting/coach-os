/**
 * Hooks de mouvement réutilisables (Conv #66).
 *
 * Tous respectent `prefers-reduced-motion` : ils rendent l'état FINAL dès le
 * premier rendu au lieu de l'animer. Les composants n'ont donc pas à tester la
 * préférence eux-mêmes — sauf pour les classes CSS, où le variant `motion-safe:`
 * de Tailwind reste la bonne porte.
 */

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/** `prefers-reduced-motion`, réactif (l'utilisateur peut basculer le réglage à chaud). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Valeur qui part de `from` et bascule vers `to` juste après le montage, à
 * brancher sur une propriété CSS en transition (largeur, opacité…).
 *
 * Le double `requestAnimationFrame` n'est pas de la superstition : le navigateur
 * doit avoir PEINT `from` avant que `to` n'arrive, sinon il ne voit qu'une seule
 * valeur et il n'y a aucune transition à interpoler. Un `useEffect` seul ne le
 * garantit pas.
 *
 * ⚠️ `to` sert de dépendance d'effet → valeurs primitives uniquement.
 */
export function useAnimateOnMount<T>(from: T, to: T): T {
  const reduced = useReducedMotion();
  const [value, setValue] = useState<T>(reduced ? to : from);

  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setValue(to));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [reduced, to]);

  return value;
}

/**
 * Booléen qui passe à `true` après `delayMs`. Sert à déclencher une animation
 * one-shot au bon moment, ou à marquer la fin d'une transition sans dépendre
 * d'un `transitionend` (qui ne se déclenche jamais si la valeur ne change pas).
 *
 * En mouvement réduit, le flag est `true` d'emblée : l'état final est atteint
 * sans délai. Pour qu'il ne déclenche AUCUNE animation dans ce cas, la classe
 * pilotée doit passer par `motion-safe:` — le variant la neutralise.
 */
export function useDelayedFlag(delayMs: number): boolean {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setOn(true);
      return;
    }
    const id = window.setTimeout(() => setOn(true), delayMs);
    return () => window.clearTimeout(id);
  }, [reduced, delayMs]);

  return on;
}

/**
 * Compteur animé de la valeur courante vers `to`, après `delayMs`.
 *
 * L'easing (`easeOutCubic`) est de la même famille que le `ease-out` des
 * transitions CSS : un compteur posé à côté d'une barre qui se remplit part et
 * arrive avec elle.
 */
export function useCountUp(to: number, durationMs: number, delayMs = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  // Valeur réellement affichée : point de départ si `to` change en cours de route.
  const currentRef = useRef(reduced ? to : 0);

  useEffect(() => {
    if (reduced) {
      currentRef.current = to;
      setValue(to);
      return;
    }
    const from = currentRef.current;
    let raf = 0;
    let startedAt = 0;

    const tick = (now: number) => {
      if (startedAt === 0) startedAt = now;
      const elapsed = now - startedAt - delayMs;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (to - from) * eased;
      currentRef.current = next;
      setValue(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, to, durationMs, delayMs]);

  return value;
}
