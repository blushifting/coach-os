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
        'bg-anthracite-800 border border-anthracite-700 rounded-2xl',
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
