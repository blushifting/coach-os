import type { ReactNode } from 'react';
import type { HelpTopic } from '@/lib/help-glossary';
import { useHelp } from './help-context';
import { cn } from '@/lib/cn';

interface ConceptProps {
  readonly topic: HelpTopic;
  readonly children: ReactNode;
  /** Libellé lecteur d'écran. Défaut : texte + « voir la définition ». */
  readonly label?: string;
  readonly className?: string;
}

/**
 * Terme verrouillé de Kotsh (Plafond, Cycle, Effort, Récupération…) rendu
 * comme un mot « défini » : soulignement pointillé discret dans la teinte
 * marque, tappable pour ouvrir son explication (glossaire d'aide partagé).
 *
 * C'est l'« infobulle dans le mot » : pas de « ? » séparé à côté — le concept
 * lui-même porte l'affordance. À réserver à la première / principale
 * occurrence d'un écran (divulgation progressive : ne pas rendre chaque
 * répétition tappable, ça ferait du bruit). Hérite couleur et graisse du
 * texte parent (`text-inherit`), ne change que le soulignement.
 */
export function Concept({ topic, children, label, className }: ConceptProps) {
  const { open } = useHelp();
  const a11y =
    label ?? (typeof children === 'string' ? `${children} — voir la définition` : undefined);
  return (
    <button
      type="button"
      onClick={() => open(topic)}
      aria-label={a11y}
      className={cn(
        // Conv #24 — soulignement passé de sang-500/50 à sang-500 pleine
        // opacité : à 50 % le pointillé devenait quasi invisible sur fond
        // anthracite sous du texte atténué (ex. légende « Déload » du
        // calendrier), l'affordance « mot défini » ne se lisait plus.
        'inline border-b border-dotted border-sang-500 text-inherit underline-offset-2 transition-colors hover:border-sang-400 hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}
