/**
 * JETABLE : vérifie la cohérence pattern ⟺ type dans le catalogue.
 * Un pattern compound (push/pull/squat/hinge/lunge) implique-t-il TOUJOURS
 * type=COMPOUND ? Sinon, le filtre par pattern de `candidatesForCell` ne
 * garantit PAS qu'un slot compound reçoive un compound.
 *   npx tsx --tsconfig tsconfig.app.json scripts/inspect-coherence.mts
 */
import { Catalog } from '../src/engine/catalog';
import { ExType } from '../src/engine/models';
import { isCompoundPattern } from '../src/engine/pattern_grid';

const catalog = new Catalog();
const all = catalog.all();

const mismatches = all.filter(
  (ex) => isCompoundPattern(ex.pattern) !== (ex.type === ExType.COMPOUND),
);

console.log(`\nCatalogue : ${all.length} exos.`);
console.log(`Incohérences pattern↔type : ${mismatches.length}\n`);
for (const ex of mismatches) {
  console.log(
    `  ${ex.id.padEnd(28)} pattern=${ex.pattern.padEnd(10)} type=${ex.type}` +
      `  (${isCompoundPattern(ex.pattern) ? 'pattern compound mais type ISO' : 'pattern iso mais type COMPOUND'})`,
  );
}

// Détail utile : par pattern compound, combien d'exos ISO s'y cachent ?
console.log('\nRépartition type par pattern compound :');
const compoundPatterns = [...new Set(all.map((e) => e.pattern))].filter((p) =>
  isCompoundPattern(p),
);
for (const p of compoundPatterns) {
  const list = all.filter((e) => e.pattern === p);
  const iso = list.filter((e) => e.type === ExType.ISOLATION);
  console.log(`  ${p.padEnd(10)} : ${list.length} exos, dont ${iso.length} type ISO${iso.length ? ' → ' + iso.map((e) => e.id).join(', ') : ''}`);
}
