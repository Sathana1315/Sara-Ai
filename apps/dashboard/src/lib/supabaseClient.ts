import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[SARA Dashboard] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing from environment configuration.'
  );
}

/**
 * Browser-side Supabase client for the SARA Dashboard.
 * Uses the publishable key only — safe for browser context.
 * All database access is governed by RLS policies.
 */
export const supabase = createClient(
  supabaseUrl || 'https://xloherpfgrrkgegdxipx.supabase.co',
  supabasePublishableKey || 'placeholder_key'
);


