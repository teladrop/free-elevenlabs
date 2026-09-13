import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <header className={cn('flex items-center justify-between border-b border-[hsl(var(--border))] px-8 py-5 shrink-0', className)}>
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{title}</h1>
        {description && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}
