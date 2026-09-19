/**
 * SARA Hackathon Demo Reset Tool
 *
 * Development-only utility to clear SARA database records for the development user
 * so that a clean demonstration can be conducted from scratch.
 *
 * Usage:
 *   node scripts/demo-reset.js
 *   npm run demo:reset
 *   node scripts/demo-reset.js --confirm
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[DEMO RESET] Error: Missing SUPABASE_URL or keys in .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function performReset() {
  console.log('\n========================================');
  console.log('✦ SARA DEMO RESET UTILITY (DEV ONLY)');
  console.log('========================================\n');

  // Fetch target user
  const { data: users, error: userError } = await supabase.from('users').select('id, email, full_name').limit(5);

  if (userError || !users || users.length === 0) {
    console.error('[DEMO RESET] Error fetching users or no user profile exists in database.');
    process.exit(1);
  }

  const targetUser = users[0];
  console.log(`Target Development User: ${targetUser.full_name || 'User'} (${targetUser.email})`);
  console.log(`User ID: ${targetUser.id}\n`);

  const forceConfirm = process.argv.includes('--confirm') || process.argv.includes('--force');

  if (!forceConfirm) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question('WARNING: This will erase all behavior_events, user_interests, recommendations, and learning_history for this user.\nType "RESET" to confirm: ', resolve);
    });
    rl.close();

    if (answer.trim() !== 'RESET') {
      console.log('\n[DEMO RESET] Operation cancelled. No data was deleted.');
      process.exit(0);
    }
  }

  console.log('\nDeleting user data...');

  const userId = targetUser.id;

  const results = await Promise.all([
    supabase.from('behavior_events').delete().eq('user_id', userId),
    supabase.from('user_interests').delete().eq('user_id', userId),
    supabase.from('recommendations').delete().eq('user_id', userId),
    supabase.from('learning_history').delete().eq('user_id', userId),
    supabase.from('feedback').delete().eq('user_id', userId),
    supabase.from('sessions').delete().eq('user_id', userId)
  ]);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('[DEMO RESET] Some deletions failed:', errors.map(e => e.error.message).join(', '));
  } else {
    console.log('✅ public.behavior_events cleared.');
    console.log('✅ public.user_interests cleared.');
    console.log('✅ public.recommendations cleared.');
    console.log('✅ public.learning_history cleared.');
    console.log('✅ public.feedback cleared.');
    console.log('✅ public.sessions cleared.');
    console.log('\n✦ SARA Demo Reset Completed Successfully! Dashboard is now in a clean empty state.\n');
  }
}

performReset().catch((err) => {
  console.error('[DEMO RESET] Unexpected failure:', err.message);
  process.exit(1);
});
