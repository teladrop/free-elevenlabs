'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useChannel, type ChannelConnection, type ChannelVideo, type ChannelSnapshot } from '@/app/providers/channel-provider';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  PlayCircle, RefreshCw, LogIn, LogOut, Link2, Link2Off,
  AlertCircle, Loader2, Users, Eye, Video, TrendingUp,
  BarChart2, Calendar, Clock, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { signInWithGoogle, signOut, getCurrentUser, getAuthClientInstance, type User } from '@/lib/db/auth-client';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { calculateChannelComparison, getPerformanceLabel, generateGrowthSuggestions } from '@/lib/my-channel/channel-analytics';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type VideoSort = 'view_count' | 'published_at';
type SyncStatus = 'connected' | 'syncing' | 'synced' | 'sync_failed' | 'needs_reauth' | 'disconnected';

// â”€â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Status values for the channel connection (using string type since ChannelConnection interface doesn't have status)

function StatusBadge({ status }: { status: SyncStatus }) {
  const cfg = {
    connected:    { label: 'Connected',         cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    syncing:      { label: 'Syncingâ€¦',          cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
    synced:       { label: 'Synced',            cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    sync_failed:  { label: 'Sync failed',       cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
    needs_reauth: { label: 'Needs reauth',      cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
    disconnected: { label: 'Disconnected',      cls: 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]' },
  }[status] ?? { label: status, cls: '' };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {status === 'syncing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {status === 'synced'  && <CheckCircle2 className="w-2.5 h-2.5" />}
      {cfg.label}
    </span>
  );
}

// â”€â”€â”€ Stat card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center gap-2 mb-3 text-[hsl(var(--muted-foreground))]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[hsl(var(--foreground))]">{value}</div>
      {sub && <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>}
    </div>
  );
}

// â”€â”€â”€ Main page content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MyChannelContent() {
  const searchParams = useSearchParams();
  const { connection, videos, snapshots, setConnection, setVideos, setSnapshots } = useChannel();

  const [user,       setUser]       = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [videoSort,  setVideoSort]  = useState<VideoSort>('view_count');
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // â”€â”€ Handle URL error/success params â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      const messages: Record<string, string> = {
        auth_failed:          'Sign-in failed. Please try again.',
        session_failed:       'Could not create session. Please try again.',
        not_authenticated:    'Please sign in before connecting YouTube.',
        youtube_not_configured: 'YouTube OAuth is not configured yet. See setup instructions.',
        cancelled:            'YouTube connection was cancelled.',
        oauth_error:          'OAuth error. Please try again.',
        state_mismatch:       'Security check failed. Please try again.',
        connect_failed:       `Connection failed: ${searchParams.get('msg') ?? 'unknown error'}`,
        config_error:         'App configuration error.',
      };
      setError(messages[err] ?? `Error: ${err}`);
    }
    if (searchParams.get('connected') === '1') {
      setSuccessMsg('YouTube channel connected! Syncing your dataâ€¦');
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }, [searchParams]);

  // â”€â”€ Load current user â€” use onAuthStateChange so session changes are caught â”€â”€
  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) {
      setUserLoading(false);
      return;
    }

    // First: read the session from local storage (no network round-trip)
    client.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
      }
      setUserLoading(false);
    });

    // Then subscribe so any auth change (sign-in, sign-out) updates the UI
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // â”€â”€ Load channel data when user is known â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setError('');
    try {
      // Get the current access token from the Supabase session
      const client = getAuthClientInstance();
      const { data: sessionData } = client
        ? await client.auth.getSession()
        : { data: { session: null } };
      const token = sessionData.session?.access_token ?? '';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/my-channel/data?sort=${videoSort}&limit=50`, { headers });
      if (!res.ok) {
        if (res.status === 401) { setUser(null); return; }
        throw new Error(`Failed to load channel data (${res.status})`);
      }
      const d = await res.json();
      setConnection(d.connection ?? null);
      setVideos(d.videos ?? []);
      setSnapshots(d.snapshots ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDataLoading(false);
    }
  }, [videoSort]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // â”€â”€ Auth token helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getToken = async (): Promise<string> => {
    const client = getAuthClientInstance();
    if (!client) return '';
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? '';
  };

  // â”€â”€ Sign in â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSignIn = async () => {
    setError('');
    const { error: e } = await signInWithGoogle();
    if (e) setError(e);
  };

  // â”€â”€ Sign out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setConnection(null);
    setVideos([]);
    setSnapshots([]);
  };

  // â”€â”€ Connect YouTube â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleConnect = async () => {
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        setError('Not signed in. Please sign in first.');
        return;
      }
      // Store token in a temporary cookie so the API route can read it
      document.cookie = `sb-temp-auth-token=${encodeURIComponent(token)}; path=/; max-age=60; SameSite=Lax`;
      // Give the cookie time to be set before navigating
      setTimeout(() => {
        window.location.href = '/api/my-channel/connect';
      }, 50);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // â”€â”€ Sync now â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/my-channel/sync', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error ?? 'Sync failed');
      setSuccessMsg(`Synced ${d.videosUpserted} videos`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  // â”€â”€ Disconnect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDisconnect = async () => {
    if (!confirm('Disconnect your YouTube channel? Your synced data will be preserved.')) return;
    setDisconnecting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/my-channel/disconnect', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setConnection(null);
        setVideos([]);
        setSnapshots([]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  // â”€â”€ Compute analytics from real stored data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalVideoViews = videos.reduce((s, v) => s + v.view_count, 0);
  const medianViews = (() => {
    if (!videos.length) return 0;
    const sorted = [...videos].map(v => v.view_count).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  })();
  const avgEngagement = (() => {
    if (!videos.length) return 0;
    const rates = videos
      .filter(v => v.view_count > 0)
      .map(v => ((v.like_count + v.comment_count) / v.view_count) * 100);
    if (!rates.length) return 0;
    return rates.reduce((s, r) => s + r, 0) / rates.length;
  })();
  const topVideo = videos.length
    ? [...videos].sort((a, b) => b.view_count - a.view_count)[0]
    : null;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  // â”€â”€ NOT SIGNED IN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
          <PlayCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))] mb-2">My Channel</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mb-8">
          Sign in with Google to connect your YouTube channel, sync your analytics,
          and track your content performance.
        </p>
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400 max-w-sm text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={handleSignIn}
          className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition-colors shadow-lg"
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-4 max-w-xs">
          Your channel data is private and only visible to you.
        </p>
      </div>
    );
  }

  // â”€â”€ SIGNED IN â€” NO CHANNEL CONNECTED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!connection) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        {/* User info strip */}
        <div className="flex items-center justify-between mb-10 px-1">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-bold">
              {(user.email ?? '?')[0].toUpperCase()}
            </div>
            {user.email}
          </div>
          <button onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
            <PlayCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-2">
            Connect Your YouTube Channel
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6 max-w-sm mx-auto">
            Authorize read-only access to your YouTube channel to sync your videos
            and analytics. No upload or management permissions are requested.
          </p>

          {/* What gets synced */}
          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            {[
              { icon: <Users className="w-3.5 h-3.5" />, label: 'Subscriber count' },
              { icon: <Eye className="w-3.5 h-3.5" />,   label: 'Total views' },
              { icon: <Video className="w-3.5 h-3.5" />, label: 'Your videos' },
              { icon: <BarChart2 className="w-3.5 h-3.5" />, label: 'Performance data' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="text-[hsl(var(--primary))]">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          {!process.env.NEXT_PUBLIC_SUPABASE_URL ? (
            <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
              YouTube OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
            >
              <Link2 className="w-4 h-4" /> Connect YouTube Channel
            </button>
          )}

          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-3">
            Read-only Â· No upload permission Â· Disconnect anytime
          </p>
        </div>
      </div>
    );
  }

  // â”€â”€ SIGNED IN + CHANNEL CONNECTED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="max-w-[1400px] mx-auto space-y-5">

      {/* Notifications */}
      {(error || successMsg) && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          error
            ? 'border-red-500/20 bg-red-500/8 text-red-400'
            : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400'
        }`}>
          {error
            ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          <p className="text-sm">{error || successMsg}</p>
          <button onClick={() => { setError(''); setSuccessMsg(''); }} className="ml-auto text-xs opacity-60 hover:opacity-100">âœ•</button>
        </div>
      )}

      {/* â”€â”€ Channel header card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Thumbnail */}
          <div className="shrink-0">
            {connection.thumbnail_url ? (
              <img src={connection.thumbnail_url} alt={connection.channel_title}
                className="w-16 h-16 rounded-full object-cover border-2 border-[hsl(var(--border))]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
                <PlayCircle className="w-7 h-7 text-red-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">
                {connection.channel_title}
              </h1>
              <StatusBadge status={connection.status} />
            </div>
            {connection.channel_handle && (
              <a
                href={`https://youtube.com/${connection.channel_handle}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] flex items-center gap-1"
              >
                {connection.channel_handle}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
              {connection.last_synced_at
                ? `Last synced ${timeAgo(connection.last_synced_at)}`
                : 'Never synced'}
              {' Â· '}
              Connected {timeAgo(connection.connected_at)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleSync}
              disabled={syncing || connection.status === 'syncing'}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncingâ€¦' : 'Sync now'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/25 bg-red-500/8 text-xs font-medium text-red-400 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
            >
              <Link2Off className="w-3.5 h-3.5" />
              Disconnect
            </button>
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        {connection.sync_error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Sync error: {connection.sync_error}
          </div>
        )}
      </div>

      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : (
        <>
          {/* â”€â”€ Stats grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Subscribers"
              value={formatNumber(connection.subscriber_count)}
            />
            <StatCard
              icon={<Eye className="w-4 h-4" />}
              label="Total channel views"
              value={formatNumber(connection.view_count)}
            />
            <StatCard
              icon={<Video className="w-4 h-4" />}
              label="Videos"
              value={formatNumber(connection.video_count)}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Median views/video"
              value={formatNumber(medianViews)}
              sub={`${videos.length} videos synced`}
            />
          </div>

          {/* â”€â”€ Computed metrics (from synced data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {videos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Avg engagement rate</p>
                <p className="text-xl font-bold text-[hsl(var(--foreground))]">
                  {avgEngagement.toFixed(2)}%
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">(likes + comments) Ã· views</p>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Total synced views</p>
                <p className="text-xl font-bold text-[hsl(var(--foreground))]">
                  {formatNumber(videos.reduce((sum, v) => sum + v.view_count, 0))}
                </p>
              </div>
            </div>
          )}

          {/* â”€â”€ Comparison section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {videos.length > 0 && (
            <ChannelComparisonSection connection={connection} videos={videos} snapshots={snapshots} />
          )}

          {/* â”€â”€ Growth suggestions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {videos.length > 0 && (
            <GrowthSuggestionsSection connection={connection} videos={videos} snapshots={snapshots} />
          )}

          {/* â”€â”€ Historical snapshots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {snapshots.length >= 2 ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-[hsl(var(--primary))]" />
                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  Channel trend
                  <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                    last {snapshots.length} snapshots
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                      <th className="pb-2 font-semibold">Date</th>
                      <th className="pb-2 font-semibold text-right">Subscribers</th>
                      <th className="pb-2 font-semibold text-right">Total views</th>
                      <th className="pb-2 font-semibold text-right">Videos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots].reverse().map(snap => (
                      <tr key={snap.snapshot_date} className="border-b border-[hsl(var(--border))/50] last:border-0">
                        <td className="py-2 text-[hsl(var(--muted-foreground))]">{snap.snapshot_date}</td>
                        <td className="py-2 text-right font-mono">{formatNumber(snap.subscriber_count)}</td>
                        <td className="py-2 text-right font-mono">{formatNumber(snap.view_count)}</td>
                        <td className="py-2 text-right font-mono">{snap.video_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : snapshots.length === 1 ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-5 py-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                <span className="font-semibold text-[hsl(var(--foreground))]">Trend data:</span>{' '}
                Only 1 snapshot recorded so far. Sync again tomorrow to start seeing trends.
              </p>
            </div>
          ) : null}

          {/* â”€â”€ Video list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {videos.length > 0 && (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    Your videos
                    <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                      ({videos.length})
                    </span>
                  </h2>
                </div>
                {/* Sort toggle */}
                <div className="flex items-center gap-1">
                  {(['view_count', 'published_at'] as VideoSort[]).map(s => (
                    <button key={s}
                      onClick={() => setVideoSort(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        videoSort === s
                          ? 'bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))] border-[hsl(var(--primary))/30]'
                          : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      {s === 'view_count' ? 'Most views' : 'Newest'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {videos.map((vid, i) => (
                  <a
                    key={vid.youtube_video_id}
                    href={`https://youtube.com/watch?v=${vid.youtube_video_id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2.5 hover:bg-[hsl(var(--surface-hover))] transition-colors group"
                  >
                    {/* Rank */}
                    <span className="shrink-0 w-5 text-center text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                      {i + 1}
                    </span>
                    {/* Thumbnail */}
                    {vid.thumbnail_url ? (
                      <img src={vid.thumbnail_url} alt=""
                        className="w-16 h-9 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-9 rounded bg-[hsl(var(--border))] shrink-0" />
                    )}
                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] line-clamp-1 transition-colors">
                        {vid.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                        {vid.published_at && (
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(vid.published_at).toLocaleDateString()}
                          </span>
                        )}
                        {vid.duration && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatIsoDuration(vid.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p className="text-xs font-bold text-[hsl(var(--foreground))]">{formatNumber(vid.view_count)}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">views</p>
                      </div>
                      {vid.like_count > 0 && (
                        <div className="hidden sm:block">
                          <p className="text-xs font-bold text-[hsl(var(--foreground))]">{formatNumber(vid.like_count)}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">likes</p>
                        </div>
                      )}
                      {/* Views vs median highlight */}
                      {medianViews > 0 && (
                        <div className="hidden md:block">
                          <p className={`text-xs font-bold ${
                            vid.view_count >= medianViews * 2 ? 'text-emerald-400'
                            : vid.view_count <= medianViews * 0.5 ? 'text-[hsl(var(--muted-foreground))]'
                            : 'text-[hsl(var(--foreground))]'
                          }`}>
                            {(vid.view_count / Math.max(medianViews, 1)).toFixed(1)}Ã—
                          </p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">vs median</p>
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ Empty video state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {videos.length === 0 && !dataLoading && (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
              <Video className="w-8 h-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">No videos synced yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {connection.status === 'syncing'
                  ? 'Sync in progress â€” check back in a moment.'
                  : 'Click "Sync now" to download your channel videos.'}
              </p>
            </div>
          )}

          {/* â”€â”€ Data provenance footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-5 py-4">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
              <span className="font-semibold text-[hsl(var(--foreground))]">Data source:</span>{' '}
              All analytics shown here come directly from YouTube Data API v3 using your OAuth authorization.
              Metrics are calculated deterministically from synced data â€” no AI estimates, no fabricated numbers.
              Trend data requires at least 2 sync snapshots on different days.
              {connection.last_synced_at && (
                <> Last sync: {new Date(connection.last_synced_at).toLocaleString()}.</>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// â”€â”€â”€ ISO 8601 duration formatter (PT4M13S â†’ 4:13) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatIsoDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] ?? '0');
  const min = parseInt(m[2] ?? '0');
  const s = parseInt(m[3] ?? '0');
  if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${min}:${String(s).padStart(2,'0')}`;
}

// â”€â”€â”€ Page wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MyChannelPage() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/95] backdrop-blur-sm">
          <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
            <PlayCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">My Channel</span>
          </div>
        </div>
        {/* Content */}
        <div className="px-4 sm:px-6 py-5">
          <Suspense fallback={
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
            </div>
          }>
            <MyChannelContent />
          </Suspense>
        </div>
      </div>
    </AppLayout>
  );
}

// â”€â”€â”€ Channel Comparison Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ComparisonProps {
  connection: ChannelConnection;
  videos: ChannelVideo[];
  snapshots: ChannelSnapshot[];
}

function ChannelComparisonSection({ connection, videos, snapshots }: ComparisonProps) {
  const comparison = calculateChannelComparison(connection, videos, snapshots);
  const { yourMetrics, benchmarks, comparison: comp } = comparison;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
          Performance vs Competitors
        </h2>
        {benchmarks.competitorCount > 0 && (
          <span className="text-[11px] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-full px-2 py-0.5">
            {benchmarks.niche} Â· {benchmarks.competitorCount} channels analysed
          </span>
        )}
        {benchmarks.competitorCount === 0 && (
          <span className="text-[11px] text-amber-500">Using fallback benchmarks â€” sync to load real competitors</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Engagement rate */}
        <div className="border border-[hsl(var(--border))/50] rounded-lg p-4 bg-[hsl(var(--background))]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
            Engagement rate
          </p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {yourMetrics.engagementRate.toFixed(2)}%
            </span>
            <span className={`text-xs font-semibold ${getPerformanceLabel(comp.engagementRatio).color}`}>
              {getPerformanceLabel(comp.engagementRatio).label}
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Top 25%', val: benchmarks.engagementRate.p75, color: 'bg-emerald-500' },
              { label: 'Median',  val: benchmarks.engagementRate.p50, color: 'bg-blue-500' },
              { label: 'Bottom',  val: benchmarks.engagementRate.p25, color: 'bg-amber-500' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center gap-2 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                <span className="text-[hsl(var(--muted-foreground))] w-14">{label}</span>
                <span className="font-mono text-[hsl(var(--foreground))]">{val.toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${comp.engagementRatio >= 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(comp.engagementRatio * 60, 100)}%` }}
            />
          </div>
        </div>

        {/* Upload frequency */}
        <div className="border border-[hsl(var(--border))/50] rounded-lg p-4 bg-[hsl(var(--background))]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
            Upload frequency
          </p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {yourMetrics.uploadFrequencyPerMonth.toFixed(1)}<span className="text-sm font-normal">/mo</span>
            </span>
            <span className={`text-xs font-semibold ${getPerformanceLabel(comp.uploadFrequencyRatio).color}`}>
              {getPerformanceLabel(comp.uploadFrequencyRatio).label}
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Top 25%', val: benchmarks.uploadFrequency.p75, color: 'bg-emerald-500' },
              { label: 'Median',  val: benchmarks.uploadFrequency.p50, color: 'bg-blue-500' },
              { label: 'Bottom',  val: benchmarks.uploadFrequency.p25, color: 'bg-amber-500' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center gap-2 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                <span className="text-[hsl(var(--muted-foreground))] w-14">{label}</span>
                <span className="font-mono text-[hsl(var(--foreground))]">{val.toFixed(1)}/mo</span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${comp.uploadFrequencyRatio >= 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(comp.uploadFrequencyRatio * 60, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Growth indicators */}
      {comparison.growth.isGrowing && (
        <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/5">
          <p className="text-xs font-semibold text-emerald-500 mb-2">ðŸ“ˆ Growing</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Subscriber growth</p>
              <p className="text-sm font-bold text-emerald-500">
                +{comparison.growth.subscriberGrowthRate.toFixed(1)}% / month
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">View growth</p>
              <p className="text-sm font-bold text-emerald-500">
                +{comparison.growth.viewGrowthRate.toFixed(1)}% / month
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Growth Suggestions Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GrowthSuggestionsSection({ connection, videos, snapshots }: ComparisonProps) {
  const comparison = calculateChannelComparison(connection, videos, snapshots);
  const suggestions = generateGrowthSuggestions(comparison, videos);

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
        <p className="text-sm font-semibold text-emerald-500 mb-1">ðŸŽ‰ You're crushing it!</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No immediate suggestions. Keep doing what you're doing.</p>
      </div>
    );
  }

  const priorityIcons = { high: 'ðŸ”¥', medium: 'âš¡', low: 'ðŸ’¡' };
  const priorityColors = {
    high:   'border-red-500/30 bg-red-500/5',
    medium: 'border-amber-500/30 bg-amber-500/5',
    low:    'border-blue-500/30 bg-blue-500/5',
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Growth Suggestions</h2>

      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className={`rounded-lg border p-4 ${priorityColors[suggestion.priority]}`}>
            <div className="flex items-start gap-3 mb-2">
              <span className="text-lg shrink-0">{priorityIcons[suggestion.priority]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">{suggestion.title}</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 leading-relaxed">{suggestion.description}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))] mb-0.5">ðŸ“‹ Action:</p>
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{suggestion.actionable}</p>
              </div>
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))] mb-0.5">ðŸ“ˆ Expected Impact:</p>
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{suggestion.impact}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-[hsl(var(--border))]">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          ðŸ’¡ Suggestions based on real competitors in your niche. Sync weekly for fresh data.
        </p>
      </div>
    </div>
  );
}
