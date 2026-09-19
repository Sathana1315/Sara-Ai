import { describe, it, expect } from 'vitest';
import { AdapterRegistry, YouTubeAdapter, ShoppingAdapter, GenericContentAdapter, GenericFallbackAdapter } from '../index';

describe('Site Adapter Architecture', () => {
  const registry = new AdapterRegistry();

  it('selects YouTubeAdapter for YouTube watch & search URLs', () => {
    const adapter = registry.getAdapter('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(adapter.name).toBe('YouTube Adapter');
    expect(adapter.category).toBe('video');

    const signal = adapter.extract('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      title: 'Quantum Physics Explained - YouTube',
      channelName: 'ScienceChannel'
    });

    expect(signal).not.toBeNull();
    expect(signal?.title).toBe('Quantum Physics Explained');
    expect(signal?.keywords).toContain('quantum');
  });

  it('selects ShoppingAdapter for e-commerce store URLs', () => {
    const adapter = registry.getAdapter('https://www.amazon.com/dp/B08N5WRWNW');
    expect(adapter.name).toBe('E-Commerce / Shopping Adapter');
    expect(adapter.category).toBe('shopping');

    const signal = adapter.extract('https://www.amazon.com/dp/B08N5WRWNW', {
      title: 'Wireless Mechanical Keyboard',
      price: '$99.99',
      brand: 'Logitech'
    });

    expect(signal).not.toBeNull();
    expect(signal?.title).toBe('Wireless Mechanical Keyboard');
    expect(signal?.keywords).toContain('keyboard');
  });

  it('selects GenericContentAdapter for tech & news websites', () => {
    const adapter = registry.getAdapter('https://dev.to/author/react-19-features');
    expect(adapter.name).toBe('Content & News Adapter');
    expect(adapter.category).toBe('content');
  });

  it('selects GenericFallbackAdapter as universal fallback for arbitrary web pages', () => {
    const adapter = registry.getAdapter('https://some-random-blog.org/post-1');
    expect(adapter.name).toBe('Generic Fallback Adapter');
    expect(adapter.category).toBe('general');
  });
});
