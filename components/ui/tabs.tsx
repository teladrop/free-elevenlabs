'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  onChange: (v: string) => void;
}
const TabsCtx = React.createContext<TabsContextValue>({ value: '', onChange: () => {} });

export function Tabs({ value, onValueChange, defaultValue, className, children, ...props }: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [inner, setInner] = React.useState(defaultValue ?? '');
  const controlled = value !== undefined;
  const current = controlled ? value! : inner;
  const onChange = (v: string) => { if (!controlled) setInner(v); onValueChange?.(v); };
  return (
    <TabsCtx.Provider value={{ value: current, onChange }}>
      <div className={cn('w-full', className)} {...props}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('inline-flex h-9 items-center rounded-lg bg-[hsl(var(--muted))] p-1 gap-0.5', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className, children, ...props }: { value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { value: current, onChange } = React.useContext(TabsCtx);
  const active = current === value;
  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
          : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children, ...props }: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const { value: current } = React.useContext(TabsCtx);
  if (current !== value) return null;
  return <div className={cn('mt-4', className)} {...props}>{children}</div>;
}
