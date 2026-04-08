import { describe, it, expect } from 'vitest';

const jwt = await import('jsonwebtoken');
const { generateToken, requireAuth, requireAdmin, JWT_SECRET } =
  await import('../middleware/auth.js');

describe('generateToken', () => {
  it('generates a valid JWT string', () => {
    const mockUser = { _id: '507f1f77bcf86cd799439011', email: 'test@test.com', role: 'client' };
    const token = generateToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('token contains correct payload', () => {
    const mockUser = { _id: '507f1f77bcf86cd799439011', email: 'test@test.com', role: 'admin' };
    const token = generateToken(mockUser);
    const decoded = jwt.default.verify(token, JWT_SECRET);
    expect(decoded.id).toBe('507f1f77bcf86cd799439011');
    expect(decoded.email).toBe('test@test.com');
    expect(decoded.role).toBe('admin');
  });

  it('token has an expiry', () => {
    const mockUser = { _id: '123', email: 'a@b.com', role: 'client' };
    const token = generateToken(mockUser);
    const decoded = jwt.default.verify(token, JWT_SECRET);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });
});

describe('requireAuth middleware', () => {
  function createMockReqRes(authHeader) {
    const req = { headers: { authorization: authHeader } };
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    return { req, res };
  }

  it('returns 401 when no Authorization header', () => {
    const { req, res } = createMockReqRes(undefined);
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Authentication required');
    expect(nextCalled).toBe(false);
  });

  it('returns 401 when header does not start with Bearer', () => {
    const { req, res } = createMockReqRes('Basic abc123');
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('returns 401 for invalid token', () => {
    const { req, res } = createMockReqRes('Bearer totally-invalid');
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
    expect(nextCalled).toBe(false);
  });

  it('calls next and sets req.user for valid token', () => {
    const mockUser = { _id: '507f1f77bcf86cd799439011', email: 'test@test.com', role: 'client' };
    const token = generateToken(mockUser);
    const { req, res } = createMockReqRes(`Bearer ${token}`);

    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.user.email).toBe('test@test.com');
    expect(req.user.role).toBe('client');
  });
});

describe('requireAdmin middleware', () => {
  function createMockRes() {
    return {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
  }

  it('returns 403 when user is not admin', () => {
    const req = { user: { role: 'client' } };
    const res = createMockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Admin access required');
    expect(nextCalled).toBe(false);
  });

  it('returns 403 when user is PSW', () => {
    const req = { user: { role: 'psw' } };
    const res = createMockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it('calls next when user is admin', () => {
    const req = { user: { role: 'admin' } };
    const res = createMockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('returns 403 when req.user is undefined', () => {
    const req = {};
    const res = createMockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });
});
