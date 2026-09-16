-- ============================================================================
-- Migration 005 — Scope script_history and visual_history per user
-- Run in the Supabase SQL Editor.
-- ============================================================================

-- ─── 1. Add user_id column to script_history ─────────────────────────────────
alter table script_history
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Index for fast per-user queries
create index if not exists idx_script_history_user_id
  on script_history (user_id, created_at desc);

-- ─── 2. Add user_id column to visual_history ─────────────────────────────────
alter table visual_history
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_visual_history_user_id
  on visual_history (user_id, created_at desc);

-- ─── 3. Drop old open-access RLS policies ────────────────────────────────────
drop policy if exists "allow all" on script_history;
drop policy if exists "allow all" on visual_history;

-- ─── 4. Enable RLS (safe to run even if already enabled) ─────────────────────
alter table script_history  enable row level security;
alter table visual_history  enable row level security;

-- ─── 5. New policies — each user sees only their own rows ────────────────────
create policy "owner_all_script_history" on script_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_all_visual_history" on visual_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 6. Service-role key bypasses RLS ────────────────────────────────────────
-- Our API routes use the service-role key, so they can still read/write on
-- behalf of any user by setting user_id explicitly in queries.
-- The anon client (browser) is now locked down — users only see their own data.
