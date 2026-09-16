'use client';

/**
 * /auth/complete
 *
 * Client-side OAuth completion page.
 * Supabase redirects here after Google sign-in with tokens in the URL
 * fragment (#access_token=...). detectSessionInUrl:true auto-parses it.
 *
 * After sign-in, redirects to:
 *   1. ?redirect=<path> query param (set by middleware / landing page)
 *   2. /dashboard (default)
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getAuthClientInstance } from '@/lib/db/auth-client';

function AuthCompleteInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) { setError('Auth not configured — check Supabase env vars.'); return; }

    // Where to go after successful sign-in
    const destination = searchParams.get('redirect') ?? '/dashboard';

    const navigate = () => router.replace(destination);

    // Timeout fallback — if SIGNED_IN event never fires, check session manually
    const timeout = setTimeout(() => {
      client.auth.getSession().then(({ data }) => {
        if (data.session) navigate();
        else setError('Sign-in timed out. Please try again.');
      });
    }, 8000);

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        setTimeout(navigate, 100); // small delay so session writes to storage
      }
      if (event === 'SIGNED_OUT') {
        clearTimeout(timeout);
        subscription.unsubscribe();
        setError('Sign-in failed. Please try again.');
      }
    });

    // Check if already signed in (e.g. page refresh)
    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        navigate();
      }
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6 bg-[hsl(var(--background))]">
        <p className="text-sm font-semibold text-red-400">Sign-in failed</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">{error}</p>
        <a href="/" className="text-xs text-[hsl(var(--primary))] hover:underline mt-2">← Back to home</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-[hsl(var(--background))]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Completing sign-in…</p>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[hsl(var(--background))]">
        <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
      </div>
    }>
      <AuthCompleteInner />
    </Suspense>
  );
}
