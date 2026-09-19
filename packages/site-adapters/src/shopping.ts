import { BaseSiteAdapter, ExtractedSignal } from './base';
import { EventType, SiteCategory } from '@sara/shared';

export class ShoppingAdapter extends BaseSiteAdapter {
  name = 'E-Commerce / Shopping Adapter';
  category: SiteCategory = 'shopping';

  matches(url: string): boolean {
    const shoppingDomains = [
      'amazon.', 'flipkart.', 'ebay.', 'myntra.', 'walmart.', 'target.',
      'bestbuy.', 'etsy.', 'shopify.', 'store', 'shop'
    ];
    const lowerUrl = url.toLowerCase();
    return shoppingDomains.some((d) => lowerUrl.includes(d));
  }

  extract(url: string, pageMeta: Record<string, unknown>): ExtractedSignal | null {
    const rawTitle = (pageMeta.title as string) || (pageMeta.ogTitle as string) || 'Shopping Item';
    const searchQuery = (pageMeta.searchQuery as string) || this.extractSearchFromUrl(url);
    const eventTypeOverride = pageMeta.eventType as EventType | undefined;

    if (searchQuery || url.includes('/s?') || url.includes('/search')) {
      const q = searchQuery || rawTitle;
      return {
        eventType: EventType.SEARCH,
        siteCategory: 'shopping',
        title: `Product Search: ${q}`,
        searchQuery: q,
        keywords: this.extractKeywords(q),
        metadata: { platform: 'E-Commerce', type: 'product_search' }
      };
    }

    const cleanTitle = rawTitle.replace(/ (:\s*|\||-).*$/, '').trim();
    const brand = pageMeta.brand as string | undefined;
    const category = pageMeta.productCategory as string | undefined;

    const keywords = this.extractKeywords(cleanTitle);
    if (brand) keywords.push(brand.toLowerCase());
    if (category) keywords.push(category.toLowerCase());

    const eventType = eventTypeOverride || EventType.PRODUCT_VIEW;

    return {
      eventType,
      siteCategory: 'shopping',
      title: cleanTitle,
      keywords: Array.from(new Set(keywords)),
      metadata: {
        platform: 'E-Commerce',
        price: pageMeta.price || null,
        productCategory: category || null,
        brand: brand || null,
        productId: pageMeta.productId || this.extractProductIdFromUrl(url) || null
      }
    };
  }

  private extractSearchFromUrl(urlStr: string): string | undefined {
    try {
      const url = new URL(urlStr);
      return url.searchParams.get('k') || url.searchParams.get('q') || url.searchParams.get('field-keywords') || undefined;
    } catch {
      return undefined;
    }
  }

  private extractProductIdFromUrl(urlStr: string): string | undefined {
    // Amazon ASIN match (/dp/B0... or /gp/product/B0...)
    const asinMatch = urlStr.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch) return asinMatch[1];
    return undefined;
  }
}
