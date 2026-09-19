import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { AdapterRegistry } from '@sara/site-adapters';
import { updateUserProfile, generateLearningExplanation } from '@sara/recommendation-engine';
import { UserProfile } from '@sara/shared';
import { authenticateRequest, AuthenticatedRequest } from '../middleware/auth';

export const eventsRouter = Router();
const adapterRegistry = new AdapterRegistry();

/**
 * POST /api/events/ingest
 * Authenticated — requires Bearer token.
 * Ingests a raw behavior signal from Chrome Extension.
 * userId is ALWAYS derived from the verified JWT — never trusted from body.
 */
eventsRouter.post('/ingest', authenticateRequest, async (req: AuthenticatedRequest | any, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { url, title, pageMeta, sessionId } = req.body;
    const userId = authReq.saraUserId; // Derived from verified JWT — never from body

    if (!url) {
      res.status(400).json({ error: 'Missing required parameter: url' });
      return;
    }

    const adapter = adapterRegistry.getAdapter(url);
    const signal = adapter.extract(url, pageMeta || { title });

    console.log('[Backend /events/ingest] Processing signal:', {
      userId,
      url,
      adapter: adapter.name,
      extractedTitle: signal?.title,
      eventType: signal?.eventType,
      keywords: signal?.keywords
    });

    if (!signal) {
      res.status(200).json({ success: true, message: 'No signal extracted' });
      return;
    }

    const behaviorEvent = adapter.normalize(signal, userId, sessionId || 'default_session', url);
    const dbClient = authReq.userSupabase || supabaseAdmin || supabase;

    // 1. Maintain browsing session in public.sessions
    let dbSessionId: string | null = null;
    if (sessionId) {
      const { data: sessionRow } = await dbClient
        .from('sessions')
        .upsert({
          user_id: userId,
          session_token: sessionId,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }, { onConflict: 'session_token' })
        .select('id')
        .single();
      if (sessionRow) dbSessionId = sessionRow.id;
    }

    // 2. Auto-provision content_items candidate if applicable
    if (behaviorEvent.title && behaviorEvent.url) {
      await dbClient.from('content_items').upsert({
        title: behaviorEvent.title,
        description: (behaviorEvent.metadata?.description as string) || behaviorEvent.title,
        url: behaviorEvent.url,
        image_url: (behaviorEvent.metadata?.imageUrl as string) || null,
        category: behaviorEvent.siteCategory || 'content',
        domain: behaviorEvent.domain,
        keywords: behaviorEvent.keywords
      }, { onConflict: 'url' });
    }

    // 3. Store behavior event in Supabase
    const { data: insertedEvent, error: eventError } = await dbClient
      .from('behavior_events')
      .insert({
        user_id: userId,
        session_id: dbSessionId,
        event_type: behaviorEvent.eventType,
        site_category: behaviorEvent.siteCategory,
        domain: behaviorEvent.domain,
        url: behaviorEvent.url,
        title: behaviorEvent.title,
        search_query: behaviorEvent.searchQuery || null,
        keywords: behaviorEvent.keywords,
        metadata: behaviorEvent.metadata,
        duration_ms: behaviorEvent.durationMs || (behaviorEvent.metadata.durationMs as number) || null,
        created_at: new Date(behaviorEvent.timestamp).toISOString()
      })
      .select()
      .single();

    if (eventError) {
      console.error('Supabase event insert error:', eventError.message);
    }

    // 4. Fetch existing user interests from Supabase
    const { data: existingInterests } = await dbClient
      .from('user_interests')
      .select('*')
      .eq('user_id', userId);

    const currentProfile: UserProfile = {
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      interests: {},
      totalEventsProcessed: 0,
      topCategories: { video: 0, shopping: 0, music: 0, content: 0, general: 0 }
    };

    if (existingInterests) {
      for (const row of existingInterests) {
        currentProfile.interests[row.topic] = {
          topic: row.topic,
          category: row.category as any,
          weight: row.weight,
          confidence: row.confidence,
          decayFactor: row.decay_factor,
          lastObserved: new Date(row.last_observed).getTime(),
          interactionCount: row.interaction_count
        };
      }
    }

    // 5. Compute dynamic profile update using recommendation-engine
    const { updatedProfile, topicsUpdated, totalScoreDelta } = updateUserProfile(currentProfile, behaviorEvent);

    // 6. Upsert updated interest signals
    for (const topicKey of Object.keys(updatedProfile.interests)) {
      const signalItem = updatedProfile.interests[topicKey];
      await dbClient.from('user_interests').upsert({
        user_id: userId,
        topic: signalItem.topic,
        category: signalItem.category,
        weight: signalItem.weight,
        confidence: signalItem.confidence,
        decay_factor: signalItem.decayFactor,
        interaction_count: signalItem.interactionCount,
        last_observed: new Date(signalItem.lastObserved).toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,topic' });
    }

    // 7. Insert explainable audit entry into public.learning_history
    if (topicsUpdated.length > 0) {
      const explanationText = generateLearningExplanation(behaviorEvent, topicsUpdated, totalScoreDelta);
      await dbClient.from('learning_history').insert({
        user_id: userId,
        event_id: insertedEvent?.id || null,
        topics_updated: topicsUpdated,
        score_delta: totalScoreDelta,
        created_at: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      eventId: insertedEvent?.id || behaviorEvent.id,
      adapterUsed: adapter.name,
      extractedKeywords: behaviorEvent.keywords,
      topicsUpdated
    });
  } catch (err: any) {
    console.error('Ingest route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
