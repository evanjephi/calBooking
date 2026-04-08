import { describe, it, expect } from 'vitest';

const { generateSlotTimes, TIME_RANGES, DURATION_HOURS, DAY_TO_JS, getWeekStart } =
  await import('../services/slotTimeGenerator.js');

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

describe('generateSlotTimes - one-time booking', () => {
  it('generates a single slot for a specific date', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(2026, 5, 15), // June 15, 2026
      timeOfDay: 'daytime',
      visitDuration: '2-3 hours',
      preferredStartHour: 10
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);
    expect(slots[0].start.getHours()).toBe(10);
    // 2.5 hours later = 12:30
    expect(slots[0].end.getHours()).toBe(12);
    expect(slots[0].end.getMinutes()).toBe(30);
  });

  it('uses timeRange start when no preferredStartHour', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(2026, 5, 15),
      timeOfDay: 'evening',
      visitDuration: '1 hour',
      preferredStartHour: null
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);
    expect(slots[0].start.getHours()).toBe(16); // evening starts at 16
  });

  it('generates tomorrow when no specificDate', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: null,
      timeOfDay: 'daytime',
      visitDuration: '1 hour'
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(slots[0].start.getDate()).toBe(tomorrow.getDate());
  });

  it('respects duration "4-6 hours"', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(2026, 5, 15),
      timeOfDay: 'daytime',
      visitDuration: '4-6 hours',
      preferredStartHour: 9
    };

    const slots = generateSlotTimes(req);
    const durationMs = slots[0].end.getTime() - slots[0].start.getTime();
    expect(durationMs).toBe(5 * 3600000); // 5 hours
  });

  it('respects duration "more than 6 hours"', () => {
    const req = {
      bookingType: 'one-time',
      specificDate: new Date(2026, 5, 15),
      timeOfDay: 'daytime',
      visitDuration: 'more than 6 hours',
      preferredStartHour: 8
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
      preferredStartHour: 9
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(6); // 3 × 2

    // All should be Mon/Wed/Fri
    for (const slot of slots) {
      expect([1, 3, 5]).toContain(slot.start.getDay());
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
      preferredStartHour: 14
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(4);

    // All should be Tuesday
    for (const slot of slots) {
      expect(slot.start.getDay()).toBe(2);
      expect(slot.start.getHours()).toBe(14);
    }
  });

  it('defaults to weekdays for daytime with no preferredDays', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 5,
      lengthOfCareWeeks: 1,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: []
    };

    const slots = generateSlotTimes(req);
    // Should pick weekdays (Mon-Fri)
    for (const slot of slots) {
      expect(slot.start.getDay()).toBeGreaterThanOrEqual(1);
      expect(slot.start.getDay()).toBeLessThanOrEqual(5);
    }
  });

  it('defaults to weekend days for weekend timeOfDay', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 2,
      lengthOfCareWeeks: 1,
      timeOfDay: 'weekend',
      visitDuration: '2-3 hours',
      preferredDays: []
    };

    const slots = generateSlotTimes(req);
    expect(slots).toHaveLength(2);

    for (const slot of slots) {
      expect([0, 6]).toContain(slot.start.getDay()); // Sunday or Saturday
    }
  });

  it('respects per-week slot cap', () => {
    const req = {
      bookingType: 'recurring',
      daysPerWeek: 2,
      lengthOfCareWeeks: 2,
      timeOfDay: 'daytime',
      visitDuration: '1 hour',
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
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
      preferredStartHour: 10
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
      preferredDays: ['Monday', 'Wednesday', 'Friday']
    };

    const now = new Date();
    const slots = generateSlotTimes(req);
    for (const slot of slots) {
      expect(slot.start.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});
