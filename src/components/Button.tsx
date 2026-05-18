import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly fullWidth?: boolean;
  readonly children: ReactNode;
}

// Conv #11c — variantes refondues : primary gagne un halo rouge diffus au
// hover/focus (shadow-glow-sang), un gradient top→bottom subtil pour le relief
// "métal", et un underglow permanent discret. Secondary récupère un léger
// gradient + ring pour le détacher du fond.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-sang-600 to-sang-800 text-white hover:from-sang-500 hover:to-sang-700 hover:shadow-glow-sang focus-visible:shadow-glow-sang active:from-sang-700 active:to-sang-900 disabled:bg-anthracite-700 disabled:from-anthracite-700 disabled:to-anthracite-800 disabled:text-anthracite-300 ring-1 ring-sang-400/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_2px_8px_-2px_rgba(122,26,37,0.4)] disabled:ring-anthracite-600/40 disabled:shadow-none',
  secondary:
    'bg-gradient-to-b from-anthracite-700 to-anthracite-800 text-white hover:from-anthracite-600 hover:to-anthracite-700 active:from-anthracite-800 active:to-anthracite-900 border border-anthracite-500/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_1px_2px_0_rgba(0,0,0,0.4)] disabled:opacity-50',
  ghost:
    'bg-transparent text-anthracite-300 hover:text-white hover:bg-anthracite-800/60 disabled:opacity-50',
  danger:
    'bg-gradient-to-b from-sang-700 to-sang-900 text-white hover:from-sang-600 hover:to-sang-800 hover:shadow-glow-sang active:from-sang-800 active:to-sang-950 ring-1 ring-sang-500/40 disabled:opacity-50',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-base rounded-xl',
  lg: 'h-14 px-6 text-lg rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // Conv #11c — transition étendue (200ms) pour rendre le halo sang
        // souple au hover/focus. Outline customisé sang au focus-visible.
        // Conv #11f — `min-w-0 max-w-full` pour que le bouton puisse se
        // rétrécir dans un flex parent contraint au lieu de déborder. Texte
        // peut wrapper si nécessaire (mieux que sortir du cadre).
        'inline-flex min-w-0 max-w-full items-center justify-center gap-1.5 text-center font-medium leading-tight transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sang-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
