import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { scoreCandidateItem, filterCandidatesByContext, filterConsumedCandidates, applyDiversityFilter, generateExplanation } from '@sara/recommendation-engine';
import { CandidateItem, UserProfile, RecommendationResult } from '@sara/shared';
import { authenticateRequest, AuthenticatedRequest } from '../middleware/auth';

export const recommendationsRouter = Router();

/**
 * GET /api/recommendations
 * Authenticated — requires Bearer token.
 * Generates contextually filtered & dynamically scored recommendations.
 * Persists scored recommendations to public.recommendations for feedback linkage.
 * userId is derived from verified JWT — never from query params.
 */
recommendationsRouter.get('/', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.saraUserId;
    const context = (req.query.context as 'current_site' | 'global_dashboard') || 'global_dashboard';
    const currentDomain = req.query.domain as string | undefined;

    const dbClient = authReq.userSupabase || supabaseAdmin || supabase;

    // 1. Fetch user profile interests from Supabase
    const { data: interestsData } = await dbClient
      .from('user_interests')
      .select('*')
      .eq('user_id', userId);

    const userProfile: UserProfile = {
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      interests: {},
      totalEventsProcessed: 0,
      topCategories: { video: 0, shopping: 0, music: 0, content: 0, general: 0 }
    };

    if (interestsData && interestsData.length > 0) {
      for (const row of interestsData) {
        userProfile.interests[row.topic] = {
          topic: row.topic,
          category: row.category as any,
          weight: row.weight,
          confidence: row.confidence,
          decayFactor: row.decay_factor,
          lastObserved: new Date(row.last_observed).getTime(),
          interactionCount: row.interaction_count
        };
        const cat = row.category as keyof typeof userProfile.topCategories;
        if (userProfile.topCategories[cat] !== undefined) {
          userProfile.topCategories[cat] += row.interaction_count;
          userProfile.totalEventsProcessed += row.interaction_count;
        }
      }
    }

    // 2. Fetch consumed URLs for user to exclude consumed content
    const { data: consumedEvents } = await dbClient
      .from('behavior_events')
      .select('url')
      .eq('user_id', userId);
    const consumedUrls = new Set<string>((consumedEvents || []).map((e: any) => e.url).filter(Boolean));

    // 3. Fetch candidate items from content_items table
    const { data: candidateData } = await supabase.from('content_items').select('*');

    const rawCandidates: CandidateItem[] = (candidateData || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      url: row.url,
      imageUrl: row.image_url || undefined,
      category: row.category as any,
      domain: row.domain,
      keywords: row.keywords || []
    }));

    // 4. Exclude content the user has already consumed
    const unconsumedCandidates = filterConsumedCandidates(rawCandidates, consumedUrls);

    // 5. Context filtering for current-site overlay vs global dashboard
    const contextFilteredCandidates = context === 'current_site'
      ? filterCandidatesByContext(unconsumedCandidates, currentDomain)
      : unconsumedCandidates;

    // 6. Score candidates dynamically against the user profile
    const scoredItems: Array<{ candidate: CandidateItem; score: number; explanation: any }> = [];
    for (const item of contextFilteredCandidates) {
      const score = scoreCandidateItem(item, userProfile);
      const explanation = generateExplanation(item, userProfile, score);
      scoredItems.push({ candidate: item, score, explanation });
    }

    // Sort by score descending and apply explainable diversity capping
    scoredItems.sort((a, b) => b.score - a.score);
    const topItems = applyDiversityFilter(scoredItems, 20, 0.4);

    // 5. Persist scored recommendations to public.recommendations
    //    We upsert by (user_id, url, context) — avoids duplicate rows for the same URL per user
    const results: RecommendationResult[] = [];

    for (const { candidate, score, explanation } of topItems) {
      // Upsert the recommendation record
      const { data: insertedRec } = await dbClient
        .from('recommendations')
        .upsert({
          user_id: userId,
          content_item_id: candidate.id || null,
          title: candidate.title,
          description: candidate.description,
          url: candidate.url,
          image_url: candidate.imageUrl || null,
          category: candidate.category,
          domain: candidate.domain,
          score,
          explanation: explanation as any,
          context,
          feedback_status: 'pending',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,url,context',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      results.push({
        id: insertedRec?.id || 'rec_' + Math.random().toString(36).substring(2, 11),
        itemId: candidate.id,
        title: candidate.title,
        description: candidate.description,
        url: candidate.url,
        imageUrl: candidate.imageUrl,
        category: candidate.category,
        domain: candidate.domain,
        score,
        explanation,
        context,
        timestamp: Date.now()
      });
    }

    res.status(200).json({
      success: true,
      context,
      domainFilter: currentDomain || null,
      recommendationsCount: results.length,
      recommendations: results
    });
  } catch (err: any) {
    console.error('Recommendations route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
