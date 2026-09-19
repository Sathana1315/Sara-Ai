import { BehaviorEvent, EventType, SiteCategory } from '@sara/shared';

export interface ExtractedSignal {
  eventType: EventType;
  siteCategory: SiteCategory;
  title: string;
  searchQuery?: string;
  keywords: string[];
  metadata: Record<string, unknown>;
}

export interface ISiteAdapter {
  name: string;
  category: SiteCategory;
  /**
   * Determines if this adapter handles the target URL.
   */
  matches(url: string): boolean;
  /**
   * Extracts recommendation-relevant signals from raw page context or document metadata.
   */
  extract(url: string, pageMeta: Record<string, unknown>): ExtractedSignal | null;
  /**
   * Normalizes an extracted signal into a standardized BehaviorEvent object.
   */
  normalize(signal: ExtractedSignal, userId: string, sessionId: string, url: string): BehaviorEvent;
}

export abstract class BaseSiteAdapter implements ISiteAdapter {
  abstract name: string;
  abstract category: SiteCategory;

  abstract matches(url: string): boolean;
  abstract extract(url: string, pageMeta: Record<string, unknown>): ExtractedSignal | null;

  normalize(signal: ExtractedSignal, userId: string, sessionId: string, url: string): BehaviorEvent {
    const parsedUrl = new URL(url);
    return {
      id: 'evt_' + Math.random().toString(36).substring(2, 11),
      userId,
      sessionId,
      eventType: signal.eventType,
      siteCategory: signal.siteCategory,
      domain: parsedUrl.hostname,
      url,
      title: signal.title,
      searchQuery: signal.searchQuery,
      keywords: signal.keywords,
      metadata: signal.metadata,
      timestamp: Date.now()
    };
  }

  protected extractKeywords(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 10);
  }
}
