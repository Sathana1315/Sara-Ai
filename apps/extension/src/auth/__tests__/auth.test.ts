import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStoredSession, storeSession, clearStoredSession, signInWithGoogle, supabase, resetAuthFlowLock } from '../auth';
import type { AuthSession } from '@sara/shared';

// Mock chrome API
const mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
      set: vi.fn(async (data: Record<string, any>) => {
        Object.assign(mockStorage, data);
      }),
      remove: vi.fn(async (key: string) => {
        delete mockStorage[key];
      })
    }
  },
  runtime: {
    id: 'test-extension-id',
    lastError: undefined
  },
  identity: {
    getRedirectURL: vi.fn(() => 'https://test-extension-id.chromiumapp.org/'),
    launchWebAuthFlow: vi.fn()
  }
} as any;

// Mock fetch
global.fetch = vi.fn();

describe('Extension Auth Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthFlowLock();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { provider: 'google', url: 'https://xloherpfgrrkgegdxipx.supabase.co/auth/v1/authorize?provider=google' },
      error: null
    } as any);
  });

  describe('Session Storage', () => {
    it('returns null when no session exists', async () => {
      const session = await getStoredSession();
      expect(session).toBeNull();
    });

    it('stores and retrieves a valid session', async () => {
      const mockSession: AuthSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour
        saraUser: {
          id: 'sara-123',
          authUserId: 'auth-123',
          email: 'test@example.com',
          fullName: 'Test User',
          avatarUrl: '',
          createdAt: '',
          updatedAt: ''
        }
      };

      await storeSession(mockSession);
      const retrieved = await getStoredSession();
      expect(retrieved).toEqual(mockSession);
    });

    it('clears session when expired (within 5 mins)', async () => {
      const mockSession: AuthSession = {
        accessToken: 'expired-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 1000 * 60 * 2, // 2 mins (less than 5)
        saraUser: {} as any
      };

      await storeSession(mockSession);
      const retrieved = await getStoredSession();
      
      expect(retrieved).toBeNull();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('sara_auth_session');
    });
  });

  describe('signInWithGoogle', () => {
    it('successfully authenticates and resolves SARA profile', async () => {
      // Mock OAuth flow success
      (chrome.identity.launchWebAuthFlow as any).mockImplementation((_opts: any, cb: Function) => {
        cb('https://test-extension-id.chromiumapp.org/#access_token=mock-token&expires_in=3600');
      });

      // Mock backend profile resolution
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: {
            id: 'sara-123',
            authUserId: 'auth-123',
            email: 'test@example.com'
          }
        })
      });

      const result = await signInWithGoogle();
      
      expect(result.success).toBe(true);
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
      
      const stored = await getStoredSession();
      expect(stored).not.toBeNull();
      expect(stored?.accessToken).toBe('mock-token');
      expect(stored?.saraUser.id).toBe('sara-123');
    });

    it('handles OAuth cancellation', async () => {
      // Mock OAuth cancellation (callback URL is undefined)
      (chrome.identity.launchWebAuthFlow as any).mockImplementation((_opts: any, cb: Function) => {
        cb(undefined);
      });

      const result = await signInWithGoogle();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('prevents concurrent OAuth flows via single-flight lock', async () => {
      // Mock pending OAuth flow that doesn't immediately call callback
      let savedCallback: Function | null = null;
      (chrome.identity.launchWebAuthFlow as any).mockImplementation((_opts: any, cb: Function) => {
        savedCallback = cb;
      });

      // Start first flow
      const promise1 = signInWithGoogle();

      // Attempt second flow concurrently
      const result2 = await signInWithGoogle();
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already in progress');

      // Complete first flow
      if (savedCallback) {
        (savedCallback as Function)(undefined);
      }
      await promise1;
    });
  });
});
