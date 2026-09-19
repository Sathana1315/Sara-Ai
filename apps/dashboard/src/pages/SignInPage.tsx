import React from 'react';
import { Sparkles, Chrome } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * SARA Sign-In Page
 * Shown when the user is not authenticated.
 * Provides "Continue with Google" via Supabase Auth OAuth.
 *
 * NOTE: Google OAuth requires manual configuration:
 * 1. Create OAuth 2.0 Client in Google Cloud Console
 * 2. Set Authorized Redirect URIs to your dashboard origin
 * 3. Enter Client ID & Secret in Supabase Dashboard → Auth → Providers → Google
 */
export const SignInPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Redirect happens inside signInWithGoogle — if we get here it failed silently
    } catch (err: any) {
      setError('Sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070A] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-700/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-800/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-purple-500/40 mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        {/* Header */}
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">SARA</h1>
        <p className="text-sm text-purple-300 font-medium mb-1">Personal AI Assistant</p>
        <p className="text-xs text-slate-500 text-center mb-10 max-w-xs">
          Your adaptive recommendation companion that learns from your browsing across the web.
        </p>

        {/* Sign-in card */}
        <div
          className="w-full p-8 rounded-2xl border border-purple-900/30"
          style={{
            background: 'rgba(18, 18, 28, 0.75)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(124,58,237,0.12)'
          }}
        >
          <h2 className="text-lg font-bold text-white mb-1 text-center">Welcome back</h2>
          <p className="text-xs text-slate-400 text-center mb-6">
            Sign in to access your personalized learning profile.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-xs text-center">
              {error}
            </div>
          )}

          <button
            id="sara-google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: isLoading
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, rgba(124,58,237,0.9) 0%, rgba(99,102,241,0.9) 100%)',
              border: '1px solid rgba(168,85,247,0.4)',
              color: 'white',
              boxShadow: isLoading ? 'none' : '0 4px 16px rgba(124,58,237,0.3)'
            }}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Google G icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-2 mt-4">
            <Chrome className="w-3 h-3 text-slate-500 shrink-0" />
            <p className="text-[10px] text-slate-500">
              Install the SARA Chrome Extension to enable personalized recommendations while you browse.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[10px] text-slate-600 text-center max-w-xs">
          SARA collects only recommendation-relevant browsing signals. No passwords, payment info, or private messages are ever collected.
        </p>
      </div>
    </div>
  );
};
