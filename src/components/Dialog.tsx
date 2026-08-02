import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

/**
 * Troisième voie optionnelle (chantier F-2). Un dialogue à deux boutons se lit
 * d'un coup d'œil sur une ligne ; à trois, la ligne devient illisible sur
 * mobile → on bascule en pile verticale, de la voie la plus attendue à la
 * moins attendue. Sans cette prop, le rendu historique ne bouge pas d'un pixel.
 */
interface DialogExtraAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly destructive?: boolean;
  readonly testId?: string;
}

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly extraAction?: DialogExtraAction;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  extraAction,
  onConfirm,
  onCancel,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-anthracite-700 bg-anthracite-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description && (
          <div className="mt-2 text-sm leading-relaxed text-anthracite-300">{description}</div>
        )}
        {extraAction === undefined ? (
          <div className="mt-5 flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={onCancel}
              data-testid="dialog-cancel"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              fullWidth
              onClick={onConfirm}
              data-testid="dialog-confirm"
            >
              {confirmLabel}
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <Button
              variant={destructive ? 'danger' : 'primary'}
              fullWidth
              onClick={onConfirm}
              data-testid="dialog-confirm"
            >
              {confirmLabel}
            </Button>
            <Button
              variant={extraAction.destructive === true ? 'danger' : 'secondary'}
              fullWidth
              onClick={extraAction.onClick}
              data-testid={extraAction.testId ?? 'dialog-extra'}
            >
              {extraAction.label}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={onCancel}
              data-testid="dialog-cancel"
            >
              {cancelLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
