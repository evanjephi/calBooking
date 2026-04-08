import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Dynamic import for CJS module
const { default: app } = await import('../server.js');

describe('GET /', () => {
  it('responds with "API running"', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('API running');
  });
});
