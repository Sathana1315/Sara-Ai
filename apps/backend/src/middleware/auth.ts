import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

/**
 * Authenticated request — extends Express Request with verified user identity.
 * The userId here is the SARA application user id (public.users.id),
 * derived from the verified Supabase JWT (auth.users.id → public.users.id).
 */
export interface AuthenticatedRequest extends Request {
  /** Supabase auth.users UUID derived from verified JWT */
  authUserId: string;
  /** SARA application user UUID (public.users.id) — resolved from auth_user_id */
  saraUserId: string;
  /** Raw Bearer token for forwarding to Supabase client operations */
  accessToken: string;
  /** Per-request Supabase client carrying the user JWT for RLS compliance */
  userSupabase: any;
}

/**
 * Authentication middleware.
 *
 * Verifies the Supabase JWT Bearer token from the Authorization header.
 * NEVER trusts userId from the request body.
 * Resolves authUserId → saraUserId via public.users.auth_user_id.
 *
 * Usage: apply to any route that requires authentication.
 *
 * Request format:
 *   Authorization: Bearer <supabase_access_token>
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>'
      });
      return;
    }

    const token = authHeader.substring(7); // strip "Bearer "

    // Verify the JWT with Supabase Auth
    // Create a per-request client using the user's token so auth.uid() works correctly
    const userSupabase = createClient(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);

    if (authError || !user) {
      const message = authError?.message || 'Invalid or expired token';
      res.status(401).json({
        error: 'Unauthorized',
        message: message.includes('expired') ? 'Session expired. Please sign in again.' : 'Invalid authentication token.'
      });
      return;
    }

    // Resolve the SARA application user id from auth.users id
    // Use userSupabase client carrying the verified JWT so RLS permits lookup and insertion
    const { data: saraProfile, error: profileError } = await userSupabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !saraProfile) {
      // Profile not yet provisioned — attempt to create it now with userSupabase
      const { data: newProfile, error: insertError } = await userSupabase
        .from('users')
        .insert({
          auth_user_id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || ''
        })
        .select('id')
        .single();

      if (insertError || !newProfile) {
        console.error('Failed to provision SARA profile:', insertError?.message, insertError, profileError);
        res.status(500).json({ error: 'Failed to provision user profile.', details: insertError?.message || profileError?.message });
        return;
      }

      (req as AuthenticatedRequest).saraUserId = newProfile.id;
    } else {
      (req as AuthenticatedRequest).saraUserId = saraProfile.id;
    }

    (req as AuthenticatedRequest).authUserId = user.id;
    (req as AuthenticatedRequest).accessToken = token;
    (req as AuthenticatedRequest).userSupabase = userSupabase;

    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ error: 'Authentication service error.' });
  }
}

/**
 * Optional authentication — resolves the user if a token is present,
 * but does NOT block unauthenticated requests.
 * Useful for routes that behave differently for auth vs unauth users.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // Attempt auth but don't block on failure
    await authenticateRequest(req, { json: () => {}, status: () => ({ json: () => {} }) } as any, next).catch(() => next());
  } else {
    next();
  }
}
