'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Lightbulb, FileText, Layers, Mic2,
  FolderOpen, Settings, ChevronDown, Sparkles, Search,
  BookOpen, Film, Palette, List, History, PanelLeftClose,
  PanelLeftOpen, X, Menu,
} from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────

interface SidebarCtx { collapsed: boolean; toggle: () => void }
export const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

// ─── Nav structure ────────────────────────────────────────────────────────────

type SubItem   = { label: string; href: string; icon: React.ReactNode };
type NavSection = {
  id: string; label: string; icon: React.ReactNode;
  href?: string; children?: SubItem[];
  group?: string;   // section group heading shown in expanded mode
};

const NAV: NavSection[] = [
  // ── General ────────────────────────────────────────────────────────────────
  {
    id: 'dash', label: 'Dashboard', href: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />, group: 'General',
  },
  {
    id: 'research', label: 'YouTube Research', href: '/research',
    icon: <Search className="w-4 h-4" />,
  },
  // ── Tools ──────────────────────────────────────────────────────────────────
  {
    id: 'scripts', label: 'Script Studio',
    icon: <FileText className="w-4 h-4" />, group: 'Tools',
    children: [
      { label: 'Generator',      href: '/scripts/generator', icon: <Sparkles className="w-3.5 h-3.5" /> },
      { label: 'My Scripts',     href: '/scripts/projects',  icon: <BookOpen className="w-3.5 h-3.5" /> },
      { label: 'Script History', href: '/scripts/history',   icon: <History  className="w-3.5 h-3.5" /> },
      { label: 'Templates',      href: '/scripts/templates', icon: <FileText className="w-3.5 h-3.5" /> },
    ],
  },
  {
    id: 'visuals', label: 'Visual Studio',
    icon: <Layers className="w-4 h-4" />,
    children: [
      { label: 'Visual Prompts',  href: '/visuals/prompts',   icon: <Film    className="w-3.5 h-3.5" /> },
      { label: 'Prompts History', href: '/visuals/history',   icon: <History className="w-3.5 h-3.5" /> },
      { label: 'Visual Styles',   href: '/visuals/styles',    icon: <Palette className="w-3.5 h-3.5" /> },
      { label: 'Line Breakdown',  href: '/visuals/breakdown', icon: <List    className="w-3.5 h-3.5" /> },
    ],
  },
  {
    id: 'voice', label: 'Voice Studio',
    icon: <Mic2 className="w-4 h-4" />,
    children: [
      { label: 'Generator', href: '/voice',         icon: <Mic2    className="w-3.5 h-3.5" /> },
      { label: 'History',   href: '/voice/history', icon: <History className="w-3.5 h-3.5" /> },
    ],
  },
  {
    id: 'projects', label: 'Projects', href: '/projects',
    icon: <FolderOpen className="w-4 h-4" />,
  },
  {
    id: 'settings', label: 'Settings', href: '/settings',
    icon: <Settings className="w-4 h-4" />,
  },
];

// ─── Mobile bottom nav items (top-level only) ─────────────────────────────────

const MOBILE_NAV = [
  { id: 'dash',     label: 'Home',     href: '/dashboard',         icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'research', label: 'Research', href: '/research',          icon: <Search          className="w-5 h-5" /> },
  { id: 'ideas',    label: 'Ideas',    href: '/research',          icon: <Lightbulb       className="w-5 h-5" /> },
  { id: 'scripts',  label: 'Scripts',  href: '/scripts/generator', icon: <FileText        className="w-5 h-5" /> },
  { id: 'voice',    label: 'Voice',    href: '/voice',             icon: <Mic2            className="w-5 h-5" /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isChildActive(pathname: string, children?: SubItem[]) {
  return (children ?? []).some(c => pathname.startsWith(c.href));
}

function allChildHrefs(children?: SubItem[]): string[] {
  return (children ?? []).map(c => c.href);
}

// ─── Collapsed icon-rail item tooltip ────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip flex items-center">
      {children}
      <div className="
        pointer-events-none absolute left-full ml-3 z-50
        px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
        bg-[hsl(220,18%,18%)] text-[hsl(210,20%,92%)] border border-[hsl(220,13%,22%)]
        shadow-xl opacity-0 group-hover/tip:opacity-100
        translate-x-1 group-hover/tip:translate-x-0
        transition-all duration-150
      ">
        {label}
      </div>
    </div>
  );
}

// ─── Single nav item (expanded) ───────────────────────────────────────────────

function NavItemExpanded({
  section, onNavigate,
}: {
  section: NavSection;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active   = section.href
    ? pathname === section.href || pathname.startsWith(section.href + '/')
    : isChildActive(pathname, section.children);

  const [open, setOpen] = useState(() => isChildActive(pathname, section.children));

  // Auto-open if a child becomes active (e.g. on first render after navigation)
  useEffect(() => {
    if (isChildActive(pathname, section.children)) setOpen(true);
  }, [pathname, section.children]);

  if (section.href) {
    return (
      <Link
        href={section.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 relative group',
          active
            ? 'bg-[hsl(225,70%,58%)] text-white shadow-lg shadow-[hsl(225,70%,58%,0.25)]'
            : 'text-[hsl(215,15%,55%)] hover:bg-[hsl(220,13%,14%)] hover:text-[hsl(210,20%,88%)]',
        )}
      >
        <span className="shrink-0">{section.icon}</span>
        <span className="truncate flex-1">{section.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
          active
            ? 'text-[hsl(225,80%,70%)] bg-[hsl(225,50%,15%)]'
            : 'text-[hsl(215,15%,55%)] hover:bg-[hsl(220,13%,14%)] hover:text-[hsl(210,20%,88%)]',
        )}
      >
        <span className="shrink-0">{section.icon}</span>
        <span className="truncate flex-1 text-left">{section.label}</span>
        <ChevronDown className={cn(
          'w-3.5 h-3.5 shrink-0 transition-transform duration-200 opacity-60',
          open && 'rotate-180',
        )} />
      </button>

      <AnimatePresence initial={false}>
        {open && section.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 ml-3 space-y-0.5 pb-1">
              {section.children.map(child => {
                const ca = pathname.startsWith(child.href);
                return (
                  <Link key={child.href} href={child.href} onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] transition-all duration-150',
                      ca
                        ? 'bg-[hsl(225,70%,58%,0.18)] text-[hsl(225,80%,72%)] font-semibold'
                        : 'text-[hsl(215,12%,48%)] hover:bg-[hsl(220,13%,14%)] hover:text-[hsl(210,20%,82%)]',
                    )}
                  >
                    <span className="shrink-0 opacity-80">{child.icon}</span>
                    <span className="truncate">{child.label}</span>
                    {ca && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[hsl(225,70%,65%)] shrink-0" />
                    )}
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

// ─── Single nav item (collapsed icon rail) ────────────────────────────────────

function NavItemCollapsed({ section }: { section: NavSection }) {
  const pathname = usePathname();
  const active   = section.href
    ? pathname === section.href || pathname.startsWith(section.href + '/')
    : isChildActive(pathname, section.children);

  const href = section.href ?? allChildHrefs(section.children)[0] ?? '#';

  return (
    <Tooltip label={section.label}>
      <Link
        href={href}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150',
          active
            ? 'bg-[hsl(225,70%,58%)] text-white shadow-lg shadow-[hsl(225,70%,58%,0.3)]'
            : 'text-[hsl(215,15%,48%)] hover:bg-[hsl(220,13%,16%)] hover:text-[hsl(210,20%,88%)]',
        )}
      >
        {section.icon}
      </Link>
    </Tooltip>
  );
}

// ─── Section group label ──────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-semibold tracking-widest uppercase text-[hsl(215,12%,38%)]">
        {label}
      </span>
    </div>
  );
}

// ─── Expanded sidebar panel ───────────────────────────────────────────────────

function ExpandedSidebar({
  onCollapse, onNavigate,
}: {
  onCollapse: () => void;
  onNavigate?: () => void;
}) {
  // Render nav sections with group headings
  const rendered: React.ReactNode[] = [];
  let lastGroup: string | undefined = undefined;

  for (const section of NAV) {
    if (section.group && section.group !== lastGroup) {
      rendered.push(<GroupLabel key={`grp-${section.group}`} label={section.group} />);
      lastGroup = section.group;
    }
    rendered.push(
      <NavItemExpanded key={section.id} section={section} onNavigate={onNavigate} />,
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[hsl(220,13%,13%)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[hsl(225,70%,58%)] flex items-center justify-center shadow-lg shadow-[hsl(225,70%,58%,0.35)] shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[13px] font-bold text-[hsl(210,20%,92%)] leading-tight">ContentStudio</div>
            <div className="text-[10px] text-[hsl(215,12%,42%)] leading-tight">AI Creator Suite</div>
          </div>
        </div>
        <button
          onClick={onCollapse}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(215,12%,42%)] hover:bg-[hsl(220,13%,16%)] hover:text-[hsl(210,20%,88%)] transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
        {rendered}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[hsl(220,13%,13%)] shrink-0">
        <p className="text-[10px] text-[hsl(215,12%,35%)]">
          OpenRouter · Edge TTS · Free tier
        </p>
      </div>
    </div>
  );
}

// ─── Collapsed icon rail ──────────────────────────────────────────────────────

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex flex-col h-full items-center">
      {/* Logo */}
      <div className="h-14 flex items-center justify-center border-b border-[hsl(220,13%,13%)] w-full shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[hsl(225,70%,58%)] flex items-center justify-center shadow-lg shadow-[hsl(225,70%,58%,0.35)]">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Expand button */}
      <div className="w-full flex justify-center py-2 border-b border-[hsl(220,13%,13%)]">
        <Tooltip label="Expand sidebar">
          <button
            onClick={onExpand}
            className="w-10 h-8 rounded-lg flex items-center justify-center text-[hsl(215,15%,42%)] hover:bg-[hsl(220,13%,16%)] hover:text-[hsl(210,20%,88%)] transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-center gap-1 px-2 py-3 overflow-y-auto overflow-x-hidden w-full">
        {NAV.map(section => (
          <NavItemCollapsed key={section.id} section={section} />
        ))}
      </nav>
    </div>
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed(v => !v) }}>
      {/* Desktop only — hidden on mobile */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 248 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex relative flex-col h-screen shrink-0 overflow-hidden"
        style={{
          background:   'hsl(220, 16%, 8%)',
          borderRight:  '1px solid hsl(220, 13%, 12%)',
        }}
      >
        <AnimatePresence initial={false} mode="wait">
          {collapsed ? (
            <motion.div
              key="rail"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <CollapsedRail onExpand={() => setCollapsed(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <ExpandedSidebar onCollapse={() => setCollapsed(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </SidebarContext.Provider>
  );
}

// ─── Mobile drawer + bottom nav ───────────────────────────────────────────────

export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  return (
    <>
      {/* Floating hamburger — top-left, only on mobile */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-9 h-9 rounded-xl bg-[hsl(220,16%,10%)] border border-[hsl(220,13%,16%)] flex items-center justify-center text-[hsl(215,15%,55%)] hover:text-[hsl(210,20%,88%)] shadow-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-4.5 h-4.5" />
      </button>

      {/* Drawer backdrop */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer panel */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col overflow-hidden"
            style={{ background: 'hsl(220, 16%, 8%)', borderRight: '1px solid hsl(220, 13%, 12%)' }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-[hsl(220,13%,13%)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[hsl(225,70%,58%)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[hsl(210,20%,92%)]">ContentStudio</div>
                  <div className="text-[10px] text-[hsl(215,12%,42%)]">AI Creator Suite</div>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(215,12%,42%)] hover:bg-[hsl(220,13%,16%)] hover:text-[hsl(210,20%,88%)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer nav */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <ExpandedSidebar
                onCollapse={() => setDrawerOpen(false)}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom navigation bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
        style={{
          background:  'hsl(220, 16%, 7%)',
          borderTop:   '1px solid hsl(220, 13%, 13%)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {MOBILE_NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                active
                  ? 'text-[hsl(225,80%,70%)]'
                  : 'text-[hsl(215,12%,40%)] hover:text-[hsl(215,12%,60%)]',
              )}
            >
              <span className={cn(
                'flex items-center justify-center w-8 h-6 rounded-lg transition-all',
                active && 'bg-[hsl(225,70%,58%,0.2)]',
              )}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
