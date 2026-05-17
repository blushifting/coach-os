import type { HelpTopic } from '@/lib/help-glossary';
import { useHelp } from './help-context';

/**
 * Petit cercle "?" qui ouvre la sheet d'aide. Conv #11c : fond sang-800/50
 * + bordure sang-700/40 → le bouton attire l'œil sans être agressif, et
 * s'inscrit dans la signature rouge globale de l'app.
 */
export function HelpButton({ topic, label }: HelpButtonProps) {
  const { open } = useHelp();
  return (
    <button
      type="button"
      onClick={() => open(topic)}
      aria-label={label ?? `Aide : ${topic}`}
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-sang-700/40 bg-sang-900/40 text-[10px] font-bold text-sang-300 transition hover:bg-sang-800/60 hover:text-white"
    >
      ?
    </button>
  );
}

interface HelpButtonProps {
  readonly topic: HelpTopic;
  readonly label?: string;
}
