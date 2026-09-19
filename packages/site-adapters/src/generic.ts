import { BaseSiteAdapter, ExtractedSignal } from './base';
import { EventType, SiteCategory } from '@sara/shared';

export class GenericFallbackAdapter extends BaseSiteAdapter {
  name = 'Generic Fallback Adapter';
  category: SiteCategory = 'general';

  matches(_url: string): boolean {
    return true; // Universal fallback matching any web page
  }

  extract(url: string, pageMeta: Record<string, unknown>): ExtractedSignal | null {
    const rawTitle = (pageMeta.title as string) || (pageMeta.ogTitle as string) || 'Web Page';
    const searchQuery = (pageMeta.searchQuery as string) || this.parseSearchQueryFromUrl(url);
    const eventTypeOverride = pageMeta.eventType as EventType | undefined;

    if (searchQuery) {
      return {
        eventType: EventType.SEARCH,
        siteCategory: 'general',
        title: `Search: ${searchQuery}`,
        searchQuery,
        keywords: this.extractKeywords(searchQuery),
        metadata: { fallback: true, type: 'url_search' }
      };
    }

    const eventType = eventTypeOverride || EventType.PAGE_VIEW;

    return {
      eventType,
      siteCategory: 'general',
      title: rawTitle.trim(),
      keywords: this.extractKeywords(rawTitle),
      metadata: {
        fallback: true,
        description: pageMeta.description || null,
        scrollDepth: pageMeta.scrollDepth || null,
        durationMs: pageMeta.durationMs || null
      }
    };
  }

  private parseSearchQueryFromUrl(urlStr: string): string | undefined {
    try {
      const url = new URL(urlStr);
      const searchParams = url.searchParams;
      return searchParams.get('q') || searchParams.get('query') || searchParams.get('search') || searchParams.get('k') || undefined;
    } catch {
      return undefined;
    }
  }
}
