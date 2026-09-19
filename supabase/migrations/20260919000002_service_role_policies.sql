-- Phase 3: Content Items Candidates Policy + RLS Security Hardening
-- Created: 2026-09-19
-- Ensures content_items can be inserted/updated globally while preserving strict user isolation.

-- 1. Content Items (shared global pool of candidates, no user_id column)
DROP POLICY IF EXISTS "Content items service insert" ON public.content_items;
CREATE POLICY "Content items service insert"
  ON public.content_items FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Content items service update" ON public.content_items;
CREATE POLICY "Content items service update"
  ON public.content_items FOR UPDATE
  USING (true);

-- 2. Sessions (user-isolated)
DROP POLICY IF EXISTS "Service can upsert sessions" ON public.sessions;
CREATE POLICY "Service can upsert sessions"
  ON public.sessions FOR UPDATE
  USING (user_id = public.get_sara_user_id());

-- 3. Recommendations (user-isolated)
DROP POLICY IF EXISTS "Service can insert recommendations" ON public.recommendations;
CREATE POLICY "Service can insert recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Service can update recommendations" ON public.recommendations;
CREATE POLICY "Service can update recommendations"
  ON public.recommendations FOR UPDATE
  USING (user_id = public.get_sara_user_id());

-- 4. Learning History (user-isolated)
DROP POLICY IF EXISTS "Service can insert learning_history" ON public.learning_history;
CREATE POLICY "Service can insert learning_history"
  ON public.learning_history FOR INSERT
  WITH CHECK (user_id = public.get_sara_user_id());

-- 5. User Interests (user-isolated)
DROP POLICY IF EXISTS "Service can upsert user_interests" ON public.user_interests;
CREATE POLICY "Service can upsert user_interests"
  ON public.user_interests FOR INSERT
  WITH CHECK (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Service can update user_interests" ON public.user_interests;
CREATE POLICY "Service can update user_interests"
  ON public.user_interests FOR UPDATE
  USING (user_id = public.get_sara_user_id());

-- 6. Behavior Events (user-isolated)
DROP POLICY IF EXISTS "Service can insert behavior_events" ON public.behavior_events;
CREATE POLICY "Service can insert behavior_events"
  ON public.behavior_events FOR INSERT
  WITH CHECK (user_id = public.get_sara_user_id());

