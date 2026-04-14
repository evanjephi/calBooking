import { describe, it, expect, beforeAll  } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const { default: app } = await import('../server.js');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Admin token for protected routes
const adminToken = jwt.sign(
  { id: '507f1f77bcf86cd799439011', email: 'admin@test.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Client token (non-admin)
const clientToken = jwt.sign(
  { id: '507f1f77bcf86cd799439022', email: 'client@test.com', role: 'client' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('Service Levels - Public API', () => {
  it('GET /service-levels returns an array', async () => {
    const res = await request(app).get('/service-levels');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /service-levels returns seeded defaults', async () => {
    const res = await request(app).get('/service-levels');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    const keys = res.body.map(l => l.key);
    expect(keys).toContain('home_helper');
    expect(keys).toContain('care_services');
    expect(keys).toContain('specialized_care');
  });

  it('returns expected fields on each service level', async () => {
    const res = await request(app).get('/service-levels');
    const level = res.body[0];
    expect(level).toHaveProperty('key');
    expect(level).toHaveProperty('label');
    expect(level).toHaveProperty('clientRate');
    expect(level).toHaveProperty('pswRate');
    expect(typeof level.clientRate).toBe('number');
    expect(typeof level.pswRate).toBe('number');
  });

  it('only returns active service levels on public endpoint', async () => {
    const res = await request(app).get('/service-levels');
    for (const level of res.body) {
      expect(level.active).not.toBe(false);
    }
  });
});

describe('Service Levels - Admin API', () => {
  it('GET /admin/service-levels requires auth', async () => {
    const res = await request(app).get('/admin/service-levels');
    expect(res.status).toBe(401);
  });

  it('GET /admin/service-levels rejects non-admin', async () => {
    const res = await request(app)
      .get('/admin/service-levels')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /admin/service-levels returns all levels for admin', async () => {
    const res = await request(app)
      .get('/admin/service-levels')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  let createdId;

  it('POST /admin/service-levels creates a new level', async () => {
    const res = await request(app)
      .post('/admin/service-levels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'test_level',
        label: 'Test Service',
        description: 'For testing',
        clientRate: 30.00,
        pswRate: 22.00,
        icon: '🧪',
        examples: 'Test examples',
        popular: false,
        active: true,
        sortOrder: 99
      });
    expect(res.status).toBe(201);
    expect(res.body.key).toBe('test_level');
    expect(res.body.clientRate).toBe(30);
    expect(res.body.pswRate).toBe(22);
    createdId = res.body._id;
  });

  it('PUT /admin/service-levels/:id updates a level', async () => {
    const res = await request(app)
      .put(`/admin/service-levels/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientRate: 35.00, label: 'Updated Test Service' });
    expect(res.status).toBe(200);
    expect(res.body.clientRate).toBe(35);
    expect(res.body.label).toBe('Updated Test Service');
  });

  it('new level appears in public endpoint', async () => {
    const res = await request(app).get('/service-levels');
    const keys = res.body.map(l => l.key);
    expect(keys).toContain('test_level');
  });

  it('DELETE /admin/service-levels/:id removes a level', async () => {
    const res = await request(app)
      .delete(`/admin/service-levels/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('deleted level no longer appears', async () => {
    const res = await request(app).get('/service-levels');
    const keys = res.body.map(l => l.key);
    expect(keys).not.toContain('test_level');
  });

  it('POST /admin/service-levels rejects duplicate key', async () => {
    const res = await request(app)
      .post('/admin/service-levels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'home_helper',
        label: 'Duplicate',
        clientRate: 20,
        pswRate: 15
      });
    expect([400, 409]).toContain(res.status);
  });
});

describe('Dynamic Rates - config/rates.js', () => {
  it('getRateForLevel returns a PSW rate number from DB', async () => {
    const { getRateForLevel } = await import('../config/rates.js');
    const rate = await getRateForLevel('home_helper');
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThan(0);
  });

  it('getRateForLevel returns null for unknown key', async () => {
    const { getRateForLevel } = await import('../config/rates.js');
    const rate = await getRateForLevel('nonexistent_level');
    expect(rate).toBeNull();
  });

  it('getServiceRates returns object with all active levels', async () => {
    const { getServiceRates } = await import('../config/rates.js');
    const rates = await getServiceRates();
    expect(rates).toHaveProperty('home_helper');
    expect(rates).toHaveProperty('care_services');
    expect(rates).toHaveProperty('specialized_care');
  });

  it('getClientRates returns only client rates', async () => {
    const { getClientRates } = await import('../config/rates.js');
    const rates = await getClientRates();
    expect(rates).toHaveProperty('home_helper');
    expect(typeof rates.home_helper).toBe('number');
  });
});
