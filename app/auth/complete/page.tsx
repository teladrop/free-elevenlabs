'use client';

/**
 * /auth/complete
 *
 * Client-side OAuth completion page.
 *
 * When Supabase uses the implicit flow, it redirects to the callback URL with
 * tokens in the URL fragment (#access_token=...). Fragments are never sent to
 * the server, so the API route can't read them. This page runs client-side,
 * reads the fragment, and calls supabase.auth.setSession() to establish the
 * session, then redirects to the intended destination.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getAuthClientInstance } from '@/lib/db/auth-client';

function AuthCompleteInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get('next') ?? '/my-channel';
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function complete() {
      const client = getAuthClientInstance();
      if (!client) {
        setErrorMsg('Auth not configured');
        setStatus('error');
        return;
      }

      // Parse the URL fragment
      const hash   = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);

      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        // No tokens in fragment — maybe already signed in, just redirect
        const { data } = await client.auth.getSession();
        if (data.session) {
          router.replace(next);
          return;
        }
        setErrorMsg('No session tokens found. Please try signing in again.');
        setStatus('error');
        return;
      }

      // Set the session from the tokens in the fragment
      const { error } = await client.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken ?? '',
      });

      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        return;
      }

      // Success — clear the fragment and navigate
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      router.replace(next);
    }

    complete();
  }, [next, router]);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <p className="text-sm font-semibold text-red-400">Sign-in failed</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">{errorMsg}</p>
        <a href="/my-channel"
          className="text-xs text-[hsl(var(--primary))] hover:underline">
          ← Back to My Channel
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Completing sign-in…</p>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
      </div>
    }>
      <AuthCompleteInner />
    </Suspense>
  );
}
