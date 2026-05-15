import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly padded?: boolean;
}

export function Card({ className, children, padded = true, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-anthracite-700 bg-anthracite-800 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
