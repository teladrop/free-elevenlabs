'use client';

/**
 * /auth/complete
 *
 * Client-side OAuth completion page.
 *
 * Supabase redirects here after Google sign-in with tokens in the URL
 * fragment (#access_token=...). Because this is a client page (not a server
 * route), the fragment is preserved. The Supabase JS client has
 * detectSessionInUrl: true which automatically parses the fragment and
 * persists the session to localStorage/cookies.
 *
 * We simply wait for the SIGNED_IN auth event then navigate to /my-channel.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getAuthClientInstance } from '@/lib/db/auth-client';

function AuthCompleteInner() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) {
      setError('Auth not configured — check Supabase env vars.');
      return;
    }

    // Give Supabase's detectSessionInUrl up to 8 seconds to process the fragment
    const timeout = setTimeout(() => {
      // Check if session already exists before declaring failure
      client.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.replace('/my-channel');
        } else {
          setError('Sign-in timed out. Please try again.');
        }
      });
    }, 8000);

    // Listen for the SIGNED_IN event — fires as soon as Supabase parses the fragment
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        // Small delay to ensure session is written to storage before navigation
        setTimeout(() => router.replace('/my-channel'), 100);
      }
      if (event === 'SIGNED_OUT') {
        clearTimeout(timeout);
        subscription.unsubscribe();
        setError('Sign-in failed. Please try again.');
      }
    });

    // Also check if already signed in right now (e.g. page refresh)
    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        router.replace('/my-channel');
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6"
        style={{ background: 'hsl(220 13% 5%)' }}>
        <p className="text-sm font-semibold text-red-400">Sign-in failed</p>
        <p className="text-xs text-gray-400 max-w-xs">{error}</p>
        <a href="/my-channel"
          className="text-xs text-blue-400 hover:underline mt-2">
          ← Try again
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3"
      style={{ background: 'hsl(220 13% 5%)' }}>
      <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
      <p className="text-sm text-gray-400">Completing sign-in…</p>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: 'hsl(220 13% 5%)' }}>
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
      </div>
    }>
      <AuthCompleteInner />
    </Suspense>
  );
}
