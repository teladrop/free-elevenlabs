'use client';

/**
 * ChannelProvider — manages channel connection state globally
 *
 * Persists channel data (connection, videos, snapshots) across page navigation.
 * Data stays in memory for the session; when the user leaves and returns,
 * the page re-fetches from the server.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ChannelConnection {
  id: string;
  user_id: string;
  channel_id: string;
  youtube_channel_id: string;
  channel_handle: string;
  channel_title: string;
  channel_description: string;
  profile_image_url: string;
  thumbnail_url: string;                // alias for profile_image_url used in UI
  subscriber_count: number;
  video_count: number;
  view_count: number;
  category_tag?: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  synced_at: string;
  // UI-specific fields from the data API
  status: 'connected' | 'syncing' | 'synced' | 'sync_failed' | 'needs_reauth' | 'disconnected';
  connected_at: string;
  last_synced_at: string | null;
  sync_error: string | null;
}

export interface ChannelVideo {
  id: string;
  youtube_video_id: string;
  title: string;
  description: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;                // formatted duration string e.g. "10:23"
  duration_seconds: number;
  view_count: number;
  like_count: number;
  comment_count: number;
}

export interface ChannelSnapshot {
  id: string;
  connection_id: string;
  snapshot_date: string;
  subscriber_count: number;
  video_count: number;
  view_count: number;
}

interface ChannelContextType {
  connection: ChannelConnection | null;
  videos: ChannelVideo[];
  snapshots: ChannelSnapshot[];
  setConnection: (conn: ChannelConnection | null) => void;
  setVideos: (vids: ChannelVideo[]) => void;
  setSnapshots: (snaps: ChannelSnapshot[]) => void;
  clearAll: () => void;
}

const ChannelContext = createContext<ChannelContextType | null>(null);

export function ChannelProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [snapshots, setSnapshots] = useState<ChannelSnapshot[]>([]);

  const clearAll = useCallback(() => {
    setConnection(null);
    setVideos([]);
    setSnapshots([]);
  }, []);

  const value: ChannelContextType = {
    connection,
    videos,
    snapshots,
    setConnection,
    setVideos,
    setSnapshots,
    clearAll,
  };

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel(): ChannelContextType {
  const ctx = useContext(ChannelContext);
  if (!ctx) {
    throw new Error('useChannel must be used inside ChannelProvider');
  }
  return ctx;
}
