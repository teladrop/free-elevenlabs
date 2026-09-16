'use client';

import { useEffect, useState } from 'react';
import { Sidebar, MobileNav } from './sidebar';
import { getAuthClientInstance } from '@/lib/db/auth-client';

/**
 * AppLayout — wraps every authenticated app page.
 *
 * Includes a client-side auth guard: if no Supabase session is found
 * in localStorage (where the browser client stores it), redirect to /
 * with the current path as ?redirect= so the user lands back here after sign-in.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const client = getAuthClientInstance();

    // If Supabase isn't configured just let through (dev / misconfiguration)
    if (!client) {
      setChecking(false);
      return;
    }

    client.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // No session — send to landing page, preserving the intended destination
        const dest = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/?redirect=${dest}`);
      } else {
        setChecking(false);
      }
    }).catch(() => {
      // On error, fail open so the app stays usable
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(var(--background))]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500/30 border-t-purple-500" />
      </div>
    );
  }

  return (
    <>
      {/* Desktop: sidebar + scrollable main */}
      <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile: hamburger + drawer + bottom nav */}
      <MobileNav />
    </>
  );
}
