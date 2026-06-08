import type { HelpTopic } from '@/lib/help-glossary';
import { useHelp } from './help-context';

/**
 * Petit cercle "?" qui ouvre la sheet d'aide. 1.16 — passé en violet : dans la
 * grille sémantique de couleur, l'aide contextuelle = violet (le rouge est
 * réservé aux problèmes). Le « ? » se repère comme un affordance d'aide partout.
 */
export function HelpButton({ topic, label }: HelpButtonProps) {
  const { open } = useHelp();
  return (
    <button
      type="button"
      onClick={() => open(topic)}
      aria-label={label ?? `Aide : ${topic}`}
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-violet-700/40 bg-violet-900/40 text-[10px] font-bold text-violet-300 transition hover:bg-violet-800/60 hover:text-white"
    >
      ?
    </button>
  );
}

interface HelpButtonProps {
  readonly topic: HelpTopic;
  readonly label?: string;
}
