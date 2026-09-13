-- ============================================================================
-- Migration 001 — Data Intelligence Cache Layer
-- Run once in the Supabase SQL Editor (or via supabase db push).
--
-- EXISTING tables (script_history, visual_history) are NOT touched.
--
-- New tables:
--   youtube_videos
--   youtube_channels
--   youtube_search_cache
--   google_trends_cache
--   data_refresh_jobs
--   data_source_usage
-- ============================================================================

-- ─── 1. youtube_videos ───────────────────────────────────────────────────────
create table if not exists youtube_videos (
  id                  bigserial primary key,
  youtube_video_id    text        not null,
  channel_id          text        not null default '',
  title               text        not null default '',
  description         text        not null default '',
  published_at        timestamptz,
  thumbnail_url       text        not null default '',
  duration            text        not null default '',
  view_count          bigint      not null default 0,
  like_count          bigint      not null default 0,
  comment_count       bigint      not null default 0,
  -- JSONB only for rare extra fields; core stats are columnar above
  raw_metadata        jsonb,
  first_seen_at       timestamptz not null default now(),
  last_fetched_at     timestamptz not null default now(),
  next_refresh_at     timestamptz not null default now() + interval '6 hours',
  -- SHA-256 of (view_count||like_count||comment_count) for change detection
  data_hash           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint youtube_videos_youtube_video_id_key unique (youtube_video_id)
);

create index if not exists idx_youtube_videos_channel_id
  on youtube_videos (channel_id);

create index if not exists idx_youtube_videos_published_at
  on youtube_videos (published_at desc);

create index if not exists idx_youtube_videos_next_refresh
  on youtube_videos (next_refresh_at asc);

create index if not exists idx_youtube_videos_view_count
  on youtube_videos (view_count desc);


-- ─── 2. youtube_channels ─────────────────────────────────────────────────────
create table if not exists youtube_channels (
  id                    bigserial primary key,
  youtube_channel_id    text        not null,
  channel_title         text        not null default '',
  description           text        not null default '',
  thumbnail_url         text        not null default '',
  subscriber_count      bigint      not null default 0,
  video_count           bigint      not null default 0,
  view_count            bigint      not null default 0,
  published_at          timestamptz,
  raw_metadata          jsonb,
  last_fetched_at       timestamptz not null default now(),
  next_refresh_at       timestamptz not null default now() + interval '12 hours',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint youtube_channels_youtube_channel_id_key unique (youtube_channel_id)
);

create index if not exists idx_youtube_channels_subscriber_count
  on youtube_channels (subscriber_count desc);

create index if not exists idx_youtube_channels_next_refresh
  on youtube_channels (next_refresh_at asc);


-- ─── 3. youtube_search_cache ─────────────────────────────────────────────────
-- Stores the full compressed result payload for a (query, parameters) pair.
-- result_payload is JSONB — it mirrors the YouTubeSearchResult shape the app
-- already expects so no translation is needed on read.

create table if not exists youtube_search_cache (
  id                  bigserial primary key,
  normalized_query    text        not null,
  query_hash          text        not null,           -- SHA-256(query:vN:cN)
  search_parameters   jsonb       not null default '{}',
  result_video_ids    text[]      not null default '{}',
  result_channel_ids  text[]      not null default '{}',
  -- Full payload stored for instant serving; kept small via TTL expiry
  result_payload      jsonb       not null default '{}',
  status              text        not null default 'active'
                        check (status in ('active','expired','refreshing')),
  expires_at          timestamptz not null,
  last_used_at        timestamptz not null default now(),
  hit_count           integer     not null default 0,
  source              text        not null default 'youtube',
  created_at          timestamptz not null default now(),

  constraint youtube_search_cache_query_hash_key unique (query_hash)
);

create index if not exists idx_yt_search_cache_normalized_query
  on youtube_search_cache (normalized_query);

create index if not exists idx_yt_search_cache_status_expires
  on youtube_search_cache (status, expires_at asc);

create index if not exists idx_yt_search_cache_hit_count
  on youtube_search_cache (hit_count desc);


-- ─── 4. google_trends_cache ──────────────────────────────────────────────────
create table if not exists google_trends_cache (
  id                bigserial primary key,
  normalized_query  text        not null,
  query_hash        text        not null,           -- SHA-256(query|region|timeRange)
  region            text        not null default '',
  time_range        text        not null default 'today 12-m',
  category          integer     not null default 0,
  -- Array of { term, relativeVolume, sourceId, retrievedAt }
  trend_data        jsonb       not null default '[]',
  status            text        not null default 'active'
                      check (status in ('active','expired')),
  expires_at        timestamptz not null,
  last_used_at      timestamptz not null default now(),
  hit_count         integer     not null default 0,
  created_at        timestamptz not null default now(),

  constraint google_trends_cache_query_hash_key unique (query_hash)
);

create index if not exists idx_gt_cache_normalized_query
  on google_trends_cache (normalized_query);

create index if not exists idx_gt_cache_status_expires
  on google_trends_cache (status, expires_at asc);


-- ─── 5. data_refresh_jobs ────────────────────────────────────────────────────
create table if not exists data_refresh_jobs (
  id               uuid        primary key default gen_random_uuid(),
  source           text        not null check (source in ('youtube','trends')),
  entity_type      text        not null
                     check (entity_type in ('search_query','video','channel','trends_query')),
  entity_id        text        not null,   -- normalized query / video ID / channel ID
  priority         smallint    not null default 3
                     check (priority between 1 and 5),
  status           text        not null default 'pending'
                     check (status in ('pending','running','done','failed')),
  attempts         integer     not null default 0,
  last_attempt_at  timestamptz,
  next_attempt_at  timestamptz not null default now(),
  last_success_at  timestamptz,
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_refresh_jobs_pending
  on data_refresh_jobs (priority asc, next_attempt_at asc)
  where status = 'pending';

create index if not exists idx_refresh_jobs_entity
  on data_refresh_jobs (source, entity_type, entity_id);

create index if not exists idx_refresh_jobs_status
  on data_refresh_jobs (status);


-- ─── 6. data_source_usage ────────────────────────────────────────────────────
create table if not exists data_source_usage (
  id                bigserial primary key,
  source            text    not null,       -- 'youtube', 'trends', etc.
  operation         text    not null,       -- 'search.list', 'videos.list', etc.
  date              date    not null,       -- UTC date  YYYY-MM-DD
  request_count     integer not null default 0,
  successful_count  integer not null default 0,
  failed_count      integer not null default 0,
  quota_units_used  integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint data_source_usage_source_op_date_key unique (source, operation, date)
);

create index if not exists idx_usage_source_date
  on data_source_usage (source, date desc);


-- ============================================================================
-- Row Level Security
-- All new tables use the service-role key (server-side only) for writes.
-- We enable RLS and add a service-role bypass so the anon client cannot
-- read or write these tables from the browser.
-- ============================================================================

alter table youtube_videos          enable row level security;
alter table youtube_channels        enable row level security;
alter table youtube_search_cache    enable row level security;
alter table google_trends_cache     enable row level security;
alter table data_refresh_jobs       enable row level security;
alter table data_source_usage       enable row level security;

-- Service role bypasses RLS automatically in Supabase.
-- The policies below block all anon/authenticated access from the browser.
-- Adjust if you later build a public read-only API.

create policy "deny anon reads youtube_videos"
  on youtube_videos for select using (false);

create policy "deny anon reads youtube_channels"
  on youtube_channels for select using (false);

create policy "deny anon reads youtube_search_cache"
  on youtube_search_cache for select using (false);

create policy "deny anon reads google_trends_cache"
  on google_trends_cache for select using (false);

create policy "deny anon reads data_refresh_jobs"
  on data_refresh_jobs for select using (false);

create policy "deny anon reads data_source_usage"
  on data_source_usage for select using (false);


-- ============================================================================
-- Helper function: auto-update updated_at on any table that has that column
-- ============================================================================

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_youtube_videos_updated_at
  before update on youtube_videos
  for each row execute function update_updated_at_column();

create or replace trigger trg_youtube_channels_updated_at
  before update on youtube_channels
  for each row execute function update_updated_at_column();

create or replace trigger trg_refresh_jobs_updated_at
  before update on data_refresh_jobs
  for each row execute function update_updated_at_column();

create or replace trigger trg_usage_updated_at
  before update on data_source_usage
  for each row execute function update_updated_at_column();
