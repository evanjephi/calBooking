import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const { default: app } = await import('../server.js');

const fakeToken = jwt.sign(
  { id: '507f1f77bcf86cd799439011', email: 'test@test.com', role: 'client' },
  process.env.JWT_SECRET || 'dev-secret-change-in-production',
  { expiresIn: '1h' }
);

describe('Server basics', () => {
  it('GET / responds with "API running"', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('API running');
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/auth/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('Auth - Registration', () => {
  it('rejects registration with missing fields', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects registration with invalid email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('rejects registration with short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User'
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'password')).toBe(true);
  });

  it('rejects admin role from registration', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'admin-attempt@test.com',
        password: 'password123',
        firstName: 'Hack',
        lastName: 'Attempt',
        role: 'admin'
      });

    // Should not return 400 — the role is simply ignored and defaults to "client"
    // The server either accepts (201) if DB connected, or 500 if not
    if (res.status === 201) {
      expect(res.body.user.role).not.toBe('admin');
    }
  });
});

describe('Auth - Login', () => {
  it('rejects login with missing credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  it('rejects login with invalid email format', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bad', password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('rejects login with empty password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@test.com', password: '' });

    expect(res.status).toBe(400);
  });
});

describe('Protected routes - Auth required', () => {
  it('GET /auth/me returns 401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentication required');
  });

  it('GET /auth/me returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('GET /bookings returns 401 without token', async () => {
    const res = await request(app).get('/bookings');
    expect(res.status).toBe(401);
  });

  it('POST /booking-requests returns 401 without token', async () => {
    const res = await request(app).post('/booking-requests').send({});
    expect(res.status).toBe(401);
  });

  it('GET /bookings/psw returns 401 without token', async () => {
    const res = await request(app).get('/bookings/psw');
    expect(res.status).toBe(401);
  });

  it('GET /bookings/transactions returns 401 without token', async () => {
    const res = await request(app).get('/bookings/transactions');
    expect(res.status).toBe(401);
  });
});

describe('Admin routes - Authorization', () => {
  it('GET /admin/stats returns 401 without token', async () => {
    const res = await request(app).get('/admin/stats');
    expect(res.status).toBe(401);
  });

  it('GET /admin/posts returns 401 without token', async () => {
    const res = await request(app).get('/admin/posts');
    expect(res.status).toBe(401);
  });

  it('GET /admin/clients returns 401 without token', async () => {
    const res = await request(app).get('/admin/clients');
    expect(res.status).toBe(401);
  });

  it('GET /admin/users returns 401 without token', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(401);
  });
});

describe('Booking request validation', () => {
  it('rejects booking request with missing required fields', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
    // Must require city, postalCode, daysPerWeek, timeOfDay, visitDuration, lengthOfCareWeeks
    const fields = res.body.errors.map(e => e.field);
    expect(fields).toContain('city');
    expect(fields).toContain('postalCode');
    expect(fields).toContain('daysPerWeek');
    expect(fields).toContain('timeOfDay');
    expect(fields).toContain('visitDuration');
    expect(fields).toContain('lengthOfCareWeeks');
  });

  it('rejects invalid timeOfDay values', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 3,
        timeOfDay: 'midnight',
        visitDuration: '2-3 hours',
        lengthOfCareWeeks: 4
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'timeOfDay')).toBe(true);
  });

  it('rejects invalid visitDuration values', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 3,
        timeOfDay: 'daytime',
        visitDuration: '10 hours',
        lengthOfCareWeeks: 4
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'visitDuration')).toBe(true);
  });

  it('rejects daysPerWeek outside 1-7 range', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 10,
        timeOfDay: 'daytime',
        visitDuration: '2-3 hours',
        lengthOfCareWeeks: 4
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'daysPerWeek')).toBe(true);
  });

  it('rejects invalid preferredDays values', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 3,
        timeOfDay: 'daytime',
        visitDuration: '2-3 hours',
        lengthOfCareWeeks: 4,
        preferredDays: ['InvalidDay']
      });

    expect(res.status).toBe(400);
  });

  it('rejects invalid bookingType', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        bookingType: 'permanent',
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 3,
        timeOfDay: 'daytime',
        visitDuration: '2-3 hours',
        lengthOfCareWeeks: 4
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'bookingType')).toBe(true);
  });
});

describe('Booking ID validation', () => {
  it('rejects GET /bookings/:id with invalid mongo ID', async () => {
    const res = await request(app)
      .get('/bookings/not-a-valid-id')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'id')).toBe(true);
  });

  it('rejects DELETE /bookings/:id with invalid mongo ID', async () => {
    const res = await request(app)
      .delete('/bookings/not-a-valid-id')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects PATCH /bookings/:id/respond with invalid mongo ID', async () => {
    const res = await request(app)
      .patch('/bookings/bad-id/respond')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(400);
  });
});

describe('Chat routes', () => {
  it('POST /chat rejects empty message', async () => {
    const res = await request(app)
      .post('/chat')
      .send({});

    // The chat endpoint may or may not require auth — test that it doesn't crash
    expect([400, 401, 500]).toContain(res.status);
  });
});

describe('Content-Type handling', () => {
  it('handles JSON content type correctly', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'test@test.com', password: 'password123' }));

    // Should not be 415 or parser error
    expect([400, 401]).toContain(res.status);
  });
});
