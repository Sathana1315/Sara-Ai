import { BaseSiteAdapter, ExtractedSignal } from './base';
import { EventType, SiteCategory } from '@sara/shared';

export class YouTubeAdapter extends BaseSiteAdapter {
  name = 'YouTube Adapter';
  category: SiteCategory = 'video';

  matches(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  extract(url: string, pageMeta: Record<string, unknown>): ExtractedSignal | null {
    const rawTitle = (pageMeta.title as string) || 'YouTube Video';
    const searchQuery = (pageMeta.searchQuery as string) || this.extractSearchFromUrl(url);
    const eventTypeOverride = pageMeta.eventType as EventType | undefined;

    if ((url.includes('/results') || searchQuery) && !url.includes('/watch')) {
      const q = searchQuery || 'Video Search';
      return {
        eventType: EventType.SEARCH,
        siteCategory: 'video',
        title: `Search: ${q}`,
        searchQuery: q,
        keywords: this.extractKeywords(q),
        metadata: { platform: 'YouTube', type: 'search' }
      };
    }

    if (url.includes('/watch')) {
      const videoId = this.extractVideoId(url) || (pageMeta.videoId as string);
      const cleanTitle = rawTitle.replace(/ - YouTube$/, '').trim();
      const channelName = pageMeta.channelName as string | undefined;
      const category = pageMeta.category as string | undefined;

      const keywords = this.extractKeywords(cleanTitle);
      if (channelName) keywords.push(channelName.toLowerCase().replace(/\s+/g, ''));
      if (category) keywords.push(category.toLowerCase());

      const eventType = eventTypeOverride || EventType.VIDEO_VIEW;

      return {
        eventType,
        siteCategory: 'video',
        title: cleanTitle,
        keywords: Array.from(new Set(keywords)),
        metadata: {
          platform: 'YouTube',
          videoId,
          channelName: channelName || null,
          category: category || null,
          durationMs: pageMeta.durationMs || null,
          scrollDepth: pageMeta.scrollDepth || null,
          watchTimeSeconds: pageMeta.watchTimeSeconds || null
        }
      };
    }

    return {
      eventType: EventType.PAGE_VIEW,
      siteCategory: 'video',
      title: rawTitle.replace(/ - YouTube$/, ''),
      keywords: this.extractKeywords(rawTitle),
      metadata: { platform: 'YouTube' }
    };
  }

  private extractVideoId(urlStr: string): string | undefined {
    try {
      const url = new URL(urlStr);
      return url.searchParams.get('v') || undefined;
    } catch {
      return undefined;
    }
  }

  private extractSearchFromUrl(urlStr: string): string | undefined {
    try {
      const url = new URL(urlStr);
      return url.searchParams.get('search_query') || undefined;
    } catch {
      return undefined;
    }
  }
}
