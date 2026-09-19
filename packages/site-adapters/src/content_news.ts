import { BaseSiteAdapter, ExtractedSignal } from './base';
import { EventType, SiteCategory } from '@sara/shared';

export class GenericContentAdapter extends BaseSiteAdapter {
  name = 'Content & News Adapter';
  category: SiteCategory = 'content';

  matches(url: string): boolean {
    const contentDomains = [
      'medium.com',
      'dev.to',
      'wikipedia.org',
      'substack.com',
      'nytimes.com',
      'bbc.com',
      'cnn.com',
      'techcrunch.com',
      'theverge.com',
      'arstechnica.com',
      'github.com',
      'stackoverflow.com'
    ];
    return contentDomains.some((d) => url.toLowerCase().includes(d));
  }

  extract(url: string, pageMeta: Record<string, unknown>): ExtractedSignal | null {
    const title = (pageMeta.title as string) || (pageMeta.ogTitle as string) || 'Article';
    const searchQuery = (pageMeta.searchQuery as string) || undefined;
    const author = pageMeta.author as string | undefined;
    const articleCategory = pageMeta.articleCategory as string | undefined;

    if (searchQuery) {
      return {
        eventType: EventType.SEARCH,
        siteCategory: 'content',
        title: `Search: ${searchQuery}`,
        searchQuery,
        keywords: this.extractKeywords(searchQuery),
        metadata: { platform: 'Content/News', type: 'article_search' }
      };
    }

    const keywords = this.extractKeywords(title);
    if (articleCategory) keywords.push(articleCategory.toLowerCase());
    if (author) keywords.push(author.toLowerCase());

    return {
      eventType: EventType.CONTENT_VIEW,
      siteCategory: 'content',
      title: title.replace(/( \| | - ).*$/, ''), // Clean publication suffix
      keywords: Array.from(new Set(keywords)),
      metadata: {
        platform: 'Content/News',
        author: author || null,
        articleCategory: articleCategory || null,
        description: pageMeta.description || null,
        readTimeMinutes: pageMeta.readTimeMinutes || null
      }
    };
  }
}
