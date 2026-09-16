/**
 * YouTube Data API v3 Service
 * Official API integration for video and channel research
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

// API key check now happens at runtime, not at module load time
// This allows the module to be imported during build without requiring the API key

/**
 * Handle YouTube API fetch errors with proper error messages
 */
async function handleYouTubeResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 429) {
      throw new Error('YouTube API quota exceeded (429). Daily limit of 10,000 units reached. Resets at midnight Pacific Time.');
    }
    
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`YouTube API error (${response.status}): ${errorMessage}`);
  }
  
  return response.json();
}

/**
 * Check if API key is configured - throw error at runtime if not
 */
function ensureAPIKey() {
  if (!API_KEY) {
    throw new Error('YOUTUBE_API_KEY is not configured in environment variables');
  }
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails: {
    duration: string;
  };
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
  statistics: {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
  };
  contentDetails: {
    relatedPlaylists: {
      uploads: string;
    };
  };
}

export interface SearchResult {
  videos: YouTubeVideo[];
  channels: YouTubeChannel[];
  totalResults: number;
}

/**
 * Search for videos by keyword
 */
export async function searchVideos(
  query: string,
  maxResults: number = 25,
  order: 'relevance' | 'date' | 'rating' | 'viewCount' = 'relevance'
): Promise<YouTubeVideo[]> {
  ensureAPIKey(); // Runtime check
  
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: maxResults.toString(),
    order,
    key: API_KEY!,
  });

  const searchResponse = await fetch(
    `${YOUTUBE_API_BASE}/search?${searchParams}`
  );
  
  const searchData = await handleYouTubeResponse(searchResponse);
  
  if (searchData.items.length === 0) {
    return [];
  }

  // Get video IDs for detailed info
  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
  
  // Get detailed video information
  const detailsParams = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: videoIds,
    key: API_KEY!,
  });

  const detailsResponse = await fetch(
    `${YOUTUBE_API_BASE}/videos?${detailsParams}`
  );
  
  const detailsData = await handleYouTubeResponse(detailsResponse);
  
  return detailsData.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnails: item.snippet.thumbnails,
    statistics: item.statistics,
    contentDetails: item.contentDetails,
  }));
}

/**
 * Search for channels by keyword
 */
export async function searchChannels(
  query: string,
  maxResults: number = 25,
  order: 'relevance' | 'date' | 'rating' | 'viewCount' = 'relevance'
): Promise<YouTubeChannel[]> {
  ensureAPIKey(); // Runtime check
  
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'channel',
    maxResults: maxResults.toString(),
    order,
    key: API_KEY!,
  });

  const searchResponse = await fetch(
    `${YOUTUBE_API_BASE}/search?${searchParams}`
  );
  
  const searchData = await handleYouTubeResponse(searchResponse);
  
  if (searchData.items.length === 0) {
    return [];
  }

  // Get channel IDs for detailed info
  const channelIds = searchData.items.map((item: any) => item.id.channelId).join(',');
  
  // Get detailed channel information
  const detailsParams = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: channelIds,
    key: API_KEY!,
  });

  const detailsResponse = await fetch(
    `${YOUTUBE_API_BASE}/channels?${detailsParams}`
  );
  
  const detailsData = await handleYouTubeResponse(detailsResponse);
  
  return detailsData.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails: item.snippet.thumbnails,
    statistics: item.statistics,
    contentDetails: item.contentDetails,
  }));
}

/**
 * Get channel details by ID
 */
export async function getChannelDetails(channelId: string): Promise<YouTubeChannel> {
  ensureAPIKey(); // Runtime check
  
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: channelId,
    key: API_KEY!,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);
  const data = await handleYouTubeResponse(response);
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Channel not found');
  }

  const item = data.items[0];
  
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails: item.snippet.thumbnails,
    statistics: item.statistics,
    contentDetails: item.contentDetails,
  };
}

/**
 * Get recent videos from a channel
 */
export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10
): Promise<YouTubeVideo[]> {
  ensureAPIKey(); // Runtime check
  
  // First get the uploads playlist ID
  const channel = await getChannelDetails(channelId);
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  // Get videos from uploads playlist
  const playlistParams = new URLSearchParams({
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: maxResults.toString(),
    key: API_KEY!,
  });

  const playlistResponse = await fetch(
    `${YOUTUBE_API_BASE}/playlistItems?${playlistParams}`
  );
  
  const playlistData = await handleYouTubeResponse(playlistResponse);
  
  if (playlistData.items.length === 0) {
    return [];
  }

  // Get video IDs for detailed info
  const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');
  
  // Get detailed video information
  const detailsParams = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: videoIds,
    key: API_KEY!,
  });

  const detailsResponse = await fetch(
    `${YOUTUBE_API_BASE}/videos?${detailsParams}`
  );
  
  const detailsData = await handleYouTubeResponse(detailsResponse);
  
  return detailsData.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnails: item.snippet.thumbnails,
    statistics: item.statistics,
    contentDetails: item.contentDetails,
  }));
}

/**
 * Comprehensive search that returns both videos and channels
 */
export async function comprehensiveSearch(
  query: string,
  videoLimit: number = 25,
  channelLimit: number = 10
): Promise<SearchResult> {
  ensureAPIKey(); // Runtime check
  
  const [videos, channels] = await Promise.all([
    searchVideos(query, videoLimit),
    searchChannels(query, channelLimit),
  ]);

  return {
    videos,
    channels,
    totalResults: videos.length + channels.length,
  };
}

/**
 * Parse YouTube duration (PT4M13S) to seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;

  const hours = (match[1] ? parseInt(match[1]) : 0);
  const minutes = (match[2] ? parseInt(match[2]) : 0);
  const seconds = (match[3] ? parseInt(match[3]) : 0);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format duration seconds to human readable
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Format large numbers (1000 -> 1K, 1000000 -> 1M)
 */
export function formatNumber(num: string | number): string {
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M';
  } else if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K';
  }
  return n.toString();
}