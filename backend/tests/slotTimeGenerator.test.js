import { describe, it, expect } from 'vitest';

const { generateSlotTimes, localToUTC, DEFAULT_TIMEZONE, TIME_RANGES, DURATION_HOURS, DAY_TO_JS, getWeekStart } =
  await import('../services/slotTimeGenerator.js');

const { DateTime } = await import('luxon');

describe('TIME_RANGES constants', () => {
  it('defines all four time ranges', () => {
    expect(TIME_RANGES).toHaveProperty('daytime');
    expect(TIME_RANGES).toHaveProperty('evening');
    expect(TIME_RANGES).toHaveProperty('overnight');
    expect(TIME_RANGES).toHaveProperty('weekend');
  });

  it('daytime runs 9-16', () => {
    expect(TIME_RANGES.daytime).toEqual({ start: 9, end: 16 });
  });

  it('evening runs 16-23', () => {
    expect(TIME_RANGES.evening).toEqual({ start: 16, end: 23 });
  });

  it('overnight runs 22-7 (wraps midnight)', () => {
    expect(TIME_RANGES.overnight).toEqual({ start: 22, end: 7 });
  });
});

describe('DURATION_HOURS constants', () => {
  it('maps all visit duration strings', () => {
    expect(DURATION_HOURS['1 hour']).toBe(1);
    expect(DURATION_HOURS['2-3 hours']).toBe(2.5);
    expect(DURATION_HOURS['4-6 hours']).toBe(5);
    expect(DURATION_HOURS['more than 6 hours']).toBe(8);
  });
});

describe('DAY_TO_JS mapping', () => {
  it('maps all 7 days to correct JS day numbers', () => {
    expect(DAY_TO_JS.Sunday).toBe(0);
    expect(DAY_TO_JS.Monday).toBe(1);
    expect(DAY_TO_JS.Tuesday).toBe(2);
    expect(DAY_TO_JS.Wednesday).toBe(3);
    expect(DAY_TO_JS.Thursday).toBe(4);
    expect(DAY_TO_JS.Friday).toBe(5);
    expect(DAY_TO_JS.Saturday).toBe(6);
  });
});

describe('getWeekStart', () => {
  it('returns Sunday 00:00 of the same week', () => {
    // Wednesday April 8, 2026
    const wed = new Date(2026, 3, 8, 14, 30, 0);
    const start = getWeekStart(wed);
    expect(start.getDay()).toBe(0); // Sunday
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(5); // April 5, 2026 is a Sunday
  });

  it('returns same day if already Sunday', () => {
    const sun = new Date(2026, 3, 5, 10, 0, 0);
    const start = getWeekStart(sun);
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(5);
  });
});

describe('localToUTC', () => {
  it('converts Toronto 10 AM to correct UTC', () => {
    // April 9 2026 — Toronto is EDT (UTC-4)
    const result = localToUTC(2026, 4, 9, 10, 'America/Toronto');
    expect(result.toISOString()).toBe('2026-04-09T14:00:00.000Z');
  });

  it('converts Edmonton 10 AM to correct UTC', () => {
    // April 9 2026 — Edmonton is MDT (UTC-6)
    const result = localToUTC(2026, 4, 9, 10, 'America/Edmonton');
    expect(result.toISOString()).toBe('2026-04-09T16:00:00.000Z');
  });

  it('converts Vancouver 10 AM to correct UTC', () => {
    // April 9 2026 — Vancouver is PDT (UTC-7)
    const result = localToUTC(2026, 4, 9, 10, 'America/Vancouver');
    expect(result.toISOString()).toBe('2026-04-09T17:00:00.000Z');
  });

  it('handles winter time (EST) correctly', () => {
    // January 15 2026 — Toronto is EST (UTC-5)
    const result = localToUTC(2026, 1, 15, 10, 'America/Toronto');
    expect(result.toISOString()).toBe('2026-01-15T15:00:00.000Z');
  });
});

describe('DEFAULT_TIMEZONE', () => {
  it('defaults to America/Toronto', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Toronto');
  });
});

describe('generateSlotTimes - one-time booking', () => {
  it('generates a single slot for a specific date in the correct timezone', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(Date.UTC(2026, 5, 15)), // June 15, 2026
      timeOfDay: 'daytime',
      visitDuration: '2-3 hours',
      preferredStartHour: 10,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);

    // June 15 2026 Toronto is EDT (UTC-4), so 10 AM local = 14:00 UTC
    expect(slots[0].start.toISOString()).toBe('2026-06-15T14:00:00.000Z');
    // 2.5 hours later = 16:30 UTC
    expect(slots[0].end.toISOString()).toBe('2026-06-15T16:30:00.000Z');
  });

  it('generates correct UTC for Edmonton timezone', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(Date.UTC(2026, 5, 15)),
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredStartHour: 10,
      timezone: 'America/Edmonton'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);
    // June 15 2026 Edmonton is MDT (UTC-6), so 10 AM local = 16:00 UTC
    expect(slots[0].start.toISOString()).toBe('2026-06-15T16:00:00.000Z');
    expect(slots[0].end.toISOString()).toBe('2026-06-15T17:00:00.000Z');
  });

  it('uses timeRange start when no preferredStartHour', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(Date.UTC(2026, 5, 15)),
      timeOfDay: 'evening',
      visitDuration: '1 hour',
      preferredStartHour: null,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);
    // Evening starts at 16, Toronto EDT = UTC-4, so 16:00 local = 20:00 UTC
    expect(slots[0].start.toISOString()).toBe('2026-06-15T20:00:00.000Z');
  });

  it('generates tomorrow when no specificDate', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: null,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);

    const tomorrowLocal = DateTime.now().setZone('America/Toronto').startOf('day').plus({ days: 1 });
    const slotDt = DateTime.fromJSDate(slots[0].start).setZone('America/Toronto');
    expect(slotDt.day).toBe(tomorrowLocal.day);
  });

  it('defaults to America/Toronto when no timezone', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(Date.UTC(2026, 5, 15)),
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredStartHour: 10
      // no timezone field
    };

    const slots = generateSlotTimes(req);
    // Should use Toronto EDT (UTC-4): 10 AM = 14:00 UTC
    expect(slots[0].start.toISOString()).toBe('2026-06-15T14:00:00.000Z');
  });

  it('respects duration "4-6 hours"', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(Date.UTC(2026, 5, 15)),
      timeOfDay: 'daytime',
      visitDuration: '4-6 hours',
      preferredStartHour: 9,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    const durationMs = slots[0].end.getTime() - slots[0].start.getTime();
    expect(durationMs).toBe(5 * 3600000); // 5 hours
  });

  it('respects duration "more than 6 hours"', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(Date.UTC(2026, 5, 15)),
      timeOfDay: 'daytime',
      visitDuration: 'more than 6 hours',
      preferredStartHour: 8,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    const durationMs = slots[0].end.getTime() - slots[0].start.getTime();
    expect(durationMs).toBe(8 * 3600000); // 8 hours
  });
});

describe('generateSlotTimes - recurring booking', () => {
  it('generates correct total slots for 3 days/week over 2 weeks', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 3,
      lengthOfCareWeeks: 2,
      timeOfDay: 'daytime',
      visitDuration: '2-3 hours',
      preferredDays: ['Monday', 'Wednesday', 'Friday'],
      preferredStartHour: 9,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(6); // 3 × 2

    // Verify all slots are Mon/Wed/Fri in Toronto timezone
    for (const slot of slots) {
      const local = DateTime.fromJSDate(slot.start).setZone('America/Toronto');
      expect([1, 3, 5]).toContain(local.weekday); // Luxon: 1=Mon, 3=Wed, 5=Fri
    }
  });

  it('generates correct total slots for 1 day/week over 4 weeks', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 1,
      lengthOfCareWeeks: 4,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: ['Tuesday'],
      preferredStartHour: 14,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(4);

    // All should be Tuesday at 14:00 in Toronto
    for (const slot of slots) {
      const local = DateTime.fromJSDate(slot.start).setZone('America/Toronto');
      expect(local.weekday).toBe(2); // Tuesday
      expect(local.hour).toBe(14);
    }
  });

  it('defaults to weekdays for daytime with no preferredDays', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 5,
      lengthOfCareWeeks: 1,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: [],
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    // Should pick weekdays (Mon-Fri)
    for (const slot of slots) {
      const local = DateTime.fromJSDate(slot.start).setZone('America/Toronto');
      expect(local.weekday).toBeGreaterThanOrEqual(1);
      expect(local.weekday).toBeLessThanOrEqual(5);
    }
  });

  it('defaults to weekend days for weekend timeOfDay', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 2,
      lengthOfCareWeeks: 1,
      timeOfDay: 'weekend',
      visitDuration: '2-3 hours',
      preferredDays: [],
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(2);

    for (const slot of slots) {
      const local = DateTime.fromJSDate(slot.start).setZone('America/Toronto');
      expect([6, 7]).toContain(local.weekday); // Luxon: 6=Saturday, 7=Sunday
    }
  });

  it('respects per-week slot cap', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 2,
      lengthOfCareWeeks: 2,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    // 2 per week × 2 weeks = 4 max
    expect(slots).toHaveLength(4);
  });

  it('each slot has correct duration', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 2,
      lengthOfCareWeeks: 1,
      timeOfDay: 'daytime',
      visitDuration: '2-3 hours',
      preferredDays: ['Monday', 'Wednesday'],
      preferredStartHour: 10,
      timezone: 'America/Toronto'
    };

    const slots = generateSlotTimes(req);
    for (const slot of slots) {
      const durationMs = slot.end.getTime() - slot.start.getTime();
      expect(durationMs).toBe(2.5 * 3600000);
    }
  });

  it('all slots start in the future', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 3,
      lengthOfCareWeeks: 1,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: ['Monday', 'Wednesday', 'Friday'],
      timezone: 'America/Toronto'
    };

    const now = new Date();
    const slots = generateSlotTimes(req);
    for (const slot of slots) {
      expect(slot.start.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it('generates correct UTC for different timezones', () => {
    const baseReq = {
      bookingType: 'recurring',
      daysPerWeek: 1,
      lengthOfCareWeeks: 1,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: ['Monday'],
      preferredStartHour: 10,
    };

    const torontoSlots = generateSlotTimes({ ...baseReq, timezone: 'America/Toronto' });
    const edmontonSlots = generateSlotTimes({ ...baseReq, timezone: 'America/Edmonton' });

    // Both should produce 10 AM in their local timezone
    const torontoLocal = DateTime.fromJSDate(torontoSlots[0].start).setZone('America/Toronto');
    const edmontonLocal = DateTime.fromJSDate(edmontonSlots[0].start).setZone('America/Edmonton');

    expect(torontoLocal.hour).toBe(10);
    expect(edmontonLocal.hour).toBe(10);

    // But the UTC times should differ (Edmonton is 2 hours behind Toronto in summer)
    expect(edmontonSlots[0].start.getTime()).toBeGreaterThan(torontoSlots[0].start.getTime());
  });
});
