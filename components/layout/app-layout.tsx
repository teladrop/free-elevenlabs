'use client';

import { Sidebar, MobileNav } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Desktop: sidebar + scrollable main */}
      <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
        <Sidebar />
        {/*
          pb-16 on mobile so content clears the fixed bottom nav (h ≈ 56px + safe-area).
          md:pb-0 removes it on desktop.
        */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile: hamburger + drawer + bottom nav */}
      <MobileNav />
    </>
  );
}
