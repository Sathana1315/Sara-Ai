import React from 'react';
import ReactDOM from 'react-dom/client';
import { SaraOverlay } from '../overlay/SaraOverlay';
import { EventType } from '@sara/shared';

console.log('[SARA Content Script] Initialized on page:', window.location.href);

// Session ID persistence per tab/session context
function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('sara_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('sara_session_id', sid);
    }
    return sid;
  } catch {
    return 'session_' + Date.now();
  }
}

const currentSessionId = getOrCreateSessionId();
let pageLoadTime = Date.now();
let activeDwellMs = 0;
let lastDwellCheck = Date.now();
let isPageVisible = !document.hidden;
let maxScrollDepthPercent = 0;
const sentScrollMilestones = new Set<number>();
let hasSentDwellSignal = false;

function getSearchQueryFromDOM(): string | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('q') || urlParams.get('k') || urlParams.get('search_query') || urlParams.get('query') || undefined;
}

function getMetaTag(name: string): string | undefined {
  const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return el ? el.getAttribute('content') || undefined : undefined;
}

function extractYouTubeChannelName(): string | undefined {
  const channelEl = document.querySelector('#channel-name a, ytd-channel-name a, #owner #text a');
  return channelEl ? channelEl.textContent?.trim() : undefined;
}

function extractShoppingMetadata(): { price?: string; brand?: string; category?: string } {
  const priceEl = document.querySelector('.a-price .a-offscreen, [data-price], .price, #priceblock_ourprice');
  const brandEl = document.querySelector('#bylineInfo, [data-brand], .brand');
  const categoryEl = document.querySelector('#wayfinding-breadcrumbs_container, .breadcrumb');

  return {
    price: priceEl?.textContent?.trim(),
    brand: brandEl?.textContent?.trim(),
    category: categoryEl?.textContent?.trim()
  };
}

/**
 * Sends normalized behavior payload to extension background service worker.
 */
function sendBehaviorSignal(eventType?: EventType, extraMeta: Record<string, unknown> = {}) {
  const title = document.title;
  const url = window.location.href;
  const searchQuery = getSearchQueryFromDOM();
  const shoppingMeta = extractShoppingMetadata();
  const channelName = extractYouTubeChannelName();

  const pageMeta: Record<string, unknown> = {
    title,
    searchQuery,
    ogTitle: getMetaTag('og:title'),
    description: getMetaTag('description'),
    author: getMetaTag('author'),
    channelName,
    ...shoppingMeta,
    durationMs: activeDwellMs,
    scrollDepth: maxScrollDepthPercent / 100,
    eventType,
    ...extraMeta
  };

  chrome.runtime.sendMessage({
    type: 'SARA_INGEST_EVENT',
    payload: {
      url,
      title,
      sessionId: currentSessionId,
      pageMeta
    }
  });
}

// 1. Initial page view capture
function captureCurrentPageSignal() {
  sendBehaviorSignal();
}

// 2. Dwell Time tracking
document.addEventListener('visibilitychange', () => {
  const now = Date.now();
  if (document.hidden) {
    if (isPageVisible) {
      activeDwellMs += (now - lastDwellCheck);
      isPageVisible = false;
    }
  } else {
    lastDwellCheck = now;
    isPageVisible = true;
  }
});

// Periodic dwell check (after 15s of active dwell)
setInterval(() => {
  if (isPageVisible) {
    const now = Date.now();
    activeDwellMs += (now - lastDwellCheck);
    lastDwellCheck = now;
  }

  if (activeDwellMs >= 15000 && !hasSentDwellSignal) {
    hasSentDwellSignal = true;
    sendBehaviorSignal(EventType.DWELL_TIME, { durationMs: activeDwellMs });
  }
}, 5000);

// 3. Scroll depth milestone observer
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = Math.max(
    document.body.scrollHeight, document.documentElement.scrollHeight,
    document.body.offsetHeight, document.documentElement.offsetHeight
  ) - window.innerHeight;

  if (docHeight <= 0) return;

  const currentPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));
  if (currentPercent > maxScrollDepthPercent) {
    maxScrollDepthPercent = currentPercent;
  }

  const milestones = [25, 50, 75, 90];
  for (const m of milestones) {
    if (maxScrollDepthPercent >= m && !sentScrollMilestones.has(m)) {
      sentScrollMilestones.add(m);
      sendBehaviorSignal(EventType.SCROLL_MILESTONE, { scrollMilestone: m, scrollDepth: m / 100 });
    }
  }
}, { passive: true });

// 4. Media Event Listener (HTML5 Video & YouTube Player)
function attachMediaListeners() {
  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    if (video.dataset.saraTracked) return;
    video.dataset.saraTracked = 'true';

    video.addEventListener('play', () => {
      sendBehaviorSignal(EventType.MEDIA_PLAY);
    });

    video.addEventListener('ended', () => {
      sendBehaviorSignal(EventType.MEDIA_COMPLETE, { durationMs: Math.round(video.duration * 1000) });
    });
  });
}

setInterval(attachMediaListeners, 3000);

// 5. Mount SARA Floating UI in isolated Shadow DOM
function mountSaraOverlay() {
  if (document.getElementById('sara-assistant-root')) return;

  const container = document.createElement('div');
  container.id = 'sara-assistant-root';
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: 'open' });
  const shadowContainer = document.createElement('div');
  shadowRoot.appendChild(shadowContainer);

  const styleLink = document.createElement('style');
  styleLink.textContent = `
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    .sara-floating-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7C3AED 0%, #C084FC 100%);
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      border: 2px solid rgba(255,255,255,0.2);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .sara-floating-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 32px rgba(124, 58, 237, 0.6);
    }
    .sara-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #EF4444;
      color: white;
      font-size: 11px;
      font-weight: bold;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #0F0F17;
    }
    .sara-popover {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 360px;
      max-height: 520px;
      background: #0F0F17;
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 16px 48px rgba(0,0,0,0.8), 0 0 24px rgba(139, 92, 246, 0.2);
      border-radius: 16px;
      z-index: 999999;
      color: #E2E8F0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .sara-header {
      padding: 16px;
      background: linear-gradient(180deg, rgba(124,58,237,0.15) 0%, rgba(15,15,23,0) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sara-title { font-weight: 700; font-size: 15px; color: #F3E8FF; }
    .sara-content { padding: 16px; overflow-y: auto; flex: 1; }
    .sara-empty { text-align: center; color: #94A3B8; font-size: 13px; padding: 24px 12px; }
  `;
  shadowRoot.appendChild(styleLink);

  const root = ReactDOM.createRoot(shadowContainer);
  root.render(React.createElement(SaraOverlay));
}

// Run observers
setTimeout(() => {
  captureCurrentPageSignal();
  mountSaraOverlay();
  attachMediaListeners();
}, 1000);
