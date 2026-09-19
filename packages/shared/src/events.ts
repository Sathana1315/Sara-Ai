/**
 * Standardized Behavior Event Taxonomy for SARA.
 * All site-specific actions are normalized into these event types.
 */
export enum EventType {
  PAGE_VIEW = 'PAGE_VIEW',
  SEARCH = 'SEARCH',
  CONTENT_VIEW = 'CONTENT_VIEW',
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  VIDEO_VIEW = 'VIDEO_VIEW',
  CLICK = 'CLICK',
  DWELL_TIME = 'DWELL_TIME',
  SCROLL_MILESTONE = 'SCROLL_MILESTONE',
  MEDIA_PLAY = 'MEDIA_PLAY',
  MEDIA_PAUSE = 'MEDIA_PAUSE',
  MEDIA_COMPLETE = 'MEDIA_COMPLETE',
  LONG_VIEW = 'LONG_VIEW',
  REPEATED_VIEW = 'REPEATED_VIEW',
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
  SKIP = 'SKIP',
  FEEDBACK = 'FEEDBACK'
}

export type SiteCategory = 'video' | 'shopping' | 'content' | 'music' | 'general';

