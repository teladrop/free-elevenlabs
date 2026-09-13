import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:     'bg-[hsl(var(--primary))/15] text-[hsl(var(--primary))] border-transparent',
  secondary:   'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border-transparent',
  success:     'bg-emerald-500/15 text-emerald-400 border-transparent',
  warning:     'bg-amber-500/15 text-amber-400 border-transparent',
  destructive: 'bg-red-500/15 text-red-400 border-transparent',
  outline:     'border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] bg-transparent',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
