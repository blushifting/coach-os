import type { HelpTopic } from '@/lib/help-glossary';
import { HELP_GLOSSARY } from '@/lib/help-glossary';
import { Sheet } from './Sheet';

interface HelpSheetProps {
  readonly topic: HelpTopic | null;
  readonly onClose: () => void;
}

export function HelpSheet({ topic, onClose }: HelpSheetProps) {
  const entry = topic ? HELP_GLOSSARY[topic] : null;

  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry?.title}>
      {entry && (
        <p className="text-sm leading-relaxed text-anthracite-500">{entry.body}</p>
      )}
    </Sheet>
  );
}
