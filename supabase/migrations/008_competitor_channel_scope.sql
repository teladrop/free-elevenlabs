-- Migration 008: Scope competitors to a specific connected YouTube channel
-- Each user can have multiple connected channels over time.
-- Competitors should belong to the channel they were added under,
-- not just the user — so switching channels shows the right set.
-- Run in the Supabase SQL Editor.

alter table competitor_channels
  add column if not exists connected_channel_id text;

-- Back-fill existing rows with a placeholder so NOT NULL can be enforced later
-- (existing rows have no channel_id, they'll be re-added when needed)
update competitor_channels
  set connected_channel_id = 'legacy'
  where connected_channel_id is null;

-- Now make it NOT NULL
alter table competitor_channels
  alter column connected_channel_id set not null,
  alter column connected_channel_id set default 'unknown';

-- Drop the old unique constraint and replace with channel-scoped one
alter table competitor_channels
  drop constraint if exists uq_competitor_per_user;

alter table competitor_channels
  add constraint uq_competitor_per_user_channel
    unique (user_id, connected_channel_id, youtube_channel_id);

-- Index for fast lookup by user + connected channel
create index if not exists idx_cc_user_channel
  on competitor_channels (user_id, connected_channel_id);
