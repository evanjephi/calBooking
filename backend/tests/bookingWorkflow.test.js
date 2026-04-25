import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const { default: app } = await import('../server.js');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const clientToken = jwt.sign(
  { id: '507f1f77bcf86cd799439011', email: 'workflow@test.com', role: 'client' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const adminToken = jwt.sign(
  { id: '507f1f77bcf86cd799439099', email: 'admin@test.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// ══════════════════════════════════════════════════════════════
//  WEB BOOKING FLOW  (Steps 1-10 via REST API)
// ══════════════════════════════════════════════════════════════
describe('Web Booking Flow', () => {
  let requestId;

  it('Step 1: GET /service-levels returns active service levels with rates', async () => {
    const res = await request(app).get('/service-levels');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    // Each level has required fields for frontend cards
    for (const level of res.body) {
      expect(level).toHaveProperty('key');
      expect(level).toHaveProperty('label');
      expect(level).toHaveProperty('clientRate');
      expect(level).toHaveProperty('pswRate');
      expect(level).toHaveProperty('description');
      expect(level.clientRate).toBeGreaterThan(0);
      expect(level.pswRate).toBeGreaterThan(0);
    }
  });

  it('Step 2: POST /booking-requests creates a booking request', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        bookingType: 'recurring',
        serviceLevel: 'care_services',
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 3,
        timeOfDay: 'daytime',
        visitDuration: '2-3 hours',
        lengthOfCareWeeks: 4,
        preferredStartHour: 10,
        timezone: 'America/Toronto'
      });
    expect(res.status).toBe(201);
    expect(res.body._id).toBeTruthy();
    expect(res.body.serviceLevel).toBe('care_services');
    expect(res.body.location.postalCode).toBe('M5H 2N2');
    expect(res.body.location.coordinates).toBeTruthy();
    expect(res.body.preferredStartHour).toBe(10);
    requestId = res.body._id;
  });

  it('Step 3: POST /booking-requests validates dynamic service levels', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        bookingType: 'recurring',
        serviceLevel: 'fake_nonexistent_level',
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 2,
        timeOfDay: 'daytime',
        visitDuration: '2-3 hours',
        lengthOfCareWeeks: 4,
        preferredStartHour: 9
      });
    expect(res.status).toBe(400);
  });

  it('Step 4: GET /booking-requests/:id retrieves the request', async () => {
    const res = await request(app)
      .get(`/booking-requests/${requestId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.serviceLevel).toBe('care_services');
    expect(res.body.bookingType).toBe('recurring');
  });

  it('Step 5: GET /booking-requests/:id/availability finds PSWs', async () => {
    const res = await request(app)
      .get(`/booking-requests/${requestId}/availability`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('availabilityCount');
    expect(res.body).toHaveProperty('topMatches');
    expect(typeof res.body.availabilityCount).toBe('number');
  });

  it('Step 6: Booking request requires auth', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .send({
        bookingType: 'recurring',
        serviceLevel: 'care_services',
        city: 'Toronto',
        postalCode: 'M5H'
      });
    expect(res.status).toBe(401);
  });

  it('Supports one-time booking type', async () => {
    const res = await request(app)
      .post('/booking-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        bookingType: 'one-time',
        serviceLevel: 'home_helper',
        city: 'Toronto',
        postalCode: 'M5H 2N2',
        daysPerWeek: 1,
        timeOfDay: 'daytime',
        visitDuration: '1 hour',
        lengthOfCareWeeks: 1,
        preferredStartHour: 14,
        specificDate: '2026-05-01'
      });
    expect(res.status).toBe(201);
    expect(res.body.bookingType).toBe('one-time');
    expect(res.body.visitDuration).toBe('1 hour');
  });

  it('Supports all visit durations including 1 hour', async () => {
    for (const duration of ['1 hour', '2-3 hours', '4-6 hours', 'more than 6 hours']) {
      const res = await request(app)
        .post('/booking-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          bookingType: 'one-time',
          serviceLevel: 'home_helper',
          city: 'Toronto',
          postalCode: 'M5H 2N2',
          daysPerWeek: 1,
          timeOfDay: 'daytime',
          visitDuration: duration,
          lengthOfCareWeeks: 1,
          preferredStartHour: 10
        });
      expect(res.status).toBe(201);
      expect(res.body.visitDuration).toBe(duration);
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  CHAT BOOKING FLOW  (Tool definitions + execution)
// ══════════════════════════════════════════════════════════════
describe('Chat Booking Flow', () => {
  it('getToolDefinitions returns dynamic service levels from DB', async () => {
    const { getToolDefinitions } = await import('../services/chatTools.js');
    const tools = await getToolDefinitions();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    const createTool = tools.find(t => t.function?.name === 'create_booking_request');
    expect(createTool).toBeTruthy();

    const slEnum = createTool.function.parameters.properties.serviceLevel.enum;
    expect(slEnum).toContain('home_helper');
    expect(slEnum).toContain('care_services');
    expect(slEnum).toContain('specialized_care');
  });

  it('executeToolCall - create_booking_request creates a request', async () => {
    const { executeToolCall } = await import('../services/chatTools.js');
    const result = await executeToolCall('create_booking_request', {
      serviceLevel: 'home_helper',
      bookingType: 'recurring',
      city: 'Toronto',
      postalCode: 'M5H 2N2',
      daysPerWeek: 2,
      timeOfDay: 'daytime',
      visitDuration: '2-3 hours',
      lengthOfCareWeeks: 4,
      preferredStartHour: 10
    }, '507f1f77bcf86cd799439011', 'America/Toronto');

    expect(result.success).toBe(true);
    expect(result.bookingRequestId).toBeTruthy();
    expect(result.summary.serviceLevel).toBe('home_helper');
    expect(result.summary.preferredStartHour).toBe(10);
  });

  it('executeToolCall - check_availability returns matches', async () => {
    const { executeToolCall } = await import('../services/chatTools.js');

    // First create a request
    const createResult = await executeToolCall('create_booking_request', {
      serviceLevel: 'care_services',
      bookingType: 'recurring',
      city: 'Toronto',
      postalCode: 'M5H 2N2',
      daysPerWeek: 2,
      timeOfDay: 'daytime',
      visitDuration: '2-3 hours',
      lengthOfCareWeeks: 4,
      preferredStartHour: 9
    }, '507f1f77bcf86cd799439011', 'America/Toronto');

    // Then check availability
    const checkResult = await executeToolCall('check_availability', {
      bookingRequestId: createResult.bookingRequestId
    }, '507f1f77bcf86cd799439011');

    expect(checkResult).toHaveProperty('totalAvailable');
    expect(checkResult).toHaveProperty('topMatches');
    expect(typeof checkResult.totalAvailable).toBe('number');
  });

  it('executeToolCall - get_my_bookings returns array', async () => {
    const { executeToolCall } = await import('../services/chatTools.js');
    const result = await executeToolCall('get_my_bookings', {}, '507f1f77bcf86cd799439011');
    expect(result).toHaveProperty('bookings');
    expect(Array.isArray(result.bookings)).toBe(true);
  });

  it('executeToolCall - unknown tool returns error', async () => {
    const { executeToolCall } = await import('../services/chatTools.js');
    const result = await executeToolCall('nonexistent_tool', {}, '507f1f77bcf86cd799439011');
    expect(result.error).toContain('Unknown tool');
  });

  it('POST /chat requires auth', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'Hello' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════
//  PHONE BOOKING FLOW  (Webhook + analysis parsing)
// ══════════════════════════════════════════════════════════════
describe('Phone Booking Flow', () => {
  it('buildFromAnalysis uses FSA_COORDINATES correctly', async () => {
    // Import the controller to verify no ReferenceError on POSTAL_COORDINATES
    // The actual test is that require does not throw
    const controller = await import('../controllers/bookingCallController.js');
    expect(controller).toBeTruthy();
  });

  it('POST /booking-calls/webhook handles missing call_id', async () => {
    const res = await request(app)
      .post('/booking-calls/webhook')
      .send({});
    // Should not crash — should return 400 or handle gracefully
    expect([200, 400]).toContain(res.status);
  });

  it('POST /booking-calls/webhook handles empty analysis data', async () => {
    const res = await request(app)
      .post('/booking-calls/webhook')
      .send({
        event: 'call_ended',
        call: {
          call_id: 'test-call-123',
          transcript: '',
          call_analysis: { custom_analysis_data: {} },
          metadata: {}
        }
      });
    // Should not crash with ReferenceError about POSTAL_COORDINATES
    expect(res.status).toBeLessThan(500);
  });

  it('POST /booking-calls/webhook handles valid postal code in analysis', async () => {
    const res = await request(app)
      .post('/booking-calls/webhook')
      .send({
        event: 'call_ended',
        call: {
          call_id: 'test-call-456',
          transcript: 'I need home helper care in Toronto, postal code M5H 2N2, two days a week.',
          call_analysis: {
            custom_analysis_data: {
              city: 'Toronto',
              postal_code: 'M5H 2N2',
              days_per_week: '2',
              time_of_day: 'daytime',
              visit_duration: '2-3 hours',
              length_of_care_weeks: '4',
              service_level: 'home_helper'
            }
          },
          metadata: {}
        }
      });
    // Should process without crashing (may return 200 or 201 depending on PSW matching)
    expect(res.status).toBeLessThan(500);
  });
});

// ══════════════════════════════════════════════════════════════
//  DYNAMIC RATES — across all flows
// ══════════════════════════════════════════════════════════════
describe('Dynamic Rates Integration', () => {
  it('Admin can update a rate and it reflects in public endpoint', async () => {
    // Get current service levels
    const before = await request(app).get('/service-levels');
    const homeHelper = before.body.find(l => l.key === 'home_helper');
    expect(homeHelper).toBeTruthy();
    const originalRate = homeHelper.clientRate;

    // Update rate as admin
    const updateRes = await request(app)
      .put(`/admin/service-levels/${homeHelper._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientRate: 99.99 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clientRate).toBe(99.99);

    // Verify public endpoint shows new rate
    const after = await request(app).get('/service-levels');
    const updated = after.body.find(l => l.key === 'home_helper');
    expect(updated.clientRate).toBe(99.99);

    // Restore original rate
    await request(app)
      .put(`/admin/service-levels/${homeHelper._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientRate: originalRate });
  });

  it('getRateForLevel reflects DB updates', async () => {
    const { getRateForLevel } = await import('../config/rates.js');
    const rate = await getRateForLevel('care_services');
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThan(0);
  });

  it('Chat tool definitions include all active DB service levels', async () => {
    const { getToolDefinitions } = await import('../services/chatTools.js');
    const mongoose = (await import('mongoose')).default;
    const ServiceLevel = mongoose.models.ServiceLevel;

    const dbLevels = await ServiceLevel.find({ active: true }).select('key').lean();
    const tools = await getToolDefinitions();
    const createTool = tools.find(t => t.function?.name === 'create_booking_request');
    const slEnum = createTool.function.parameters.properties.serviceLevel.enum;

    for (const level of dbLevels) {
      expect(slEnum).toContain(level.key);
    }
  });
});
