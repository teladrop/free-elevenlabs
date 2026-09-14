-- Competitor Channels & Benchmarking
-- Stores competitor channel data for niche-based comparisons

-- ─── Competitor Channels ─────────────────────────────────────────────────────
-- Tracks competitor channels discovered via YouTube search for each user's niche

create table competitor_channels (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  niche_detected_from   text not null, -- e.g. "Tech Reviews", "Gaming", "Finance"
  youtube_channel_id    text not null,
  channel_title         text not null,
  channel_handle        text,
  description           text,
  profile_image_url     text,
  category              text, -- YouTube category (if available)
  
  -- Latest metrics snapshot
  subscriber_count      bigint default 0,
  video_count           int default 0,
  view_count            bigint default 0,
  
  -- Engagement metrics (calculated from top videos)
  avg_engagement_rate   float default 0, -- (likes + comments) / views * 100
  avg_views_per_video   float default 0,
  
  -- Upload frequency (videos per month)
  upload_frequency      float default 0,
  
  -- Data freshness
  last_fetched_at       timestamptz default now(),
  data_is_stale         boolean default true, -- true if older than 7 days
  
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  
  constraint unique_competitor_per_user unique(user_id, youtube_channel_id)
);

create index idx_competitor_user on competitor_channels(user_id);
create index idx_competitor_niche on competitor_channels(user_id, niche_detected_from);
create index idx_competitor_stale on competitor_channels(user_id, data_is_stale);

-- ─── Competitor Snapshots ────────────────────────────────────────────────────
-- Historical metrics for tracking competitor growth over time

create table competitor_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  competitor_id         uuid not null references competitor_channels(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  
  snapshot_date         date not null,
  subscriber_count      bigint not null,
  view_count            bigint not null,
  video_count           int not null,
  avg_engagement_rate   float not null,
  
  created_at            timestamptz default now(),
  
  constraint unique_snapshot unique(competitor_id, snapshot_date)
);

create index idx_competitor_snap_user on competitor_snapshots(user_id);
create index idx_competitor_snap_competitor on competitor_snapshots(competitor_id);
create index idx_competitor_snap_date on competitor_snapshots(snapshot_date);

-- ─── Niche Detection Cache ──────────────────────────────────────────────────
-- Cache detected niches to avoid re-analyzing the same channel

create table niche_detections (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  youtube_channel_id    text not null,
  
  detected_niche        text not null, -- e.g. "Tech Reviews", "Gaming"
  confidence            float default 0.8, -- 0-1, how confident we are
  
  -- What we analyzed
  channel_title         text,
  channel_description   text,
  category_tag          text,
  top_video_titles      text[], -- array of top 5 video titles
  
  -- Cache expiry
  detected_at           timestamptz default now(),
  expires_at            timestamptz default now() + interval '30 days',
  
  constraint unique_niche_detection unique(user_id, youtube_channel_id)
);

create index idx_niche_user on niche_detections(user_id);
create index idx_niche_expires on niche_detections(expires_at);

-- ─── Enable RLS ─────────────────────────────────────────────────────────────

alter table competitor_channels enable row level security;
alter table competitor_snapshots enable row level security;
alter table niche_detections enable row level security;

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Competitor Channels: users can only see their own competitors
create policy "users_can_view_own_competitors" on competitor_channels
  for select using (auth.uid() = user_id);

create policy "users_can_insert_competitors" on competitor_channels
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_competitors" on competitor_channels
  for update using (auth.uid() = user_id);

-- Competitor Snapshots: users can only see their own snapshots
create policy "users_can_view_own_competitor_snapshots" on competitor_snapshots
  for select using (auth.uid() = user_id);

create policy "users_can_insert_competitor_snapshots" on competitor_snapshots
  for insert with check (auth.uid() = user_id);

-- Niche Detections: users can only see their own detections
create policy "users_can_view_own_niche_detections" on niche_detections
  for select using (auth.uid() = user_id);

create policy "users_can_insert_niche_detections" on niche_detections
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_niche_detections" on niche_detections
  for update using (auth.uid() = user_id);
