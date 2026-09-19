import { describe, it, expect } from 'vitest';
import { updateUserProfile, scoreCandidateItem, generateLearningExplanation } from '../index';
import { BehaviorEvent, EventType, UserProfile, CandidateItem } from '@sara/shared';

describe('Adaptive Recommendation Engine', () => {
  const initialProfile: UserProfile = {
    userId: 'user_123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    interests: {},
    totalEventsProcessed: 0,
    topCategories: { video: 0, shopping: 0, music: 0, content: 0, general: 0 }
  };

  it('updates profile weights dynamically from video view event', () => {
    const event: BehaviorEvent = {
      id: 'evt_1',
      userId: 'user_123',
      sessionId: 'sess_1',
      eventType: EventType.VIDEO_VIEW,
      siteCategory: 'video',
      domain: 'youtube.com',
      url: 'https://youtube.com/watch?v=123',
      title: 'Deep Learning with Python Tutorial',
      keywords: ['deep', 'learning', 'python', 'tutorial'],
      metadata: {},
      timestamp: Date.now()
    };

    const { updatedProfile, topicsUpdated, totalScoreDelta } = updateUserProfile(initialProfile, event);

    expect(topicsUpdated).toContain('learning');
    expect(topicsUpdated).toContain('python');
    expect(updatedProfile.interests['python'].weight).toBeGreaterThan(0);
    expect(totalScoreDelta).toBeGreaterThan(0);
    expect(updatedProfile.totalEventsProcessed).toBe(1);
  });

  it('applies dwell time and scroll depth multipliers to interest weight delta', () => {
    const event: BehaviorEvent = {
      id: 'evt_2',
      userId: 'user_123',
      sessionId: 'sess_1',
      eventType: EventType.DWELL_TIME,
      siteCategory: 'content',
      domain: 'medium.com',
      url: 'https://medium.com/quantum-computing',
      title: 'Quantum Computing Frontiers',
      keywords: ['quantum', 'computing', 'frontiers'],
      metadata: {},
      timestamp: Date.now(),
      durationMs: 45000,
      scrollDepth: 0.9
    };

    const { updatedProfile } = updateUserProfile(initialProfile, event);
    expect(updatedProfile.interests['quantum'].weight).toBeGreaterThan(0.1);
  });

  it('scores candidate items according to profile interest alignment', () => {
    const profileWithInterests: UserProfile = {
      ...initialProfile,
      interests: {
        python: { topic: 'python', category: 'video', weight: 0.8, confidence: 0.9, decayFactor: 1.0, lastObserved: Date.now(), interactionCount: 5 }
      }
    };

    const candidate: CandidateItem = {
      id: 'item_1',
      title: 'Advanced Python Data Science',
      description: 'Master python data analysis',
      url: 'https://example.com/python',
      category: 'video',
      domain: 'youtube.com',
      keywords: ['python', 'data', 'science']
    };

    const score = scoreCandidateItem(candidate, profileWithInterests);
    expect(score).toBeGreaterThan(0.4);
  });

  it('generates explainable audit explanations for learning history', () => {
    const event: BehaviorEvent = {
      id: 'evt_3',
      userId: 'user_123',
      sessionId: 'sess_1',
      eventType: EventType.SEARCH,
      siteCategory: 'video',
      domain: 'youtube.com',
      url: 'https://youtube.com/results?search_query=astrophysics',
      title: 'Search: astrophysics',
      searchQuery: 'astrophysics',
      keywords: ['astrophysics'],
      metadata: {},
      timestamp: Date.now()
    };

    const explanation = generateLearningExplanation(event, ['astrophysics'], 0.16);
    expect(explanation).toContain('astrophysics');
    expect(explanation).toContain('youtube.com');
  });
});
