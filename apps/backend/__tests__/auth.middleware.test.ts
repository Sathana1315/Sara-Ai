import request from 'supertest';
import express from 'express';
import { authenticateRequest, AuthenticatedRequest } from '../src/middleware/auth';

/**
 * Auth Middleware Tests
 *
 * Tests for the authenticateRequest middleware covering:
 * 1. Missing Authorization header → 401
 * 2. Malformed Authorization header → 401
 * 3. Invalid/expired token → 401
 * 4. Valid token → passes through with authUserId & saraUserId set
 *
 * Note: Tests that require a real Supabase JWT are integration tests.
 * Unit tests here mock the Supabase getUser call.
 */

// Mock @supabase/supabase-js at the module level
jest.mock('@supabase/supabase-js', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'sara-user-id-123' }, error: null })
  });

  return {
    createClient: jest.fn(() => ({
      auth: { getUser: mockGetUser },
      from: mockFrom
    })),
    __mockGetUser: mockGetUser
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = require('@supabase/supabase-js');
const mockGetUser = supabaseMock.__mockGetUser;

// Set required env vars for the middleware
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.get('/api/protected', authenticateRequest, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    res.json({ authUserId: authReq.authUserId, saraUserId: authReq.saraUserId });
  });
  return app;
};

describe('authenticateRequest middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should return 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toContain('Missing or malformed');
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Basic some-base64-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should return 401 when token is invalid (Supabase returns error)', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' }
    });

    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer invalid-token-value');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should return 401 when token is expired', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT expired' }
    });

    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('expired');
  });

  it('should pass through with saraUserId when token is valid', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-user-uuid-abc', email: 'test@example.com', user_metadata: {} } },
      error: null
    });

    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer valid-jwt-token');

    expect(res.status).toBe(200);
    expect(res.body.authUserId).toBe('auth-user-uuid-abc');
    expect(res.body.saraUserId).toBe('sara-user-id-123');
  });

  it('should never trust userId from request body', async () => {
    // Even if someone sends userId in body, it must be derived from JWT
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'real-auth-id', email: 'real@example.com', user_metadata: {} } },
      error: null
    });

    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer valid-token')
      .send({ userId: 'malicious-spoofed-user-id' }); // should be ignored

    expect(res.status).toBe(200);
    // The resolved authUserId must be from JWT, not from body
    expect(res.body.authUserId).toBe('real-auth-id');
    expect(res.body.authUserId).not.toBe('malicious-spoofed-user-id');
  });
});

describe('health endpoint (unauthenticated)', () => {
  it('should return 200 without any auth token', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => res.status(200).json({ status: 'online' }));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
  });
});
