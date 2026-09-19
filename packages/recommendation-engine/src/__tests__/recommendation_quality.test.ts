import { describe, it, expect } from 'vitest';
import {
  updateUserProfile,
  scoreCandidateItem,
  filterCandidatesByContext,
  filterConsumedCandidates,
  applyDiversityFilter,
  generateExplanation,
  normalizeUrl
} from '../index';
import { BehaviorEvent, EventType, UserProfile, CandidateItem } from '@sara/shared';

describe('Recommendation Engine Quality & Diversity Suite', () => {
  const emptyProfile: UserProfile = {
    userId: 'user_test_1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    interests: {},
    totalEventsProcessed: 0,
    topCategories: { video: 0, shopping: 0, music: 0, content: 0, general: 0 }
  };

  // A. Consumed-item exclusion
  it('A. excludes exact consumed items while retaining unconsumed candidate items', () => {
    const candidates: CandidateItem[] = [
      { id: '1', title: 'Quantum Computing 101', description: '', url: 'https://youtube.com/watch?v=watched1', category: 'video', domain: 'youtube.com', keywords: ['quantum'] },
      { id: '2', title: 'Advanced Quantum Algorithms', description: '', url: 'https://youtube.com/watch?v=new_quantum_2', category: 'video', domain: 'youtube.com', keywords: ['quantum', 'algorithms'] }
    ];

    const consumedUrls = new Set(['https://youtube.com/watch?v=watched1']);
    const filtered = filterConsumedCandidates(candidates, consumedUrls);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });

  // B. Related-item recommendation
  it('B. recommends related topic candidates after consuming initial item', () => {
    const profileWithInterest: UserProfile = {
      ...emptyProfile,
      interests: {
        quantum: { topic: 'quantum', category: 'video', weight: 0.8, confidence: 0.8, decayFactor: 1.0, lastObserved: Date.now(), interactionCount: 3 }
      }
    };

    const relatedCandidate: CandidateItem = {
      id: '2',
      title: 'Quantum Entanglement & Superposition',
      description: '',
      url: 'https://youtube.com/watch?v=quantum_related',
      category: 'video',
      domain: 'youtube.com',
      keywords: ['quantum', 'physics']
    };

    const score = scoreCandidateItem(relatedCandidate, profileWithInterest);
    expect(score).toBeGreaterThan(0.3);
  });

  // C. Interest-based scoring
  it('C. scores items higher when matching strong learned user interests', () => {
    const weakProfile: UserProfile = { ...emptyProfile };
    const strongProfile: UserProfile = {
      ...emptyProfile,
      interests: {
        cybersecurity: { topic: 'cybersecurity', category: 'video', weight: 0.9, confidence: 0.9, decayFactor: 1.0, lastObserved: Date.now(), interactionCount: 10 }
      }
    };

    const candidate: CandidateItem = {
      id: 'cyber_1',
      title: 'Cybersecurity Threat Intelligence',
      description: '',
      url: 'https://example.com/cyber',
      category: 'video',
      domain: 'youtube.com',
      keywords: ['cybersecurity', 'threat']
    };

    const weakScore = scoreCandidateItem(candidate, weakProfile);
    const strongScore = scoreCandidateItem(candidate, strongProfile);

    expect(strongScore).toBeGreaterThan(weakScore);
  });

  // D. Feedback adjustment: LIKE event type raises interest weight via updateUserProfile
  //    (Backend feedback route separately applies +0.20 directly to user_interests;
  //     this test verifies the engine's LIKE event weight multiplier via updateUserProfile)
  it('D. reinforces profile weight when a LIKE event matches an existing interest topic', () => {
    const initialProfile: UserProfile = {
      ...emptyProfile,
      interests: {
        machine: { topic: 'machine', category: 'video', weight: 0.5, confidence: 0.5, decayFactor: 1.0, lastObserved: Date.now(), interactionCount: 2 }
      }
    };

    const likeEvent: BehaviorEvent = {
      id: 'like_1',
      userId: 'user_test_1',
      sessionId: 'sess_1',
      eventType: EventType.LIKE,
      siteCategory: 'video',
      domain: 'youtube.com',
      url: 'https://youtube.com/watch?v=ml_video',
      title: 'Machine Learning Overview',
      keywords: ['machine', 'learning'],
      metadata: {},
      timestamp: Date.now()
    };

    const { updatedProfile } = updateUserProfile(initialProfile, likeEvent);
    // LIKE event weight = 2.5 → effectiveDelta = 2.5 * 0.1 = 0.25
    // newWeight = 0.5 * 1.0 (no decay) + 0.25 = 0.75
    expect(updatedProfile.interests['machine'].weight).toBeGreaterThan(0.5);
  });

  // E. Recency & decay
  it('E. applies exponential time decay to older unobserved interest signals', () => {
    const pastTimestamp = Date.now() - (14 * 24 * 60 * 60 * 1000); // 14 days ago
    const agedProfile: UserProfile = {
      ...emptyProfile,
      interests: {
        oldtopic: { topic: 'oldtopic', category: 'video', weight: 0.8, confidence: 0.8, decayFactor: 1.0, lastObserved: pastTimestamp, interactionCount: 5 }
      }
    };

    const newEvent: BehaviorEvent = {
      id: 'evt_new',
      userId: 'user_test_1',
      sessionId: 'sess_1',
      eventType: EventType.VIDEO_VIEW,
      siteCategory: 'video',
      domain: 'youtube.com',
      url: 'https://youtube.com/watch?v=oldtopic',
      title: 'Old Topic Refresh',
      keywords: ['oldtopic'],
      metadata: {},
      timestamp: Date.now()
    };

    const { updatedProfile } = updateUserProfile(agedProfile, newEvent);
    // Decay factor should be less than 1.0 after 14 days
    expect(updatedProfile.interests['oldtopic'].decayFactor).toBeLessThan(0.8);
  });

  // F. Exploration vs exploitation
  it('F. provides non-zero baseline score for unexplored candidate categories', () => {
    const candidate: CandidateItem = {
      id: 'exp_1',
      title: 'Unexplored Topic Item',
      description: '',
      url: 'https://example.com/unexplored',
      category: 'content',
      domain: 'medium.com',
      keywords: ['unexplored', 'novelty']
    };

    const score = scoreCandidateItem(candidate, emptyProfile);
    expect(score).toBeGreaterThan(0.0);
  });

  // G. Diversity capping — basic correctness
  // targetCount=10, maxTopicShare=0.40 → maxPerTopic = floor(10×0.40) = floor(4.0) = 4
  // 5 quantum + 5 cyber → quantum capped at 4, cyber capped at 4 → 8 total
  it('G. caps dominant primary topics to prevent topic flooding in top recommendations', () => {
    const scoredItems: Array<{ candidate: CandidateItem; score: number }> = [
      { candidate: { id: 'q1', title: 'Quantum 1', description: '', url: 'u1', category: 'video', domain: 'yt.com', keywords: ['quantum'] }, score: 0.95 },
      { candidate: { id: 'q2', title: 'Quantum 2', description: '', url: 'u2', category: 'video', domain: 'yt.com', keywords: ['quantum'] }, score: 0.90 },
      { candidate: { id: 'q3', title: 'Quantum 3', description: '', url: 'u3', category: 'video', domain: 'yt.com', keywords: ['quantum'] }, score: 0.85 },
      { candidate: { id: 'q4', title: 'Quantum 4', description: '', url: 'u4', category: 'video', domain: 'yt.com', keywords: ['quantum'] }, score: 0.82 },
      { candidate: { id: 'q5', title: 'Quantum 5', description: '', url: 'u5', category: 'video', domain: 'yt.com', keywords: ['quantum'] }, score: 0.80 },
      { candidate: { id: 'c1', title: 'Cyber 1', description: '', url: 'u6', category: 'video', domain: 'yt.com', keywords: ['cyber'] }, score: 0.78 },
      { candidate: { id: 'c2', title: 'Cyber 2', description: '', url: 'u7', category: 'video', domain: 'yt.com', keywords: ['cyber'] }, score: 0.75 },
      { candidate: { id: 'c3', title: 'Cyber 3', description: '', url: 'u8', category: 'video', domain: 'yt.com', keywords: ['cyber'] }, score: 0.72 },
      { candidate: { id: 'c4', title: 'Cyber 4', description: '', url: 'u9', category: 'video', domain: 'yt.com', keywords: ['cyber'] }, score: 0.70 },
      { candidate: { id: 'c5', title: 'Cyber 5', description: '', url: 'u10', category: 'video', domain: 'yt.com', keywords: ['cyber'] }, score: 0.68 }
    ];

    // maxPerTopic = floor(10 × 0.40) = 4
    const diverse = applyDiversityFilter(scoredItems, 10, 0.4);
    const quantumCount = diverse.filter(i => i.candidate.keywords[0] === 'quantum').length;
    const cyberCount = diverse.filter(i => i.candidate.keywords[0] === 'cyber').length;

    expect(quantumCount).toBeLessThanOrEqual(4);
    expect(cyberCount).toBeLessThanOrEqual(4);
    expect(diverse).toHaveLength(8); // 4 quantum + 4 cyber (all fit within caps)
  });

  // H. Cold start
  it('H. handles zero-history cold start profile gracefully', () => {
    const candidate: CandidateItem = {
      id: 'cold_1',
      title: 'Trending Technology News',
      description: '',
      url: 'https://example.com/tech',
      category: 'content',
      domain: 'tech.com',
      keywords: ['tech']
    };

    const score = scoreCandidateItem(candidate, emptyProfile);
    const explanation = generateExplanation(candidate, emptyProfile, score);

    expect(score).toBeGreaterThan(0.0);
    expect(explanation.primaryReason).toBeDefined();
  });

  // I. Context/site filtering
  it('I. filters candidate items matching current browsing domain for floating overlay view', () => {
    const candidates: CandidateItem[] = [
      { id: 'yt1', title: 'YouTube Video', description: '', url: 'https://youtube.com/watch?v=1', category: 'video', domain: 'youtube.com', keywords: ['yt'] },
      { id: 'amz1', title: 'Amazon Book', description: '', url: 'https://amazon.com/dp/1', category: 'shopping', domain: 'amazon.com', keywords: ['book'] }
    ];

    const ytFiltered = filterCandidatesByContext(candidates, 'youtube.com');
    expect(ytFiltered).toHaveLength(1);
    expect(ytFiltered[0].domain).toBe('youtube.com');
  });

  // J. Explanation correctness
  it('J. generates clear, data-backed explanations reflecting actual interest matches', () => {
    const profile: UserProfile = {
      ...emptyProfile,
      interests: {
        robotics: { topic: 'robotics', category: 'video', weight: 0.9, confidence: 0.85, decayFactor: 1.0, lastObserved: Date.now(), interactionCount: 5 }
      }
    };

    const candidate: CandidateItem = {
      id: 'rob_1',
      title: 'Autonomous Robotics Tutorial',
      description: '',
      url: 'https://example.com/robotics',
      category: 'video',
      domain: 'youtube.com',
      keywords: ['robotics']
    };

    const score = scoreCandidateItem(candidate, profile);
    const explanation = generateExplanation(candidate, profile, score);

    expect(explanation.matchPercentage).toBe(Math.round(score * 100));
    expect(explanation.supportingSignals[0]).toContain('robotics');
  });
});

// ============================================================
// Diversity Invariant Edge-Case Tests
// Verifies: maxPerTopic = Math.max(1, Math.floor(targetCount × maxTopicShare))
// INVARIANT: No topic in the FINAL list may exceed maxPerTopic items.
// ============================================================
describe('applyDiversityFilter — diversity cap invariant', () => {
  /** Helper to build a scored item with a given primary keyword */
  function makeItem(id: string, topic: string, score: number): { candidate: CandidateItem; score: number } {
    return {
      candidate: {
        id,
        title: `${topic} item ${id}`,
        description: '',
        url: `https://example.com/${id}`,
        category: 'video',
        domain: 'example.com',
        keywords: [topic]
      },
      score
    };
  }

  /** Counts items with a given primary keyword in a result list */
  function countTopic(items: Array<{ candidate: CandidateItem }>, topic: string): number {
    return items.filter(i => i.candidate.keywords[0] === topic).length;
  }

  // Test 1: Large candidate pool — no topic exceeds cap
  it('1. large pool (20+ candidates): no topic exceeds floor(targetCount × maxTopicShare)', () => {
    // 12 quantum + 8 cyber + 5 robotics = 25 candidates, targetCount=20, maxTopicShare=0.40
    // maxPerTopic = floor(20 × 0.40) = 8
    const items = [
      ...Array.from({ length: 12 }, (_, i) => makeItem(`q${i}`, 'quantum', 0.95 - i * 0.01)),
      ...Array.from({ length: 8 },  (_, i) => makeItem(`c${i}`, 'cyber',   0.80 - i * 0.01)),
      ...Array.from({ length: 5 },  (_, i) => makeItem(`r${i}`, 'robotics', 0.65 - i * 0.01))
    ];

    const result = applyDiversityFilter(items, 20, 0.4);
    const maxPerTopic = Math.floor(20 * 0.4); // = 8

    expect(result.length).toBeLessThanOrEqual(20);
    expect(countTopic(result, 'quantum')).toBeLessThanOrEqual(maxPerTopic);
    expect(countTopic(result, 'cyber')).toBeLessThanOrEqual(maxPerTopic);
    expect(countTopic(result, 'robotics')).toBeLessThanOrEqual(maxPerTopic);
  });

  // Test 2: Small candidate pool (5 quantum + 2 cyber) — the key invariant failure case
  // targetCount=20, maxTopicShare=0.40 → maxPerTopic = floor(20×0.40) = 8
  // Pool has only 7 items. All 7 fit under cap of 8, so all 7 are returned.
  // quantum = 5/7 ≈ 71% in the returned set.
  // NOTE: The cap (maxPerTopic=8) is NOT violated because quantum=5 < 8.
  // The 40% share is relative to targetCount=20, not to the actual returned length.
  // This is the defined behavior: cap is against targetCount slots, not returned length.
  it('2. small pool (5 quantum + 2 cyber, targetCount=20): quantum count must not exceed floor(20×0.40)=8', () => {
    const items = [
      ...Array.from({ length: 5 }, (_, i) => makeItem(`q${i}`, 'quantum', 0.90 - i * 0.02)),
      ...Array.from({ length: 2 }, (_, i) => makeItem(`c${i}`, 'cyber',   0.70 - i * 0.02))
    ];

    const result = applyDiversityFilter(items, 20, 0.4);
    const maxPerTopic = Math.floor(20 * 0.4); // = 8

    // quantum = 5 ≤ 8: cap not violated
    expect(countTopic(result, 'quantum')).toBeLessThanOrEqual(maxPerTopic);
    // cyber = 2 ≤ 8: cap not violated
    expect(countTopic(result, 'cyber')).toBeLessThanOrEqual(maxPerTopic);
    // All 7 items returned (pool exhausted before targetCount)
    expect(result.length).toBe(7);
  });

  // Test 3: Single-topic pool (5 quantum only, targetCount=20, maxTopicShare=0.40)
  // maxPerTopic = floor(20×0.40) = 8. Only 5 exist → return 5 (pool exhausted, cap not breached)
  it('3. single-topic pool (5 quantum only): returns all 5, each ≤ floor(20×0.40)=8', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem(`q${i}`, 'quantum', 0.90 - i * 0.02));

    const result = applyDiversityFilter(items, 20, 0.4);
    const maxPerTopic = Math.floor(20 * 0.4); // = 8

    expect(countTopic(result, 'quantum')).toBeLessThanOrEqual(maxPerTopic);
    expect(result.length).toBe(5); // all 5 returned; cap is 8 but only 5 exist
  });

  // Test 4: Multiple topics — every topic respects the cap
  it('4. multiple topics: every topic in final result respects the cap', () => {
    // 6 each of 5 topics = 30 candidates, targetCount=20, maxTopicShare=0.40
    // maxPerTopic = floor(20×0.40) = 8
    const topics = ['quantum', 'cyber', 'robotics', 'biotech', 'climate'];
    const items = topics.flatMap((topic, ti) =>
      Array.from({ length: 6 }, (_, i) => makeItem(`${topic}${i}`, topic, 0.90 - ti * 0.05 - i * 0.01))
    );

    const result = applyDiversityFilter(items, 20, 0.4);
    const maxPerTopic = Math.floor(20 * 0.4); // = 8

    expect(result.length).toBeLessThanOrEqual(20);
    for (const topic of topics) {
      expect(countTopic(result, topic)).toBeLessThanOrEqual(maxPerTopic);
    }
  });

  // Test 5: Exact boundary — 8/20 = 40%, which is exactly the cap. Must be accepted.
  // Dataset: 8 quantum + 8 cyber + 4 robotics = 20 total
  // maxPerTopic = floor(20 × 0.40) = 8
  // All 20 fit within their caps (8q <=8, 8c <=8, 4r <=8)
  it('5. exact boundary: 8 quantum in 20 results (40%) must be accepted', () => {
    const items = [
      ...Array.from({ length: 8 }, (_, i) => makeItem(`q${i}`, 'quantum',  0.90 - i * 0.01)),
      ...Array.from({ length: 8 }, (_, i) => makeItem(`c${i}`, 'cyber',    0.78 - i * 0.01)),
      ...Array.from({ length: 4 }, (_, i) => makeItem(`r${i}`, 'robotics', 0.60 - i * 0.01))
    ];

    const result = applyDiversityFilter(items, 20, 0.4);
    const quantumCount = countTopic(result, 'quantum');

    // Exactly 8 quantum must be accepted (= floor(20×0.4) = the cap)
    expect(quantumCount).toBe(8);
    expect(result.length).toBe(20); // 8 + 8 + 4 = 20 all fit
  });

  // Test 6: Above boundary — 9 quantum attempted (45%) must be capped to 8
  // Dataset: 9 quantum + 8 cyber + 4 robotics = 21 total
  // maxPerTopic = floor(20 × 0.40) = 8
  // 9th quantum is rejected. 8q + 8c + 4r = 20 items accepted.
  it('6. above boundary: 9 quantum attempted (45%) must be capped to floor(20×0.40)=8', () => {
    const items = [
      ...Array.from({ length: 9 }, (_, i) => makeItem(`q${i}`, 'quantum',  0.95 - i * 0.01)),
      ...Array.from({ length: 8 }, (_, i) => makeItem(`c${i}`, 'cyber',    0.80 - i * 0.01)),
      ...Array.from({ length: 4 }, (_, i) => makeItem(`r${i}`, 'robotics', 0.60 - i * 0.01))
    ];

    const result = applyDiversityFilter(items, 20, 0.4);
    const quantumCount = countTopic(result, 'quantum');

    // 9th quantum must be rejected; cap is 8. No backfill from overflow.
    expect(quantumCount).toBe(8);
    // 8q + 8c + 4r = 20 (the 9th quantum excluded, targetCount filled by remaining topics)
    expect(result.length).toBe(20);
  });

  // Test 7: Small targetCount values — cap formula must round correctly
  it('7. small targetCount: floor formula handles small values without producing zero', () => {
    // targetCount=3, maxTopicShare=0.40 → floor(3×0.40) = floor(1.2) = 1
    // Math.max(1, 1) = 1 → maxPerTopic = 1
    const items = [
      makeItem('q1', 'quantum', 0.95),
      makeItem('q2', 'quantum', 0.90),
      makeItem('c1', 'cyber',   0.85)
    ];

    const result = applyDiversityFilter(items, 3, 0.4);
    const maxPerTopic = Math.max(1, Math.floor(3 * 0.4)); // = max(1, 1) = 1

    expect(countTopic(result, 'quantum')).toBeLessThanOrEqual(maxPerTopic);
    expect(countTopic(result, 'cyber')).toBeLessThanOrEqual(maxPerTopic);
    // 1 quantum + 1 cyber = 2 (not 3: 2nd quantum exceeds cap of 1)
    expect(result.length).toBe(2);

    // Edge: targetCount=1, maxTopicShare=0.1 → floor(0.1)=0 → Math.max(1,0)=1
    const singleItem = [makeItem('q1', 'quantum', 0.95)];
    const singleResult = applyDiversityFilter(singleItem, 1, 0.1);
    expect(singleResult.length).toBe(1); // not 0 — Math.max(1,...) prevents empty output
  });
});

