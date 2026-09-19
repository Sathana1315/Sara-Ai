import { EventType, SiteCategory } from '../events';

// ============================================================
// Authentication & Identity Types
// ============================================================

/**
 * SARA Application User Profile.
 * Linked to Supabase auth.users via authUserId.
 * This is the single unified identity across all supported sites.
 * Do NOT create separate profiles per site.
 */
export interface SaraUser {
  /** SARA application UUID (public.users.id) */
  id: string;
  /** Supabase Auth UUID (auth.users.id) — the authoritative identity */
  authUserId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authentication state — used by both the dashboard and extension.
 * - unauthenticated: No valid session exists.
 * - loading: Auth state is being resolved (checking stored session).
 * - authenticated: Valid Supabase JWT + provisioned SARA profile.
 */
export type AuthStateStatus = 'unauthenticated' | 'loading' | 'authenticated';

export interface AuthState {
  status: AuthStateStatus;
  /** The Supabase Auth JWT access token. Present when authenticated. */
  accessToken: string | null;
  /** The resolved SARA application user profile. Present when authenticated. */
  saraUser: SaraUser | null;
}

/**
 * A complete authenticated session bundle passed between contexts.
 */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  saraUser: SaraUser;
}

/**
 * A single browsing session within SARA.
 * IMPORTANT: This is NOT the Supabase authentication session.
 * A user has one auth identity but can have many browsing sessions over time.
 *
 * Example:
 *   User (1) → BrowsingSession (many)
 *   Session 1: YouTube activity, Shopping activity
 *   Session 2: Music activity
 *   Session 3: Shopping activity
 */
export interface BrowsingSession {
  id: string;
  /** SARA application user id (public.users.id) */
  userId: string;
  /** Opaque token identifying this browsing session */
  sessionToken: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Normalized Behavior Event captured by Chrome Extension or API.
 */
export interface BehaviorEvent {
  id: string;
  userId: string;
  sessionId: string;
  eventType: EventType;
  siteCategory: SiteCategory;
  domain: string;
  url: string;
  title: string;
  searchQuery?: string;
  keywords: string[];
  metadata: Record<string, unknown>;
  timestamp: number; // ISO epoch ms
  durationMs?: number;
  scrollDepth?: number; // 0.0 - 1.0 (or percentage milestone 25, 50, 75, 90)
  contentId?: string;
  contentType?: string;
}

/**
 * Audit record for user profile dynamic learning updates.
 */
export interface LearningHistoryEntry {
  id: string;
  userId: string;
  eventId?: string;
  topicsUpdated: string[];
  scoreDelta: number;
  explanation: string;
  timestamp: number;
}

/**
 * Weighted Interest Signal derived from behavior events.
 */
export interface InterestSignal {
  topic: string;
  category: SiteCategory;
  weight: number;         // Dynamic strength [0.0 - 1.0]
  confidence: number;     // Statistical confidence
  decayFactor: number;    // Recency decay applied
  lastObserved: number;  // Epoch ms
  interactionCount: number;
}

/**
 * Unified User Profile representing cross-site learned interests.
 */
export interface UserProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  interests: Record<string, InterestSignal>;
  totalEventsProcessed: number;
  topCategories: Record<SiteCategory, number>;
}

/**
 * Candidate item for recommendation scoring.
 */
export interface CandidateItem {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  category: SiteCategory;
  domain: string;
  keywords: string[];
  score?: number;
}

/**
 * Data-backed explanation for why an item was recommended.
 */
export interface RecommendationExplanation {
  matchPercentage: number;
  primaryReason: string;
  supportingSignals: string[];
}

/**
 * Final scored recommendation object delivered to extension UI or dashboard.
 */
export interface RecommendationResult {
  id: string;
  itemId: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  category: SiteCategory;
  domain: string;
  score: number;             // [0.0 - 1.0]
  explanation: RecommendationExplanation;
  context: 'current_site' | 'global_dashboard';
  timestamp: number;
}

/**
 * Explicit user feedback on a recommendation.
 */
export interface FeedbackEvent {
  id: string;
  recommendationId: string;
  userId: string;
  feedbackType: 'like' | 'dislike' | 'skip' | 'click';
  comment?: string;
  timestamp: number;
}

