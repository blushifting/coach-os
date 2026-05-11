import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Dialog } from '@/components/Dialog';
import { Stepper } from '@/components/Stepper';
import { HelpButton } from '@/components/HelpButton';
import type { HelpTopic } from '@/lib/help-glossary';
import { HELP_GLOSSARY } from '@/lib/help-glossary';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-anthracite-500">{title}</h2>
      {children}
    </section>
  );
}

export default function DevPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepperValue, setStepperValue] = useState(8);
  const helpTopics = Object.keys(HELP_GLOSSARY) as HelpTopic[];

  return (
    <div className="space-y-8 pb-8">
      <header>
        <h1 className="text-2xl font-semibold">Dev — catalogue composants</h1>
        <p className="mt-1 text-sm text-anthracite-500">
          Page accessible en dev uniquement. Sert de référence visuelle / QA.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <Button fullWidth>Full width</Button>
      </Section>

      <Section title="Card">
        <Card>
          <p className="text-sm">
            Contenu d'une carte avec padding par défaut. Sert de conteneur pour les blocs métier.
          </p>
        </Card>
      </Section>

      <Section title="Stepper">
        <Card>
          <Stepper value={stepperValue} onChange={setStepperValue} min={0} max={20} suffix=" reps" />
        </Card>
      </Section>

      <Section title="Sheet / Dialog">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Ouvrir Sheet
          </Button>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Ouvrir Dialog
          </Button>
        </div>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Titre du Sheet">
          <p className="text-sm text-anthracite-500">
            Contenu du drawer. Glisse depuis le bas, ferme au clic extérieur ou Échap.
          </p>
        </Sheet>
        <Dialog
          open={dialogOpen}
          onCancel={() => setDialogOpen(false)}
          onConfirm={() => setDialogOpen(false)}
          title="Confirmer l'action ?"
          description="Cette action est définitive. Continuer ?"
          destructive
          confirmLabel="Supprimer"
        />
      </Section>

      <Section title="HelpButton (13 termes)">
        <Card>
          <div className="flex flex-wrap gap-3">
            {helpTopics.map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-sm text-white">
                <span>{HELP_GLOSSARY[t].title}</span>
                <HelpButton topic={t} />
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}
