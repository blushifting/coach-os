import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { HelpTopic } from '@/lib/help-glossary';
import { HelpSheet } from './HelpSheet';

interface HelpContextValue {
  readonly open: (topic: HelpTopic) => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const open = useCallback((t: HelpTopic) => setTopic(t), []);
  const value = useMemo<HelpContextValue>(() => ({ open }), [open]);

  return (
    <HelpContext.Provider value={value}>
      {children}
      <HelpSheet topic={topic} onClose={() => setTopic(null)} />
    </HelpContext.Provider>
  );
}

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp() doit être utilisé sous <HelpProvider>');
  return ctx;
}
