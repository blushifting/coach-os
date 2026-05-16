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

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-sang-700 text-white hover:bg-sang-600 active:bg-sang-800 disabled:bg-anthracite-700 disabled:text-anthracite-300 ring-1 ring-sang-500/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_1px_2px_0_rgba(0,0,0,0.4)] disabled:ring-anthracite-600/40 disabled:shadow-none',
  secondary:
    'bg-anthracite-800 text-white hover:bg-anthracite-700 active:bg-anthracite-900 border border-anthracite-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] disabled:opacity-50',
  ghost:
    'bg-transparent text-anthracite-300 hover:text-white hover:bg-anthracite-800 disabled:opacity-50',
  danger:
    'bg-sang-800 text-white hover:bg-sang-700 active:bg-sang-900 ring-1 ring-sang-600/40 disabled:opacity-50',
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
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
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
