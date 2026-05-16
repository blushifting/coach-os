import { Sheet } from '@/components/Sheet';
import { MUSCLES } from '@/engine/models';
import type { ChargeType, Pattern } from '@/engine/models';
import { ExType } from '@/engine/models';
import { cn } from '@/lib/cn';
import {
  CHARGE_LABEL_FR,
  EXTYPE_LABEL_FR,
  EMPTY_FILTERS,
  FILTER_CHARGES,
  FILTER_PATTERNS,
  PATTERN_LABEL_FR,
  type CatalogFilters,
} from '@/lib/catalog-filter';
import { muscleLabel } from '@/lib/progress';

interface FiltersSheetProps {
  readonly open: boolean;
  readonly filters: CatalogFilters;
  readonly onChange: (next: CatalogFilters) => void;
  readonly onClose: () => void;
}

/**
 * Panneau de filtres — muscles primaires, patterns, charges, type
 * (polyarticulaire/isolation), tag "étirement". Le champ texte reste sur la
 * page principale (toujours visible).
 */
export function FiltersSheet({
  open,
  filters,
  onChange,
  onClose,
}: FiltersSheetProps) {
  const toggleMuscle = (m: string) => {
    const has = filters.muscles.includes(m);
    onChange({
      ...filters,
      muscles: has ? filters.muscles.filter((x) => x !== m) : [...filters.muscles, m],
    });
  };
  const togglePattern = (p: Pattern) => {
    const has = filters.patterns.includes(p);
    onChange({
      ...filters,
      patterns: has ? filters.patterns.filter((x) => x !== p) : [...filters.patterns, p],
    });
  };
  const toggleCharge = (c: ChargeType) => {
    const has = filters.charges.includes(c);
    onChange({
      ...filters,
      charges: has ? filters.charges.filter((x) => x !== c) : [...filters.charges, c],
    });
  };
  const toggleType = (t: ExType) => {
    const has = filters.types.includes(t);
    onChange({
      ...filters,
      types: has ? filters.types.filter((x) => x !== t) : [...filters.types, t],
    });
  };
  const toggleLengthened = () => {
    onChange({ ...filters, lengthenedBiasOnly: !filters.lengthenedBiasOnly });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Filtres">
      <div className="flex flex-col gap-4" data-testid="filters-sheet-content">
        <Section title="Type">
          <Chip
            active={filters.types.includes(ExType.COMPOUND)}
            onClick={() => toggleType(ExType.COMPOUND)}
            testId="filter-type-compound"
          >
            {EXTYPE_LABEL_FR[ExType.COMPOUND]}
          </Chip>
          <Chip
            active={filters.types.includes(ExType.ISOLATION)}
            onClick={() => toggleType(ExType.ISOLATION)}
            testId="filter-type-isolation"
          >
            {EXTYPE_LABEL_FR[ExType.ISOLATION]}
          </Chip>
          <Chip
            active={filters.lengthenedBiasOnly}
            onClick={toggleLengthened}
            testId="filter-lengthened-bias"
          >
            Étirement uniquement
          </Chip>
        </Section>

        <Section title="Pattern moteur">
          {FILTER_PATTERNS.map((p) => (
            <Chip
              key={p}
              active={filters.patterns.includes(p)}
              onClick={() => togglePattern(p)}
              testId={`filter-pattern-${p}`}
            >
              {PATTERN_LABEL_FR[p]}
            </Chip>
          ))}
        </Section>

        <Section title="Équipement">
          {FILTER_CHARGES.map((c) => (
            <Chip
              key={c}
              active={filters.charges.includes(c)}
              onClick={() => toggleCharge(c)}
              testId={`filter-charge-${c}`}
            >
              {CHARGE_LABEL_FR[c]}
            </Chip>
          ))}
        </Section>

        <Section title="Muscle principal">
          {MUSCLES.map((m) => (
            <Chip
              key={m}
              active={filters.muscles.includes(m)}
              onClick={() => toggleMuscle(m)}
              testId={`filter-muscle-${m}`}
            >
              {muscleLabel(m)}
            </Chip>
          ))}
        </Section>

        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, text: filters.text })}
            className="rounded-lg border border-anthracite-700 px-3 py-1.5 text-sm text-anthracite-300 hover:text-white"
            data-testid="filter-reset"
          >
            Tout effacer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sang-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-sang-800"
            data-testid="filter-apply"
          >
            Voir les résultats
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs uppercase tracking-wide text-anthracite-300">{title}</h4>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  testId,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly testId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition',
        active
          ? 'border-sang-700 bg-sang-900/40 text-white'
          : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
