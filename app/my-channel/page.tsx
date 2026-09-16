'use client';

import { AppLayout }   from '@/components/layout/app-layout';
import { PageHeader }  from '@/components/layout/page-header';
import { useChannel }  from '@/app/providers/channel-provider';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PlayCircle, RefreshCw, LogOut, Link2, Link2Off,
  AlertCircle, Loader2, Users, Eye, Video,
  BarChart2, ExternalLink, CheckCircle2, TrendingUp, Activity,
} from 'lucide-react';
import { signOut, getAuthClientInstance, type User } from '@/lib/db/auth-client';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { cn, authHeaders, getToken, type VideoSort } from './components/helpers';
import { StatusBadge, GradientStatCard, TabBtn } from './components/ui-atoms';
import { ChannelStatsTable }      from './components/channel-stats-table';
import { ComparePerformanceChart } from './components/compare-performance-chart';
import { TopCompetitorVideos }     from './components/top-competitor-videos';
import { CompetitorsAndAISection } from './components/competitors-ai-section';

// ─── Main content ─────────────────────────────────────────────────────────────

function MyChannelContent() {
  const searchParams = useSearchParams();
  const { connection, videos, snapshots, setConnection, setVideos, setSnapshots } = useChannel();

  const [user,          setUser]          = useState<User | null>(null);
  const [userLoading,   setUserLoading]   = useState(true);
  const [dataLoading,   setDataLoading]   = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [videoSort,     setVideoSort]     = useState<VideoSort>('view_count');
  const [error,         setError]         = useState('');
  const [successMsg,    setSuccessMsg]    = useState('');

  // ── URL param messages ────────────────────────────────────────────────────
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      const map: Record<string, string> = {
        not_authenticated: 'Could not verify your session. Please sign in again.',
        cancelled:         'YouTube connection was cancelled.',
        connect_failed:    `Connection failed: ${searchParams.get('msg') ?? 'unknown error'}`,
      };
      setError(map[err] ?? `Error: ${err}`);
    }
    if (searchParams.get('connected') === '1') {
      setSuccessMsg('YouTube channel connected! Syncing your data…');
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }, [searchParams]);

  // ── Auth state ────────────────────────────────────────────────────────────
  // Middleware guarantees the user is authenticated before reaching this page,
  // but we still need the user object client-side (for email display etc.)
  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) { setUserLoading(false); return; }
    client.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setUserLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load channel data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setError('');
    try {
      const hdrs = await authHeaders();
      const res  = await fetch(`/api/my-channel/data?sort=${videoSort}&limit=50`, { headers: hdrs });
      if (!res.ok) return;
      const d = await res.json();
      setConnection(d.connection ?? null);
      setVideos(d.videos ?? []);
      setSnapshots(d.snapshots ?? []);
    } catch (e: unknown) { if (e instanceof Error) setError(e.message); }
    finally { setDataLoading(false); }
  }, [videoSort, setConnection, setVideos, setSnapshots]);

  useEffect(() => { if (!userLoading) loadData(); }, [userLoading, loadData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleConnect = async () => {
    const token = await getToken();
    if (!token) { setError('Session expired. Please sign in again.'); return; }
    document.cookie = `sb-temp-auth-token=${encodeURIComponent(token)}; path=/; max-age=60; SameSite=Lax`;
    setTimeout(() => { window.location.href = '/api/my-channel/connect'; }, 50);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const hdrs = await authHeaders();
      const res  = await fetch('/api/my-channel/sync', { method: 'POST', headers: hdrs });
      const d    = await res.json();
      if (!d.success) throw new Error(d.error ?? 'Sync failed');
      setSuccessMsg(`Synced ${d.videosUpserted} videos`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (e: unknown) { if (e instanceof Error) setError(e.message); }
    finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your YouTube channel? Your synced data will be preserved.')) return;
    setDisconnecting(true);
    try {
      const hdrs = await authHeaders();
      const res  = await fetch('/api/my-channel/disconnect', { method: 'POST', headers: hdrs });
      if (res.ok) { setConnection(null); setVideos([]); setSnapshots([]); }
    } catch (e: unknown) { if (e instanceof Error) setError(e.message); }
    finally { setDisconnecting(false); }
  };

  // ── Computed metrics ──────────────────────────────────────────────────────
  const medianViews = (() => {
    if (!videos.length) return 0;
    const s = [...videos].map(v => v.view_count).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  })();
  const avgEngagement = (() => {
    const rates = videos
      .filter(v => v.view_count > 0)
      .map(v => ((v.like_count + v.comment_count) / v.view_count) * 100);
    return rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
  })();

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      </AppLayout>
    );
  }

  // ── NO YOUTUBE CHANNEL CONNECTED ──────────────────────────────────────────
  if (!connection) {
    return (
      <AppLayout>
        <PageHeader title="My Channel" description="Connect your YouTube channel to get started" />

        <div className="max-w-lg mx-auto py-16 px-4">

          {/* User pill + sign-out */}
          {user && (
            <div className="flex items-center justify-between mb-8 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-bold">
                  {(user.email ?? '?')[0].toUpperCase()}
                </div>
                {user.email}
              </span>
              <button onClick={handleSignOut}
                className="flex items-center gap-1.5 hover:text-[hsl(var(--foreground))] transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}

          {/* Connection card */}
          <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <PlayCircle className="w-8 h-8 text-red-400" />
            </div>

            <h2 className="text-xl font-bold text-[hsl(var(--foreground))] mb-2">
              Connect YouTube Channel
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6 max-w-xs mx-auto">
              Read-only access to sync your videos and analytics. No upload or management permissions.
            </p>

            {/* What you get */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-left">
              {[
                { icon: <Users    className="w-3.5 h-3.5" />, label: 'Subscriber count' },
                { icon: <Eye      className="w-3.5 h-3.5" />, label: 'Total views'       },
                { icon: <Video    className="w-3.5 h-3.5" />, label: 'Your videos'       },
                { icon: <BarChart2 className="w-3.5 h-3.5" />, label: 'Performance data' },
              ].map(item => (
                <div key={item.label}
                  className="flex items-center gap-2 rounded-xl bg-[hsl(var(--background))] px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">
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

            <button onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-sm transition-all shadow-lg shadow-red-500/25">
              <Link2 className="w-4 h-4" /> Connect YouTube Channel
            </button>

            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-3">
              Read-only · No upload permission · Disconnect anytime
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── CONNECTED — full analytics dashboard ─────────────────────────────────
  return (
    <AppLayout>
      <PageHeader
        title="My Channel"
        description={`${connection.channel_title}${connection.channel_handle ? ' · ' + connection.channel_handle : ''}`}
      >
        <button onClick={handleSync}
          disabled={syncing || connection.status === 'syncing'}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50 transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', syncing ? 'animate-spin' : '')} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
        <button onClick={handleDisconnect} disabled={disconnecting}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/25 bg-red-500/8 text-xs font-medium text-red-400 hover:bg-red-500/15 disabled:opacity-50 transition-colors">
          <Link2Off className="w-3.5 h-3.5" /> Disconnect
        </button>
        <button onClick={handleSignOut}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </PageHeader>

      <div className="px-6 py-6 space-y-6">

        {/* Notification banner */}
        {(error || successMsg) && (
          <div className={cn(
            'flex items-start gap-3 rounded-2xl border px-4 py-3',
            error ? 'border-red-500/20 bg-red-500/8 text-red-400'
                  : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400',
          )}>
            {error
              ? <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5" />
              : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="text-sm flex-1">{error || successMsg}</p>
            <button onClick={() => { setError(''); setSuccessMsg(''); }}
              className="text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ── Channel hero ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-white/8 p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))/8] to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              {connection.thumbnail_url ? (
                <img src={connection.thumbnail_url} alt={connection.channel_title}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/10 shadow-xl" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
                  <PlayCircle className="w-9 h-9 text-red-400" />
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-white">{connection.channel_title}</h1>
                <StatusBadge status={connection.status} />
              </div>
              {connection.channel_handle && (
                <a href={`https://youtube.com/${connection.channel_handle}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 w-fit transition-colors">
                  {connection.channel_handle} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <p className="text-[11px] text-white/40 mt-1">
                {connection.last_synced_at
                  ? `Last synced ${timeAgo(connection.last_synced_at)}`
                  : 'Never synced'}
                {connection.connected_at
                  ? ` · Connected ${timeAgo(connection.connected_at)}`
                  : ''}
              </p>
            </div>
            {/* Inline stats */}
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{formatNumber(connection.subscriber_count)}</div>
                <div className="text-[10px] text-white/40">Subscribers</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-xl font-bold text-white">{formatNumber(connection.view_count)}</div>
                <div className="text-[10px] text-white/40">Total Views</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-xl font-bold text-white">{formatNumber(connection.video_count)}</div>
                <div className="text-[10px] text-white/40">Videos</div>
              </div>
            </div>
          </div>
          {connection.sync_error && (
            <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Sync error: {connection.sync_error}
            </div>
          )}
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <GradientStatCard icon={<Users    className="w-4 h-4" />} label="Subscribers"
                value={formatNumber(connection.subscriber_count)}
                gradient="bg-gradient-to-br from-blue-600 to-blue-800" />
              <GradientStatCard icon={<Eye      className="w-4 h-4" />} label="Total Views"
                value={formatNumber(connection.view_count)}
                gradient="bg-gradient-to-br from-purple-600 to-purple-800" />
              <GradientStatCard icon={<TrendingUp className="w-4 h-4" />} label="Avg Engagement"
                value={`${avgEngagement.toFixed(2)}%`} sub="likes + comments ÷ views"
                gradient="bg-gradient-to-br from-emerald-600 to-emerald-800" />
              <GradientStatCard icon={<Activity  className="w-4 h-4" />} label="Median Views/Video"
                value={formatNumber(medianViews)} sub={`${videos.length} videos synced`}
                gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
            </div>

            {/* ── Analytics grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <ChannelStatsTable connection={connection} />
                <ComparePerformanceChart snapshots={snapshots} />
              </div>
              <div>
                <CompetitorsAndAISection connection={connection} />
              </div>
            </div>

            {/* ── Top Competitor Videos ── */}
            <TopCompetitorVideos />

            {/* ── My Videos ── */}
            {videos.length > 0 && (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                      <Video className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      My Videos{' '}
                      <span className="text-[hsl(var(--muted-foreground))] font-normal">
                        ({videos.length})
                      </span>
                    </h2>
                  </div>
                  <div className="flex gap-1">
                    {(['view_count', 'published_at'] as VideoSort[]).map(s => (
                      <TabBtn key={s} active={videoSort === s} onClick={() => setVideoSort(s)}>
                        {s === 'view_count' ? 'Most views' : 'Newest'}
                      </TabBtn>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {videos.slice(0, 10).map((vid, i) => (
                    <a key={vid.youtube_video_id}
                      href={`https://youtube.com/watch?v=${vid.youtube_video_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 hover:bg-[hsl(var(--surface-elevated))] transition-colors group">
                      <span className="shrink-0 w-5 text-center text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                          {vid.title}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {vid.published_at ? timeAgo(vid.published_at) : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-[hsl(var(--foreground))]">
                          {formatNumber(vid.view_count)}
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">views</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function MyChannelPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[hsl(var(--background))]">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
      </div>
    }>
      <MyChannelContent />
    </Suspense>
  );
}
