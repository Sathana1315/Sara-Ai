import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { authenticateRequest, AuthenticatedRequest } from '../middleware/auth';

export const feedbackRouter = Router();

/**
 * POST /api/feedback
 * Authenticated — requires Bearer token.
 * Stores user feedback (like/dislike/skip) and adjusts user interest weights.
 */
feedbackRouter.post('/', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.saraUserId;
    const { recommendationId, feedbackType, comment } = req.body;

    if (!recommendationId || !feedbackType) {
      res.status(400).json({ error: 'Missing recommendationId or feedbackType' });
      return;
    }

    const dbClient = supabaseAdmin || supabase;

    // 1. Store feedback entry
    const { data: insertedFeedback, error: feedbackError } = await dbClient
      .from('feedback')
      .insert({
        user_id: userId,
        recommendation_id: recommendationId,
        feedback_type: feedbackType,
        comment: comment || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (feedbackError) {
      console.error('Feedback insert error:', feedbackError.message);
    }

    // 2. Update recommendation status
    await dbClient
      .from('recommendations')
      .update({ feedback_status: feedbackType })
      .eq('id', recommendationId)
      .eq('user_id', userId);

    // 3. Fetch recommendation details to adjust interest weights
    const { data: recData } = await dbClient
      .from('recommendations')
      .select('category, title')
      .eq('id', recommendationId)
      .single();

    if (recData) {
      const delta = feedbackType === 'like' ? 0.2 : feedbackType === 'dislike' ? -0.3 : -0.1;
      const keywords = recData.title
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3);

      for (const kw of keywords) {
        const { data: existingSignal } = await dbClient
          .from('user_interests')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', kw)
          .single();

        if (existingSignal) {
          const newWeight = Math.min(1.0, Math.max(0.0, existingSignal.weight + delta));
          await dbClient
            .from('user_interests')
            .update({ weight: newWeight, updated_at: new Date().toISOString() })
            .eq('id', existingSignal.id);
        }
      }
    }

    res.status(200).json({
      success: true,
      feedbackId: insertedFeedback?.id || null
    });
  } catch (err: any) {
    console.error('Feedback route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
