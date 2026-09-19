import { BehaviorEvent, CandidateItem, EventType, UserProfile, InterestSignal } from '@sara/shared';

export interface ScoringWeights {
  contextRelevanceWeight: number; // 0.35
  userInterestWeight: number;     // 0.35
  recencyWeight: number;          // 0.20
  explorationWeight: number;      // 0.10
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  contextRelevanceWeight: 0.35,
  userInterestWeight: 0.35,
  recencyWeight: 0.20,
  explorationWeight: 0.10
};

// Event weight mapping for dynamic profile interest accumulation
const EVENT_WEIGHTS: Record<EventType, number> = {
  [EventType.SEARCH]: 1.6,
  [EventType.PRODUCT_VIEW]: 1.3,
  [EventType.VIDEO_VIEW]: 1.3,
  [EventType.CONTENT_VIEW]: 1.1,
  [EventType.DWELL_TIME]: 1.4,
  [EventType.SCROLL_MILESTONE]: 1.2,
  [EventType.MEDIA_PLAY]: 1.0,
  [EventType.MEDIA_PAUSE]: 0.5,
  [EventType.MEDIA_COMPLETE]: 2.0,
  [EventType.LONG_VIEW]: 1.8,
  [EventType.REPEATED_VIEW]: 2.2,
  [EventType.CLICK]: 1.1,
  [EventType.PAGE_VIEW]: 0.5,
  [EventType.LIKE]: 2.5,
  [EventType.DISLIKE]: -2.5,
  [EventType.SKIP]: -1.2,
  [EventType.FEEDBACK]: 2.0
};

export interface ProfileUpdateResult {
  updatedProfile: UserProfile;
  topicsUpdated: string[];
  totalScoreDelta: number;
}

/**
 * Dynamically updates a user profile based on a new behavior event.
 */
export function updateUserProfile(profile: UserProfile, event: BehaviorEvent): ProfileUpdateResult {
  const updatedProfile: UserProfile = JSON.parse(JSON.stringify(profile));
  const baseWeight = EVENT_WEIGHTS[event.eventType] !== undefined ? EVENT_WEIGHTS[event.eventType] : 1.0;
  const now = event.timestamp || Date.now();
  const topicsUpdated: string[] = [];
  let totalScoreDelta = 0;

  // Dwell time bonus multiplier if present
  let multiplier = 1.0;
  if (event.durationMs && event.durationMs > 10000) {
    multiplier = Math.min(2.0, 1.0 + (event.durationMs / 60000));
  }
  if (event.scrollDepth) {
    multiplier *= (0.8 + event.scrollDepth * 0.4);
  }

  const effectiveDelta = baseWeight * 0.1 * multiplier;

  for (const kw of event.keywords) {
    const key = kw.toLowerCase().trim();
    if (!key || key.length < 3) continue;

    const existingSignal = updatedProfile.interests[key];
    if (existingSignal) {
      // Calculate recency decay factor (half life = 7 days)
      const daysElapsed = (now - existingSignal.lastObserved) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-0.1 * daysElapsed);

      const newWeight = Math.min(1.0, Math.max(0.0, existingSignal.weight * decayFactor + effectiveDelta));
      const delta = newWeight - existingSignal.weight;
      const newInteractionCount = existingSignal.interactionCount + 1;

      updatedProfile.interests[key] = {
        ...existingSignal,
        weight: Math.round(newWeight * 1000) / 1000,
        confidence: Math.min(1.0, 0.5 + newInteractionCount * 0.05),
        decayFactor: Math.round(decayFactor * 1000) / 1000,
        lastObserved: now,
        interactionCount: newInteractionCount
      };
      topicsUpdated.push(key);
      totalScoreDelta += delta;
    } else if (effectiveDelta > 0) {
      const initialWeight = Math.min(1.0, Math.max(0.05, effectiveDelta));
      updatedProfile.interests[key] = {
        topic: key,
        category: event.siteCategory,
        weight: Math.round(initialWeight * 1000) / 1000,
        confidence: 0.5,
        decayFactor: 1.0,
        lastObserved: now,
        interactionCount: 1
      };
      topicsUpdated.push(key);
      totalScoreDelta += initialWeight;
    }
  }

  // Increment category counts
  const catCount = updatedProfile.topCategories[event.siteCategory] || 0;
  updatedProfile.topCategories[event.siteCategory] = catCount + 1;
  updatedProfile.totalEventsProcessed += 1;
  updatedProfile.updatedAt = now;

  return {
    updatedProfile,
    topicsUpdated,
    totalScoreDelta: Math.round(totalScoreDelta * 1000) / 1000
  };
}

/**
 * Calculates a dynamic recommendation score for a candidate item.
 */
export function scoreCandidateItem(
  candidate: CandidateItem,
  profile: UserProfile,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  let userInterestScore = 0;
  let matchingKeywordCount = 0;

  for (const kw of candidate.keywords) {
    const signal = profile.interests[kw.toLowerCase()];
    if (signal) {
      userInterestScore += signal.weight * signal.confidence;
      matchingKeywordCount++;
    }
  }

  const normalizedInterestScore = matchingKeywordCount > 0
    ? Math.min(1.0, userInterestScore / matchingKeywordCount)
    : 0.1;

  // Category & domain relevance score
  const categoryCount = profile.topCategories[candidate.category] || 0;
  const contextRelevanceScore = profile.totalEventsProcessed > 0
    ? Math.min(1.0, categoryCount / profile.totalEventsProcessed + 0.3)
    : 0.5;

  // Recency score (fresh items get exploration bonus)
  const recencyScore = 0.8;
  const explorationScore = 0.5;

  const totalScore =
    contextRelevanceScore * weights.contextRelevanceWeight +
    normalizedInterestScore * weights.userInterestWeight +
    recencyScore * weights.recencyWeight +
    explorationScore * weights.explorationWeight;

  return Math.round(Math.min(1.0, Math.max(0.0, totalScore)) * 100) / 100;
}
