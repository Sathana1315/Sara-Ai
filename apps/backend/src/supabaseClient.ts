import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing required env vars: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.'
  );
}

/**
 * Anon/publishable Supabase client.
 * Used for operations that respect RLS (reading user-scoped data with a user JWT).
 * Safe to use in backend routes after JWT verification.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

/**
 * Service-role Supabase client.
 * Bypasses RLS — MUST ONLY be used server-side for trusted operations.
 * NEVER expose this client or its key to browser/extension code.
 *
 * Used for:
 * - Writing behavior events on behalf of authenticated user (after JWT verification)
 * - Admin operations (e.g., backfill, schema management)
 */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;
