import { CandidateItem, SiteCategory } from '@sara/shared';

/**
 * Normalizes URLs for accurate string matching (strips protocol, trailing slashes, www).
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Contextual Filter to separate Current-Site recommendations (shown in floating UI)
 * from Global recommendations (shown in main dashboard).
 */
export function filterCandidatesByContext(
  candidates: CandidateItem[],
  currentDomain?: string,
  currentCategory?: SiteCategory
): CandidateItem[] {
  if (!currentDomain && !currentCategory) {
    return candidates;
  }

  return candidates.filter((item) => {
    // Domain exact match
    if (currentDomain && item.domain.toLowerCase() === currentDomain.toLowerCase()) {
      return true;
    }
    // Category match
    if (currentCategory && item.category === currentCategory) {
      return true;
    }
    return false;
  });
}

/**
 * Excludes candidates that the user has already consumed.
 */
export function filterConsumedCandidates(
  candidates: CandidateItem[],
  consumedUrls: Set<string> | string[]
): CandidateItem[] {
  if (!consumedUrls) return candidates;
  const consumedSet = consumedUrls instanceof Set ? consumedUrls : new Set(consumedUrls);
  if (consumedSet.size === 0) return candidates;

  const normalizedConsumed = new Set<string>();
  for (const rawUrl of consumedSet) {
    if (rawUrl) normalizedConsumed.add(normalizeUrl(rawUrl));
  }

  return candidates.filter((candidate) => {
    const candidateNorm = normalizeUrl(candidate.url);
    return !normalizedConsumed.has(candidateNorm);
  });
}

/**
 * Applies explainable diversity capping (Topic Bounding).
 *
 * INVARIANT: The returned list must never contain more than
 *   maxPerTopic = Math.max(1, Math.floor(targetCount × maxTopicShare))
 * items sharing the same primary keyword topic.
 *
 * This invariant holds over the FINAL returned list, not only during
 * intermediate processing steps.
 *
 * Algorithm (single-pass greedy):
 * - Iterate candidates in descending score order.
 * - Accept a candidate only if its primary topic count is below maxPerTopic.
 * - Stop when targetCount accepted items are collected OR candidates are exhausted.
 * - If the candidate pool is too small to fill targetCount without violating the cap:
 *     → Return fewer items (Option A). The cap is NEVER violated.
 *
 * Max-per-topic formula:
 *   maxPerTopic = Math.max(1, Math.floor(targetCount × maxTopicShare))
 *
 * Why floor (not ceil)?
 *   floor guarantees the ratio stays ≤ maxTopicShare.
 *   Example: targetCount=10, maxTopicShare=0.40 → floor(4.0)=4 → 4/10=40% ✓
 *            ceil would give the same here, but for maxTopicShare=0.39:
 *            floor(10×0.39)=floor(3.9)=3 → 3/10=30% ✓  (conservative, correct)
 *            ceil(10×0.39)=ceil(3.9)=4  → 4/10=40% ✗  (exceeds configured share)
 *
 * Why Math.max(1, ...)?
 *   Prevents zero maxPerTopic for very small targetCount values
 *   (e.g. targetCount=1, maxTopicShare=0.1 → floor(0.1)=0 → clamped to 1).
 *   This ensures at least one item per topic rather than returning nothing,
 *   accepting that 1/1 = 100% share for a single-item result is unavoidable.
 *
 * Score, explanation, content item ID, and ordering are preserved for all
 * accepted candidates — only the selection set is affected.
 */
export function applyDiversityFilter<T extends { candidate: CandidateItem; score: number }>(
  scoredItems: T[],
  targetCount: number = 20,
  maxTopicShare: number = 0.4
): T[] {
  if (scoredItems.length === 0) return [];
  if (scoredItems.length === 1) return scoredItems;

  // Compute cap per topic using floor to guarantee the invariant
  const maxPerTopic = Math.max(1, Math.floor(targetCount * maxTopicShare));

  const topicCounts: Record<string, number> = {};
  const accepted: T[] = [];

  // Single pass: accept in descending score order, reject cap violators
  for (const item of scoredItems) {
    if (accepted.length >= targetCount) break;

    const primaryTopic =
      item.candidate.keywords && item.candidate.keywords.length > 0
        ? item.candidate.keywords[0].toLowerCase()
        : item.candidate.category;

    const currentCount = topicCounts[primaryTopic] || 0;

    if (currentCount < maxPerTopic) {
      accepted.push(item);
      topicCounts[primaryTopic] = currentCount + 1;
    }
    // Items exceeding the per-topic cap are permanently excluded.
    // No backfill from overflow — that would violate the invariant.
  }

  return accepted;
}

