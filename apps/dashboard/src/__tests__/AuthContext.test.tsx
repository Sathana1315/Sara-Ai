import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

// Mock the Supabase client
vi.mock('../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn()
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
    }
  };
});

// A simple component to test the context
const TestComponent = () => {
  const { status, saraUser, signInWithGoogle, signOut } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      {saraUser && <div data-testid="user-email">{saraUser.email}</div>}
      <button onClick={signInWithGoogle}>Sign In</button>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes in unauthenticated state if no session exists', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial state is loading, then it resolves to unauthenticated
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });

  it('resolves session and fetches user profile', async () => {
    const mockSession = {
      user: { id: 'auth-123', email: 'test@example.com' },
      access_token: 'fake-token'
    };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: mockSession } });

    // Mock fetching the public.users profile
    (supabase.from as any)().select().eq().single.mockResolvedValue({
      data: {
        id: 'sara-123',
        auth_user_id: 'auth-123',
        email: 'test@example.com',
        full_name: 'Test User'
      },
      error: null
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
  });
});
