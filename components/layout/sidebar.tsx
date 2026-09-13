'use client';

import React, { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Lightbulb, FileText, Layers, Mic2,
  FolderOpen, Settings, ChevronDown, ChevronLeft,
  ChevronRight, Sparkles, Search, BookOpen, Film,
  Palette, List, History,
} from 'lucide-react';

/* ─── Sidebar context ─────────────────────────────────────────────────────── */
interface SidebarCtx { collapsed: boolean; toggle: () => void; }
export const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

/* ─── Types ───────────────────────────────────────────────────────────────── */
type SubItem = { label: string; href: string; icon: React.ReactNode };
type NavSection = {
  id: string; label: string; icon: React.ReactNode;
  href?: string; children?: SubItem[];
};

const NAV: NavSection[] = [
  { id: 'dash',     label: 'Dashboard',      href: '/dashboard',         icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'research', label: 'YouTube Research', href: '/research',        icon: <Search className="w-4 h-4" /> },
  {
    id: 'ideas', label: 'Ideas & Research', icon: <Lightbulb className="w-4 h-4" />,
    children: [
      { label: 'Niche Intelligence', href: '/ideas/research',  icon: <Search    className="w-3.5 h-3.5" /> },
      { label: 'Ideas Generator',    href: '/ideas',           icon: <Lightbulb className="w-3.5 h-3.5" /> },
      { label: 'Title Generator',    href: '/ideas/titles',    icon: <FileText  className="w-3.5 h-3.5" /> },
    ],
  },
  {
    id: 'scripts',  label: 'Script Studio',   icon: <FileText className="w-4 h-4" />,
    children: [
      { label: 'Generator',      href: '/scripts/generator', icon: <Sparkles className="w-3.5 h-3.5" /> },
      { label: 'My Scripts',     href: '/scripts/projects',  icon: <BookOpen className="w-3.5 h-3.5" /> },
      { label: 'Script History', href: '/scripts/history',   icon: <History  className="w-3.5 h-3.5" /> },
      { label: 'Templates',      href: '/scripts/templates', icon: <FileText className="w-3.5 h-3.5" /> },
    ],
  },
  {
    id: 'visuals',  label: 'Visual Studio',   icon: <Layers className="w-4 h-4" />,
    children: [
      { label: 'Visual Prompts',   href: '/visuals/prompts',   icon: <Film    className="w-3.5 h-3.5" /> },
      { label: 'Prompts History',  href: '/visuals/history',   icon: <History className="w-3.5 h-3.5" /> },
      { label: 'Visual Styles',    href: '/visuals/styles',    icon: <Palette className="w-3.5 h-3.5" /> },
      { label: 'Line Breakdown',   href: '/visuals/breakdown', icon: <List    className="w-3.5 h-3.5" /> },
    ],
  },
  {
    id: 'voice',    label: 'Voice Studio',    icon: <Mic2 className="w-4 h-4" />,
    children: [
      { label: 'Generator',    href: '/voice',         icon: <Mic2    className="w-3.5 h-3.5" /> },
      { label: 'History',      href: '/voice/history', icon: <History className="w-3.5 h-3.5" /> },
    ],
  },
  { id: 'projects', label: 'Projects',  href: '/projects', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings',  href: '/settings', icon: <Settings   className="w-4 h-4" /> },
];

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function isChildActive(pathname: string, children?: SubItem[]) {
  return (children ?? []).some(c => pathname.startsWith(c.href));
}

/* ─── Nav item ────────────────────────────────────────────────────────────── */
function NavItem({ section, collapsed }: { section: NavSection; collapsed: boolean }) {
  const pathname = usePathname();
  const active   = section.href ? pathname === section.href : isChildActive(pathname, section.children);
  const [open, setOpen] = useState(() => isChildActive(pathname, section.children));

  if (section.href) {
    return (
      <Link href={section.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group relative',
          active
            ? 'bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]',
        )}
      >
        {active && (
          <motion.div layoutId="nav-pill"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[hsl(var(--primary))]"
          />
        )}
        <span className="shrink-0">{section.icon}</span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="truncate overflow-hidden whitespace-nowrap"
            >
              {section.label}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    );
  }

  return (
    <div>
      <button onClick={() => !collapsed && setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative',
          active
            ? 'text-[hsl(var(--primary))] bg-[hsl(var(--primary))/8]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]',
        )}
      >
        <span className="shrink-0">{section.icon}</span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex items-center justify-between overflow-hidden whitespace-nowrap"
            >
              <span className="truncate">{section.label}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence initial={false}>
        {open && !collapsed && section.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-0.5 border-l border-[hsl(var(--border))] pl-3 space-y-0.5 pb-1">
              {section.children.map(child => {
                const ca = pathname.startsWith(child.href);
                return (
                  <Link key={child.href} href={child.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors',
                      ca
                        ? 'bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))] font-semibold'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    {child.icon}
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed(v => !v) }}>
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col h-screen shrink-0 overflow-hidden"
        style={{ background: 'hsl(var(--sidebar-bg))', borderRight: '1px solid hsl(var(--border))' }}
      >
        {/* Logo row */}
        <div className="flex items-center h-14 px-3 border-b border-[hsl(var(--border))] gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: 'hsl(var(--primary))' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <div className="text-sm font-bold text-[hsl(var(--foreground))]">ContentStudio</div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">AI Creator Suite</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
          {NAV.map(section => (
            <NavItem key={section.id} section={section} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-[hsl(var(--border))] overflow-hidden">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 text-[10px] text-[hsl(var(--muted-foreground))]"
              >
                OpenRouter · Edge TTS · Free
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-hover))] transition-colors shadow-md"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>
    </SidebarContext.Provider>
  );
}
