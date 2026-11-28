/**
 * Champ « Notes sur l'exercice » des fiches (catalogue et
 * bouton « i » de la séance). Une seule note par exercice, enregistrée quand le
 * champ perd le focus ou quand la fiche se ferme. Désactivé en démo.
 */

import { useEffect, useRef, useState } from 'react';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';

export function ExerciseNoteField({ exerciseId }: { readonly exerciseId: string }) {
  const engine = useEngine();
  const demoActive = useDemoMode();
  const saved = useCoachOsStore((s) => s.userState?.exercise_notes[exerciseId] ?? '');
  const [draft, setDraft] = useState(saved);
  // Vierge et hors saisie : une seule ligne, pour ne pas allonger la fiche.
  const [saisie, setSaisie] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(saved);
  }, [saved, exerciseId]);

  // Fiche fermée pendant la saisie : le blur ne part pas toujours, on enregistre
  // au démontage si le texte a changé.
  useEffect(
    () => () => {
      if (demoActive) return;
      const current = useCoachOsStore.getState().userState?.exercise_notes[exerciseId] ?? '';
      if (draftRef.current.trim() !== current) {
        void engine.setExerciseNote(exerciseId, draftRef.current);
      }
    },
    [engine, exerciseId, demoActive],
  );

  function commit() {
    if (demoActive || draft.trim() === saved) return;
    void engine.setExerciseNote(exerciseId, draft);
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
        Notes sur l'exercice
      </span>
      <textarea
        data-testid={`exercise-note-${exerciseId}`}
        value={draft}
        disabled={demoActive}
        rows={saisie || draft.trim() !== '' ? 3 : 1}
        maxLength={500}
        placeholder="Réglages de la machine, placement, consignes…"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setSaisie(true)}
        onBlur={() => {
          setSaisie(false);
          commit();
        }}
        className="w-full resize-none rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-1.5 text-sm leading-relaxed text-white outline-none placeholder:text-anthracite-500 focus:border-sang-700/60 disabled:opacity-60"
      />
    </label>
  );
}
