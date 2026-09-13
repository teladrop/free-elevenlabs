-- ============================================================================
-- Migration 002 — My Channel (Google Auth + YouTube OAuth + channel analytics)
-- Run in the Supabase SQL Editor after migration 001.
-- ============================================================================

-- ─── 1. user_youtube_connections ─────────────────────────────────────────────
-- One row per user. Stores the OAuth tokens server-side.
-- access_token and refresh_token are NEVER returned to the browser.
create table if not exists user_youtube_connections (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  youtube_channel_id  text        not null,
  channel_title       text        not null default '',
  channel_handle      text        not null default '',
  thumbnail_url       text        not null default '',
  subscriber_count    bigint      not null default 0,
  video_count         bigint      not null default 0,
  view_count          bigint      not null default 0,
  -- OAuth tokens — server-side only, NEVER exposed to browser
  access_token        text,
  refresh_token       text,
  token_expires_at    timestamptz,
  -- Sync state
  status              text        not null default 'connected'
                        check (status in ('connected','syncing','synced','sync_failed','needs_reauth','disconnected')),
  connected_at        timestamptz not null default now(),
  last_synced_at      timestamptz,
  sync_error          text,
  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint user_youtube_connections_user_id_key unique (user_id)
);

create index if not exists idx_uyc_user_id
  on user_youtube_connections (user_id);

create index if not exists idx_uyc_channel_id
  on user_youtube_connections (youtube_channel_id);

-- ─── 2. user_channel_snapshots ───────────────────────────────────────────────
-- Daily snapshots of the user's own channel stats for trend charting.
create table if not exists user_channel_snapshots (
  id                  bigserial   primary key,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  youtube_channel_id  text        not null,
  snapshot_date       date        not null default current_date,
  subscriber_count    bigint      not null default 0,
  view_count          bigint      not null default 0,
  video_count         bigint      not null default 0,
  created_at          timestamptz not null default now(),

  constraint user_channel_snapshots_user_channel_date_key
    unique (user_id, youtube_channel_id, snapshot_date)
);

create index if not exists idx_ucs_user_date
  on user_channel_snapshots (user_id, snapshot_date desc);

-- ─── 3. user_channel_videos ──────────────────────────────────────────────────
-- Synced videos from the user's own channel.
-- Separate from youtube_videos (public search cache) — this is private owner data.
create table if not exists user_channel_videos (
  id                  bigserial   primary key,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  youtube_video_id    text        not null,
  youtube_channel_id  text        not null,
  title               text        not null default '',
  description         text        not null default '',
  published_at        timestamptz,
  thumbnail_url       text        not null default '',
  duration            text        not null default '',
  view_count          bigint      not null default 0,
  like_count          bigint      not null default 0,
  comment_count       bigint      not null default 0,
  first_synced_at     timestamptz not null default now(),
  last_synced_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint user_channel_videos_user_video_key unique (user_id, youtube_video_id)
);

create index if not exists idx_ucv_user_id
  on user_channel_videos (user_id, published_at desc);

create index if not exists idx_ucv_view_count
  on user_channel_videos (user_id, view_count desc);

-- ─── 4. user_video_snapshots ─────────────────────────────────────────────────
-- Periodic snapshots per video for velocity / growth calculation.
create table if not exists user_video_snapshots (
  id                  bigserial   primary key,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  youtube_video_id    text        not null,
  snapshot_date       date        not null default current_date,
  view_count          bigint      not null default 0,
  like_count          bigint      not null default 0,
  comment_count       bigint      not null default 0,
  created_at          timestamptz not null default now(),

  constraint user_video_snapshots_user_video_date_key
    unique (user_id, youtube_video_id, snapshot_date)
);

create index if not exists idx_uvs_user_video_date
  on user_video_snapshots (user_id, youtube_video_id, snapshot_date desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Each user can only see their own rows.

alter table user_youtube_connections  enable row level security;
alter table user_channel_snapshots    enable row level security;
alter table user_channel_videos       enable row level security;
alter table user_video_snapshots      enable row level security;

-- user_youtube_connections: own row only, NEVER expose tokens via select
create policy "owner_select_connection" on user_youtube_connections
  for select using (auth.uid() = user_id);

-- The service-role key (server-side API routes) bypasses RLS — so token
-- reads/writes only ever happen in server code.

create policy "owner_insert_connection" on user_youtube_connections
  for insert with check (auth.uid() = user_id);

create policy "owner_update_connection" on user_youtube_connections
  for update using (auth.uid() = user_id);

create policy "owner_delete_connection" on user_youtube_connections
  for delete using (auth.uid() = user_id);

-- Snapshots and videos: owner-only
create policy "owner_all_channel_snapshots" on user_channel_snapshots
  for all using (auth.uid() = user_id);

create policy "owner_all_channel_videos" on user_channel_videos
  for all using (auth.uid() = user_id);

create policy "owner_all_video_snapshots" on user_video_snapshots
  for all using (auth.uid() = user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
-- Reuses the update_updated_at_column() function created in migration 001.

create or replace trigger trg_uyc_updated_at
  before update on user_youtube_connections
  for each row execute function update_updated_at_column();

create or replace trigger trg_ucv_updated_at
  before update on user_channel_videos
  for each row execute function update_updated_at_column();
