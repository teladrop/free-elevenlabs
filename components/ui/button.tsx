import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 active:scale-[.97]';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-[hsl(var(--primary))] text-white shadow-sm hover:bg-[hsl(var(--primary))/90] ring-offset-[hsl(var(--background))]',
  ghost:
    'bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]',
  outline:
    'border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-hover))]',
  destructive:
    'bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive))/90]',
  secondary:
    'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--surface-hover))]',
  link:
    'text-[hsl(var(--primary))] underline-offset-4 hover:underline bg-transparent p-0 h-auto',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2',
  sm:      'h-7 px-3 text-xs rounded-md',
  lg:      'h-11 px-6 text-base',
  icon:    'h-9 w-9 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
