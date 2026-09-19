import { ISiteAdapter } from './base';
import { YouTubeAdapter } from './youtube';
import { ShoppingAdapter } from './shopping';
import { GenericContentAdapter } from './content_news';
import { GenericFallbackAdapter } from './generic';

export class AdapterRegistry {
  private adapters: ISiteAdapter[] = [];
  private fallbackAdapter: ISiteAdapter;

  constructor() {
    this.fallbackAdapter = new GenericFallbackAdapter();
    // Priority order: YouTube -> Shopping -> Content/News -> Fallback
    this.register(new YouTubeAdapter());
    this.register(new ShoppingAdapter());
    this.register(new GenericContentAdapter());
  }

  register(adapter: ISiteAdapter): void {
    this.adapters.unshift(adapter); // Priority to latest registered
  }

  getAdapter(url: string): ISiteAdapter {
    for (const adapter of this.adapters) {
      if (adapter.matches(url)) {
        return adapter;
      }
    }
    return this.fallbackAdapter;
  }
}
