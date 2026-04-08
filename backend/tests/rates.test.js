import { describe, it, expect } from 'vitest';

const { SERVICE_RATES } = await import('../config/rates.js');

describe('SERVICE_RATES', () => {
  it('defines home_helper rate', () => {
    expect(SERVICE_RATES.home_helper).toBe(18.51);
  });

  it('defines care_services rate', () => {
    expect(SERVICE_RATES.care_services).toBe(19.99);
  });

  it('defines specialized_care rate', () => {
    expect(SERVICE_RATES.specialized_care).toBe(21.25);
  });

  it('has exactly 3 service levels', () => {
    expect(Object.keys(SERVICE_RATES)).toHaveLength(3);
  });

  it('all rates are positive numbers', () => {
    for (const [, rate] of Object.entries(SERVICE_RATES)) {
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThan(0);
    }
  });

  it('rates are ordered home_helper < care_services < specialized_care', () => {
    expect(SERVICE_RATES.home_helper).toBeLessThan(SERVICE_RATES.care_services);
    expect(SERVICE_RATES.care_services).toBeLessThan(SERVICE_RATES.specialized_care);
  });
});
