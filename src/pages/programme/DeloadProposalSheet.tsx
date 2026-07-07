import { Button } from '@/components/Button';
import { Concept } from '@/components/Concept';
import { Sheet } from '@/components/Sheet';

interface DeloadProposalSheetProps {
  readonly open: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
  readonly onClose: () => void;
}

/**
 * Chantier B — proposition de semaine de récupération (déload opt-in).
 *
 * S'affiche à l'entrée en semaine 5 quand l'assiduité des 4 premières semaines
 * est haute (proxy de fatigue accumulée, cf. recherche/09c_deload_optin.md).
 * L'utilisateur décide : alléger la semaine, ou continuer normalement. Le choix
 * est persisté AVANT de générer la séance (la prescription en dépend).
 */
export function DeloadProposalSheet({
  open,
  onAccept,
  onDecline,
  onClose,
}: DeloadProposalSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Semaine de récupération ?">
      <div className="flex flex-col gap-4" data-testid="deload-proposal-sheet">
        <p className="text-sm leading-relaxed text-anthracite-100">
          Tu as bien suivi tes quatre premières semaines. Tu peux t'accorder une
          semaine de{' '}
          <Concept topic="deload">récupération</Concept> pour laisser ton corps
          souffler, ou continuer sur ta lancée.
        </p>
        <p className="text-sm leading-relaxed text-anthracite-300">
          En récupération : des séances plus courtes et plus légères. On ne
          mesure pas tes Plafonds cette semaine, tu reprends la progression au
          cycle suivant.
        </p>
        <div className="mt-1 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onAccept}
            data-testid="deload-accept"
          >
            Alléger cette semaine
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={onDecline}
            data-testid="deload-decline"
          >
            Continuer normalement
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
