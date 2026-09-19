import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { authenticateRequest, AuthenticatedRequest } from '../middleware/auth';

export const userRouter = Router();

/**
 * GET /api/user/profile
 * Authenticated — requires Bearer token.
 * Returns the SARA application profile and dynamic interest summary.
 * userId is derived from verified JWT — never from query params.
 */
userRouter.get('/profile', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.saraUserId;
    const dbClient = supabaseAdmin || supabase;

    // 1. Fetch SARA profile
    const { data: profile } = await dbClient
      .from('users')
      .select('id, email, full_name, avatar_url, created_at, updated_at, auth_user_id')
      .eq('id', userId)
      .single();

    // 2. Fetch user interests ordered by weight
    const { data: interests } = await dbClient
      .from('user_interests')
      .select('*')
      .eq('user_id', userId)
      .order('weight', { ascending: false });

    // 3. Fetch event count
    const { count: eventCount } = await dbClient
      .from('behavior_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 4. Fetch recommendation count
    const { count: recCount } = await dbClient
      .from('recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 5. Fetch feedback count
    const { count: feedbackCount } = await dbClient
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    res.status(200).json({
      success: true,
      profile: profile ? {
        id: profile.id,
        authUserId: profile.auth_user_id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      } : null,
      totalEventsObserved: eventCount || 0,
      totalRecommendationsGenerated: recCount || 0,
      totalFeedbackGiven: feedbackCount || 0,
      interestsLearnedCount: interests ? interests.length : 0,
      interests: (interests || []).map((row) => ({
        topic: row.topic,
        category: row.category,
        weight: row.weight,
        confidence: row.confidence,
        decayFactor: row.decay_factor,
        interactionCount: row.interaction_count,
        lastObserved: row.last_observed
      }))
    });
  } catch (err: any) {
    console.error('User profile route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/history
 * Authenticated — returns learning history audit logs.
 */
userRouter.get('/history', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.saraUserId;
    const dbClient = supabaseAdmin || supabase;

    const { data: history } = await dbClient
      .from('learning_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    res.status(200).json({
      success: true,
      history: history || []
    });
  } catch (err: any) {
    console.error('User history route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/behavior
 * Authenticated — returns recent behavior signals.
 */
userRouter.get('/behavior', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.saraUserId;
    const dbClient = supabaseAdmin || supabase;

    const { data: events } = await dbClient
      .from('behavior_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    res.status(200).json({
      success: true,
      events: events || []
    });
  } catch (err: any) {
    console.error('User behavior route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/auth/session
 * Validates the current Bearer token and returns auth session info.
 */
userRouter.get('/auth/session', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  res.status(200).json({
    success: true,
    authenticated: true,
    authUserId: authReq.authUserId,
    saraUserId: authReq.saraUserId
  });
});
