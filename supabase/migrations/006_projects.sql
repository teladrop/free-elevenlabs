-- ============================================================================
-- Migration 006 — Projects table
-- Run in the Supabase SQL Editor.
-- ============================================================================

create table if not exists projects (
  id                  text        primary key,
  user_id             uuid        references auth.users(id) on delete cascade,
  title               text        not null,
  topic               text        not null,
  content_type        text        not null default 'educational',
  style               text        not null default 'documentary',
  target_audience     text        not null default 'general',
  video_length        int         not null default 10,
  tone                text        not null default 'conversational',
  retention_intensity int         not null default 7,
  platform            text        not null default 'youtube',
  research_notes      text,
  selected_angle      text,
  script              text,
  script_analysis     jsonb,
  visual_style        text,
  visual_bible        jsonb,
  lines               jsonb,
  voice_settings      jsonb,
  status              text        not null default 'draft',
  created_at          bigint      not null,
  updated_at          bigint      not null
);

create index if not exists idx_projects_user_id
  on projects (user_id, updated_at desc);

alter table projects enable row level security;

-- Service-role key bypasses RLS (used by API routes).
-- Anon / browser clients are locked to their own rows.
create policy "owner_all_projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
