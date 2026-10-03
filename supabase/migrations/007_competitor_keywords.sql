-- Migration 007: Add channel_keywords to competitor_channels
-- Stores the space-separated keywords string from YouTube brandingSettings.channel.keywords
-- Split into an array for easier querying and display.
-- Run in the Supabase SQL Editor.

alter table competitor_channels
  add column if not exists channel_keywords  text[]  default '{}';

-- Also store raw topic category URLs for reference
alter table competitor_channels
  add column if not exists topic_categories  text[]  default '{}';

comment on column competitor_channels.channel_keywords is
  'Keywords set by the channel owner in YouTube Studio (brandingSettings.channel.keywords)';

comment on column competitor_channels.topic_categories is
  'YouTube topic category wiki URLs (contentDetails.topicCategories)';
