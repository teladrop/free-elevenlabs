-- Migration 004: Competitor Channels v2
-- Replaces auto niche-detection with user-managed competitors.
-- Drops niche_detections table (no longer needed).
-- Simplifies competitor_channels to just store what the user added + YouTube metrics.

-- ─── Drop old niche-detection infrastructure ─────────────────────────────────

drop table if exists niche_detections cascade;

-- ─── Drop old competitor tables (clean slate) ────────────────────────────────

drop table if exists competitor_snapshots cascade;
drop table if exists competitor_channels cascade;

-- ─── New competitor_channels ─────────────────────────────────────────────────
-- One row per competitor the user manually added.

create table competitor_channels (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  -- YouTube channel identity
  youtube_channel_id    text not null,
  channel_title         text not null,
  channel_handle        text,
  profile_image_url     text,
  description           text,

  -- Fetched metrics (refreshed weekly)
  subscriber_count      bigint  default 0,
  video_count           int     default 0,
  view_count            bigint  default 0,
  avg_engagement_rate   float   default 0,   -- (likes + comments) / views * 100
  avg_views_per_video   float   default 0,
  upload_frequency      float   default 0,   -- videos per month

  -- Cache freshness
  last_fetched_at       timestamptz default now(),

  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),

  constraint uq_competitor_per_user unique (user_id, youtube_channel_id)
);

create index idx_cc_user        on competitor_channels (user_id);
create index idx_cc_user_title  on competitor_channels (user_id, channel_title);

alter table competitor_channels enable row level security;

create policy "users_select_own" on competitor_channels
  for select using (auth.uid() = user_id);

create policy "users_insert_own" on competitor_channels
  for insert with check (auth.uid() = user_id);

create policy "users_update_own" on competitor_channels
  for update using (auth.uid() = user_id);

create policy "users_delete_own" on competitor_channels
  for delete using (auth.uid() = user_id);

-- ─── AI suggestions cache ────────────────────────────────────────────────────
-- Stores the latest AI-generated suggestion set so we don't hit the LLM on
-- every page load. Invalidated when the user syncs or refreshes competitors.

create table channel_ai_suggestions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  suggestions   jsonb  not null,   -- array of suggestion objects
  model_used    text,
  prompt_hash   text,              -- sha256 of the prompt, for dedup

  created_at    timestamptz default now(),
  expires_at    timestamptz default now() + interval '7 days',

  constraint uq_ai_suggestions_user unique (user_id)
);

create index idx_ai_sug_user    on channel_ai_suggestions (user_id);
create index idx_ai_sug_expires on channel_ai_suggestions (expires_at);

alter table channel_ai_suggestions enable row level security;

create policy "users_select_own_suggestions" on channel_ai_suggestions
  for select using (auth.uid() = user_id);

create policy "users_upsert_own_suggestions" on channel_ai_suggestions
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_suggestions" on channel_ai_suggestions
  for update using (auth.uid() = user_id);
