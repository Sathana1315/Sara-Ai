-- Phase 2 SARA Auth Migration
-- Created: 2026-09-19
-- Links public.users to Supabase auth.users, establishes RLS policies,
-- and creates auto-provisioning trigger for new Google sign-ins.

-- 1. Link public.users to Supabase auth identity
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- 2. Enable RLS on tables that were not covered in Phase 1 migration
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

-- 3. Helper function: resolve SARA app user id from the current Supabase Auth JWT
-- Used in all RLS policies. SECURITY DEFINER so it can read public.users.
CREATE OR REPLACE FUNCTION public.get_sara_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- 4. Trigger function: auto-create public.users record when a user signs in via Google
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_auth_user();

-- 5. RLS Policies — strict per-user isolation
-- public.users
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- public.sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT USING (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.sessions;
CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT WITH CHECK (user_id = public.get_sara_user_id());

-- public.behavior_events
DROP POLICY IF EXISTS "Users can view own behavior events" ON public.behavior_events;
CREATE POLICY "Users can view own behavior events"
  ON public.behavior_events FOR SELECT USING (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can insert own behavior events" ON public.behavior_events;
CREATE POLICY "Users can insert own behavior events"
  ON public.behavior_events FOR INSERT WITH CHECK (user_id = public.get_sara_user_id());

-- public.user_interests
DROP POLICY IF EXISTS "Users can view own interests" ON public.user_interests;
CREATE POLICY "Users can view own interests"
  ON public.user_interests FOR SELECT USING (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can insert own interests" ON public.user_interests;
CREATE POLICY "Users can insert own interests"
  ON public.user_interests FOR INSERT WITH CHECK (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can update own interests" ON public.user_interests;
CREATE POLICY "Users can update own interests"
  ON public.user_interests FOR UPDATE USING (user_id = public.get_sara_user_id());

-- public.recommendations
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.recommendations;
CREATE POLICY "Users can view own recommendations"
  ON public.recommendations FOR SELECT USING (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can insert own recommendations" ON public.recommendations;
CREATE POLICY "Users can insert own recommendations"
  ON public.recommendations FOR INSERT WITH CHECK (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can update own recommendations" ON public.recommendations;
CREATE POLICY "Users can update own recommendations"
  ON public.recommendations FOR UPDATE USING (user_id = public.get_sara_user_id());

-- public.feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT USING (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT WITH CHECK (user_id = public.get_sara_user_id());

-- public.learning_history
DROP POLICY IF EXISTS "Users can view own learning history" ON public.learning_history;
CREATE POLICY "Users can view own learning history"
  ON public.learning_history FOR SELECT USING (user_id = public.get_sara_user_id());

DROP POLICY IF EXISTS "Users can insert own learning history" ON public.learning_history;
CREATE POLICY "Users can insert own learning history"
  ON public.learning_history FOR INSERT WITH CHECK (user_id = public.get_sara_user_id());

-- public.content_items: Publicly readable candidate pool (no per-user restriction)
DROP POLICY IF EXISTS "Content items publicly readable" ON public.content_items;
CREATE POLICY "Content items publicly readable"
  ON public.content_items FOR SELECT USING (true);
