'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { useChannel, type ChannelConnection, type ChannelVideo, type ChannelSnapshot } from '@/app/providers/channel-provider';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  PlayCircle, RefreshCw, LogIn, LogOut, Link2, Link2Off,
  AlertCircle, Loader2, Users, Eye, Video, TrendingUp,
  BarChart2, Calendar, Clock, ExternalLink, CheckCircle2,
  Search, Plus, Trash2, Bot, Sparkles,
} from 'lucide-react';
import { signInWithGoogle, signOut, getAuthClientInstance, type User } from '@/lib/db/auth-client';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';

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
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
        </div>
      </AppLayout>
    );
  }

  // â”€â”€ NOT SIGNED IN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!user) {
    return (
      <AppLayout>
        <PageHeader title="My Channel" description="Connect and analyse your YouTube channel" />
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
      </AppLayout>
    );
  }

  // â”€â”€ SIGNED IN â€” NO CHANNEL CONNECTED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!connection) {
    return (
      <AppLayout>
        <PageHeader title="My Channel" description="Connect and analyse your YouTube channel" />
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
      </AppLayout>
    );
  }

  // â”€â”€ SIGNED IN + CHANNEL CONNECTED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <AppLayout>
      <PageHeader title="My Channel" description="Connect and analyse your YouTube channel" />

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
          {/* -- Competitors and AI Analysis -- */}
          <CompetitorsAndAISection connection={connection} />
        </>
      )}
    </AppLayout>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Competitor {
  id:                  string;
  youtube_channel_id:  string;
  channel_title:       string;
  channel_handle:      string;
  profile_image_url:   string;
  subscriber_count:    number;
  avg_engagement_rate: number;
  avg_views_per_video: number;
  upload_frequency:    number;
  last_fetched_at:     string;
}

interface AISuggestion {
  priority:    'high' | 'medium' | 'low';
  title:       string;
  description: string;
  action:      string;
  impact:      string;
}

// ─── Competitors & AI Section ────────────────────────────────────────────────

function CompetitorsAndAISection({ connection }: { connection: ChannelConnection }) {
  const [competitors,  setCompetitors]  = useState<Competitor[]>([]);
  const [suggestions,  setSuggestions]  = useState<AISuggestion[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searching,    setSearching]    = useState(false);
  const [removingId,   setRemovingId]   = useState<string | null>(null);
  const [error,        setError]        = useState('');
  const [aiError,      setAiError]      = useState('');
  const [generatedAt,  setGeneratedAt]  = useState<string | null>(null);
  const [aiCached,     setAiCached]     = useState(false);

  // Get auth token
  const getToken = async () => {
    const client = getAuthClientInstance();
    if (!client) return '';
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? '';
  };

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  };

  // Load existing competitors on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/my-channel/competitors', { headers });
        if (!res.ok) throw new Error('Failed to load competitors');
        const data = await res.json();
        setCompetitors(data.competitors ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Add competitor
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/my-channel/competitors', {
        method:  'POST',
        headers,
        body:    JSON.stringify({ query: searchQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add competitor');
      setCompetitors((prev) => [data.competitor, ...prev]);
      setSearchQuery('');
      setSuggestions([]); // invalidate old suggestions
      setGeneratedAt(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  // Remove competitor
  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/my-channel/competitors?id=${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed to remove competitor');
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setSuggestions([]);
      setGeneratedAt(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemovingId(null);
    }
  };

  // Run AI analysis
  const handleAnalyze = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/my-channel/analyze', {
        method:  'POST',
        headers,
        body:    JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI analysis failed');
      setSuggestions(data.suggestions ?? []);
      setGeneratedAt(data.generatedAt);
      setAiCached(data.cached ?? false);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const priorityConfig = {
    high:   { icon: '🔥', border: 'border-red-500/30',    bg: 'bg-red-500/5'    },
    medium: { icon: '⚡', border: 'border-amber-500/30',  bg: 'bg-amber-500/5'  },
    low:    { icon: '💡', border: 'border-blue-500/30',   bg: 'bg-blue-500/5'   },
  };

  return (
    <div className="space-y-4">

      {/* ── Competitor Management ─────────────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Competitor Channels</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Add up to 10 channels to compare against. Search by channel name or paste a YouTube URL.
            </p>
          </div>
          <span className="text-xs text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-full px-2 py-0.5">
            {competitors.length}/10
          </span>
        </div>

        {/* Search form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Channel name or youtube.com/channel/UC..."
              disabled={searching || competitors.length >= 10}
              className="w-full pl-8 pr-3 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim() || competitors.length >= 10}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {searching
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Plus className="w-3.5 h-3.5" />}
            {searching ? 'Adding…' : 'Add'}
          </button>
        </form>

        {error && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Competitor list */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : competitors.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No competitors added yet.</p>
            <p className="text-xs mt-1">Search for channels in your niche above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5"
              >
                {/* Avatar */}
                {comp.profile_image_url ? (
                  <img
                    src={comp.profile_image_url}
                    alt={comp.channel_title}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                    <PlayCircle className="w-4 h-4 text-red-400" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://youtube.com/${comp.channel_handle || 'channel/' + comp.youtube_channel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] truncate"
                    >
                      {comp.channel_title}
                    </a>
                    <ExternalLink className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span>{formatNumber(comp.subscriber_count)} subs</span>
                    <span>{comp.avg_engagement_rate.toFixed(2)}% eng.</span>
                    <span>{comp.upload_frequency.toFixed(1)}/mo</span>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(comp.id)}
                  disabled={removingId === comp.id}
                  className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/8 transition-colors disabled:opacity-40"
                >
                  {removingId === comp.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Analysis ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-[hsl(var(--primary))]" />
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">AI Growth Analysis</h2>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              AI compares your metrics against your competitors and gives specific, actionable suggestions.
              {generatedAt && (
                <span className="ml-1 opacity-70">
                  {aiCached ? '(cached)' : '(fresh)'} · {timeAgo(generatedAt)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={aiLoading || competitors.length === 0}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
          >
            {aiLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? 'Analysing…' : suggestions.length > 0 ? 'Re-run' : 'Analyse'}
          </button>
        </div>

        {aiError && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {aiError}
          </div>
        )}

        {competitors.length === 0 && suggestions.length === 0 && (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Add competitors first, then run the analysis.</p>
          </div>
        )}

        {competitors.length > 0 && suggestions.length === 0 && !aiLoading && (
          <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Click "Analyse" to generate AI-powered suggestions.</p>
            <p className="text-xs mt-1">Results are cached for 7 days.</p>
          </div>
        )}

        {aiLoading && (
          <div className="flex flex-col items-center gap-3 py-10 text-[hsl(var(--muted-foreground))]">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-xs">Analysing your channel vs competitors…</p>
          </div>
        )}

        {suggestions.length > 0 && !aiLoading && (
          <div className="space-y-3">
            {suggestions.map((s, i) => {
              const cfg = priorityConfig[s.priority] ?? priorityConfig.low;
              return (
                <div key={i} className={`rounded-lg border p-4 ${cfg.border} ${cfg.bg}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base shrink-0">{cfg.icon}</span>
                    <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{s.title}</h3>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed pl-6">
                    {s.description}
                  </p>
                  <div className="pl-6 space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold text-[hsl(var(--foreground))]">Action: </span>
                      <span className="text-[hsl(var(--muted-foreground))]">{s.action}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[hsl(var(--foreground))]">Impact: </span>
                      <span className="text-[hsl(var(--muted-foreground))]">{s.impact}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyChannelPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
      <MyChannelContent />
    </Suspense>
  );
}
