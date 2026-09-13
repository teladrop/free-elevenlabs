/**
 * YouTube Data Utilities
 * 
 * Helper functions for parsing and formatting YouTube data
 */

/**
 * Parse YouTube ISO 8601 duration (PT4M13S) to seconds
 * 
 * Examples:
 * - PT4M13S → 253 seconds
 * - PT1H2M10S → 3730 seconds
 * - PT30S → 30 seconds
 */
export function parseDuration(duration: string): number {
  if (!duration || !duration.startsWith('PT')) {
    return 0;
  }
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds to human-readable duration
 * 
 * Examples:
 * - 253 → "4:13"
 * - 3730 → "1:02:10"
 * - 30 → "0:30"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  
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
 * Format large numbers with K/M/B suffixes
 * 
 * Examples:
 * - 1234 → "1.2K"
 * - 1234567 → "1.2M"
 * - 1234567890 → "1.2B"
 */
export function formatNumber(num: string | number): string {
  const n = typeof num === 'string' ? parseInt(num) : num;
  
  if (isNaN(n)) return '0';
  
  if (n >= 1000000000) {
    return (n / 1000000000).toFixed(1) + 'B';
  } else if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M';
  } else if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K';
  }
  
  return n.toString();
}

/**
 * Format number with commas
 * 
 * Examples:
 * - 1234 → "1,234"
 * - 1234567 → "1,234,567"
 */
export function formatNumberWithCommas(num: string | number): string {
  const n = typeof num === 'string' ? parseInt(num) : num;
  
  if (isNaN(n)) return '0';
  
  return n.toLocaleString();
}

/**
 * Calculate time ago from ISO date
 * 
 * Examples:
 * - 2 hours ago
 * - 3 days ago
 * - 2 weeks ago
 * - 1 month ago
 * - 2 years ago
 */
export function timeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) {
    return 'just now';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Calculate age in days from ISO date
 */
export function ageInDays(isoDate: string): number {
  const date = new Date(isoDate);
  const now = new Date();
  const milliseconds = now.getTime() - date.getTime();
  return Math.floor(milliseconds / (1000 * 60 * 60 * 24));
}

/**
 * Calculate views per day
 */
export function viewsPerDay(views: number, publishedAt: string): number {
  const days = ageInDays(publishedAt);
  if (days === 0) return views;
  return Math.round(views / days);
}

/**
 * Calculate engagement rate
 * (likes + comments) / views
 */
export function calculateEngagementRate(
  views: number,
  likes: number = 0,
  comments: number = 0
): number {
  if (views === 0) return 0;
  return ((likes + comments) / views) * 100;
}

/**
 * Safe parse integer from string
 */
export function safeParseInt(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = parseInt(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get video URL from ID
 */
export function getVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Get channel URL from ID
 */
export function getChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

/**
 * Get thumbnail URL (prefer high quality)
 */
export function getThumbnailUrl(thumbnails: any): string {
  return thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || '';
}

/**
 * Extract text from description (remove URLs, hashtags, etc.)
 */
export function cleanDescription(description: string, maxLength: number = 200): string {
  if (!description) return '';
  
  // Remove URLs
  let clean = description.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove hashtags
  clean = clean.replace(/#\w+/g, '');
  
  // Remove extra whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // Truncate
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength) + '...';
  }
  
  return clean;
}

/**
 * Format date to readable string
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Check if video is recent (within days)
 */
export function isRecent(isoDate: string, withinDays: number = 30): boolean {
  return ageInDays(isoDate) <= withinDays;
}

/**
 * Sort videos by views (descending)
 */
export function sortByViews<T extends { statistics: { viewCount: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => 
    safeParseInt(b.statistics.viewCount) - safeParseInt(a.statistics.viewCount)
  );
}

/**
 * Sort videos by date (newest first)
 */
export function sortByDate<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Calculate median from array of numbers
 */
export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    return sorted[middle];
  }
}

/**
 * Calculate average from array of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate percentile
 */
export function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
