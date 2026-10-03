'use client';

import { AppLayout }   from '@/components/layout/app-layout';
import { useChannel }  from '@/app/providers/channel-provider';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PlayCircle, RefreshCw, LogOut, Link2, Link2Off,
  AlertCircle, Loader2, Users, Eye, Video,
  BarChart2, ExternalLink, CheckCircle2, TrendingUp,
  Activity, Settings, ChevronRight, Zap, Star,
} from 'lucide-react';
import { signOut, getAuthClientInstance, type User } from '@/lib/db/auth-client';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { cn, authHeaders, getToken, type VideoSort } from './components/helpers';
import { StatusBadge, GradientStatCard, TabBtn } from './components/ui-atoms';
import { ChannelStatsTable }      from './components/channel-stats-table';
import { ComparePerformanceChart } from './components/compare-performance-chart';
import { TopCompetitorVideos }     from './components/top-competitor-videos';
import { CompetitorsAndAISection } from './components/competitors-ai-section';
import { CompetitorKeywords }      from './components/competitor-keywords';

// ─── Competitor Keywords wrapper ──────────────────────────────────────────────

function CompetitorKeywordsSection() {
  const [competitors, setCompetitors] = useState<import('./components/helpers').Competitor[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const hdrs = await authHeaders();
        const res  = await fetch('/api/my-channel/competitors', { headers: hdrs });
        const d    = await res.json();
        setCompetitors(d.competitors ?? []);
      } catch {}
    })();
  }, []);
  return <CompetitorKeywords competitors={competitors} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function MyChannelContent() {
  const sp = useSearchParams();
  const { connection, videos, snapshots, setConnection, setVideos, setSnapshots } = useChannel();

  const [user,          setUser]          = useState<User | null>(null);
  const [userLoading,   setUserLoading]   = useState(true);
  const [dataLoading,   setDataLoading]   = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [channelKey,    setChannelKey]    = useState(0);
  const [videoSort,     setVideoSort]     = useState<VideoSort>('view_count');
  const [error,         setError]         = useState('');
  const [successMsg,    setSuccessMsg]    = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'competitors' | 'videos'>('overview');

  // ── URL params ────────────────────────────────────────────────────────────
  useEffect(() => {
    const err = sp.get('error');
    if (err) {
      const map: Record<string, string> = {
        not_authenticated: 'Could not verify your session. Please sign in again.',
        cancelled:         'YouTube connection was cancelled.',
        connect_failed:    `Connection failed: ${sp.get('msg') ?? 'unknown error'}`,
      };
      setError(map[err] ?? `Error: ${err}`);
    }
    if (sp.get('connected') === '1') {
      setSuccessMsg('YouTube channel connected! Syncing your data…');
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }, [sp]);

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true); setError('');
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
  const handleSignOut = async () => { await signOut(); window.location.href = '/'; };

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
      const d    = await (await fetch('/api/my-channel/sync', { method: 'POST', headers: hdrs })).json();
      if (!d.success) throw new Error(d.error ?? 'Sync failed');
      setSuccessMsg(`Synced ${d.videosUpserted} videos`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (e: unknown) { if (e instanceof Error) setError(e.message); }
    finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect this channel? Your competitors are saved and will return when you reconnect.')) return;
    setDisconnecting(true);
    try {
      const hdrs = await authHeaders();
      const res  = await fetch('/api/my-channel/disconnect', { method: 'POST', headers: hdrs });
      if (res.ok) {
        setConnection(null); setVideos([]); setSnapshots([]);
        setChannelKey(k => k + 1);
      }
    } catch (e: unknown) { if (e instanceof Error) setError(e.message); }
    finally { setDisconnecting(false); }
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const medianViews = (() => {
    if (!videos.length) return 0;
    const s = [...videos].map(v => v.view_count).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  })();
  const avgEngagement = (() => {
    const r = videos.filter(v => v.view_count > 0)
      .map(v => ((v.like_count + v.comment_count) / v.view_count) * 100);
    return r.length ? r.reduce((s, x) => s + x, 0) / r.length : 0;
  })();

  // ── Loading ───────────────────────────────────────────────────────────────
  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      </AppLayout>
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!connection) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">

          {user && (
            <div className="w-full max-w-md flex items-center justify-between mb-6 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-bold">
                  {(user.email ?? '?')[0].toUpperCase()}
                </div>
                {user.email}
              </span>
              <button onClick={handleSignOut} className="flex items-center gap-1.5 hover:text-[hsl(var(--foreground))] transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}

          <div className="w-full max-w-md">
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-7 h-7 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">My Channel</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-xs mx-auto">
                Connect your YouTube channel to track performance, analyse competitors, and get AI growth insights.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-2 mb-6">
              {[
                { icon: <BarChart2 className="w-4 h-4 text-blue-400" />, title: 'Analytics dashboard', desc: 'Views, subs, engagement in one place' },
                { icon: <Users className="w-4 h-4 text-emerald-400" />, title: 'Competitor tracking', desc: 'Monitor up to 10 rival channels' },
                { icon: <Zap className="w-4 h-4 text-amber-400" />, title: 'AI growth suggestions', desc: 'Personalised strategy based on your data' },
                { icon: <Star className="w-4 h-4 text-purple-400" />, title: 'Breakout video alerts', desc: 'Know when competitors go viral' },
              ].map(f => (
                <div key={f.title} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--surface-elevated))] flex items-center justify-center shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{f.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{f.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] ml-auto" />
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            <button onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-500/20">
              <Link2 className="w-4 h-4" /> Connect with YouTube
            </button>
            <p className="text-center text-[10px] text-[hsl(var(--muted-foreground))] mt-3">
              Read-only access · No upload permissions · Disconnect anytime
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  const sortedVideos = [...videos].sort((a, b) =>
    videoSort === 'view_count' ? b.view_count - a.view_count
      : new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">

        {/* ── Notifications ── */}
        {(error || successMsg) && (
          <div className={cn(
            'mx-4 sm:mx-6 mt-4 flex items-start gap-3 rounded-xl border px-4 py-3',
            error ? 'border-red-500/20 bg-red-500/8 text-red-400' : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400',
          )}>
            {error ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="text-sm flex-1">{error || successMsg}</p>
            <button onClick={() => { setError(''); setSuccessMsg(''); }} className="text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ── Channel header card ── */}
        <div className="px-4 sm:px-6 pt-4 pb-0">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
            {/* Top strip */}
            <div className="h-1.5 bg-gradient-to-r from-red-500 via-orange-400 to-red-600" />

            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="shrink-0">
                  {connection.thumbnail_url ? (
                    <img src={connection.thumbnail_url} alt={connection.channel_title}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-[hsl(var(--border))]" />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-red-500/15 flex items-center justify-center">
                      <PlayCircle className="w-7 h-7 text-red-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h1 className="text-base sm:text-lg font-bold text-[hsl(var(--foreground))] truncate">{connection.channel_title}</h1>
                    <StatusBadge status={connection.status} />
                  </div>
                  {connection.channel_handle && (
                    <a href={`https://youtube.com/${connection.channel_handle}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] flex items-center gap-1 w-fit transition-colors">
                      {connection.channel_handle} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                    {connection.last_synced_at ? `Synced ${timeAgo(connection.last_synced_at)}` : 'Never synced'}
                    {connection.connected_at ? ` · Connected ${timeAgo(connection.connected_at)}` : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleSync} disabled={syncing || connection.status === 'syncing'}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50 transition-colors">
                    <RefreshCw className={cn('w-3.5 h-3.5', syncing ? 'animate-spin' : '')} />
                    <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
                  </button>
                  <button onClick={handleDisconnect} disabled={disconnecting}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/25 bg-red-500/8 text-xs font-medium text-red-400 hover:bg-red-500/15 disabled:opacity-50 transition-colors">
                    <Link2Off className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Disconnect</span>
                  </button>
                  <button onClick={handleSignOut}
                    className="h-8 w-8 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stat strip */}
              <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-[hsl(var(--border))]">
                <div>
                  <p className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))]">{formatNumber(connection.subscriber_count)}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Subscribers</p>
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))]">{formatNumber(connection.view_count)}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Total Views</p>
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))]">{formatNumber(connection.video_count)}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Videos</p>
                </div>
              </div>

              {connection.sync_error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {connection.sync_error}
                </div>
              )}
            </div>

            {/* Section tabs */}
            <div className="flex border-t border-[hsl(var(--border))]">
              {([
                { id: 'overview',    label: 'Overview',     icon: <BarChart2 className="w-3.5 h-3.5" /> },
                { id: 'competitors', label: 'Competitors',  icon: <Users className="w-3.5 h-3.5" /> },
                { id: 'videos',      label: 'My Videos',    icon: <Video className="w-3.5 h-3.5" /> },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all border-b-2',
                    activeSection === tab.id
                      ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary))/5]'
                      : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-elevated))]'
                  )}>
                  {tab.icon}
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-5 space-y-5 max-w-[1400px] mx-auto">

            {/* ── OVERVIEW tab ── */}
            {activeSection === 'overview' && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <GradientStatCard icon={<Users className="w-4 h-4" />} label="Subscribers"
                    value={formatNumber(connection.subscriber_count)}
                    gradient="bg-gradient-to-br from-blue-600 to-blue-800" />
                  <GradientStatCard icon={<Eye className="w-4 h-4" />} label="Total Views"
                    value={formatNumber(connection.view_count)}
                    gradient="bg-gradient-to-br from-purple-600 to-purple-800" />
                  <GradientStatCard icon={<TrendingUp className="w-4 h-4" />} label="Avg Engagement"
                    value={`${avgEngagement.toFixed(2)}%`} sub="likes + comments ÷ views"
                    gradient="bg-gradient-to-br from-emerald-600 to-emerald-800" />
                  <GradientStatCard icon={<Activity className="w-4 h-4" />} label="Median Views"
                    value={formatNumber(medianViews)} sub={`across ${videos.length} videos`}
                    gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
                </div>

                {/* Performance chart */}
                <ComparePerformanceChart />

                {/* Channel stats table */}
                <ChannelStatsTable connection={connection} />
              </>
            )}

            {/* ── COMPETITORS tab ── */}
            {activeSection === 'competitors' && (
              <>
                <CompetitorsAndAISection key={channelKey} connection={connection} />
                <CompetitorKeywordsSection key={`kw-${channelKey}`} />
                <TopCompetitorVideos />
              </>
            )}

            {/* ── MY VIDEOS tab ── */}
            {activeSection === 'videos' && (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                      <Video className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">My Videos</h2>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{videos.length} videos synced</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(['view_count', 'published_at'] as VideoSort[]).map(s => (
                      <TabBtn key={s} active={videoSort === s} onClick={() => setVideoSort(s)}>
                        {s === 'view_count' ? 'Most views' : 'Newest'}
                      </TabBtn>
                    ))}
                  </div>
                </div>

                {videos.length === 0 ? (
                  <div className="py-16 text-center text-[hsl(var(--muted-foreground))]">
                    <Video className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No videos synced yet</p>
                    <p className="text-xs mt-1 opacity-60">Click Sync to fetch your latest videos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {sortedVideos.slice(0, 30).map((vid, i) => (
                      <a key={vid.youtube_video_id}
                        href={`https://youtube.com/watch?v=${vid.youtube_video_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-5 py-3 hover:bg-[hsl(var(--surface-elevated))] transition-colors group">

                        {/* Rank */}
                        <span className="w-6 text-right text-xs font-bold text-[hsl(var(--muted-foreground))] shrink-0">{i + 1}</span>

                        {/* Thumbnail */}
                        <div className="w-16 h-9 rounded-lg overflow-hidden bg-[hsl(var(--surface-elevated))] shrink-0">
                          {vid.thumbnail_url ? (
                            <img src={vid.thumbnail_url} alt={vid.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PlayCircle className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            </div>
                          )}
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                            {vid.title}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                            {timeAgo(vid.published_at)}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="shrink-0 text-right space-y-0.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Eye className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                            <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{formatNumber(vid.view_count)}</span>
                          </div>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {vid.like_count > 0 ? `${formatNumber(vid.like_count)} likes` : ''}
                          </p>
                        </div>

                        <ExternalLink className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function MyChannelPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      </AppLayout>
    }>
      <MyChannelContent />
    </Suspense>
  );
}
