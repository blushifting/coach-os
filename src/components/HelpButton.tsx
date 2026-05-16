import type { HelpTopic } from '@/lib/help-glossary';
import { useHelp } from './help-context';

interface HelpButtonProps {
  readonly topic: HelpTopic;
  readonly label?: string;
}

export function HelpButton({ topic, label }: HelpButtonProps) {
  const { open } = useHelp();
  return (
    <button
      type="button"
      onClick={() => open(topic)}
      aria-label={label ?? `Aide : ${topic}`}
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-anthracite-800 text-[10px] font-bold text-anthracite-300 transition hover:bg-anthracite-700 hover:text-white"
    >
      ?
    </button>
  );
}
