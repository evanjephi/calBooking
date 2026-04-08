import { describe, it, expect } from 'vitest';

const { geocodePostalCode } = await import('../services/geocoder.js');

describe('geocodePostalCode', () => {
  it('returns coordinates for a valid Toronto postal code', () => {
    const coords = geocodePostalCode('M5H 2N2');
    expect(coords).toBeDefined();
    expect(coords).toHaveLength(2);
    // [lng, lat] — Toronto downtown
    expect(coords[0]).toBeCloseTo(-79.38, 1);
    expect(coords[1]).toBeCloseTo(43.65, 1);
  });

  it('returns coordinates for lowercase postal code', () => {
    const coords = geocodePostalCode('m5h 2n2');
    expect(coords).toBeDefined();
    expect(coords).toHaveLength(2);
  });

  it('returns coordinates for postal code without space', () => {
    const coords = geocodePostalCode('M5H2N2');
    expect(coords).toBeDefined();
  });

  it('returns null for unknown postal code', () => {
    const coords = geocodePostalCode('Z9Z 9Z9');
    expect(coords).toBeNull();
  });

  it('returns null for empty string', () => {
    const coords = geocodePostalCode('');
    expect(coords).toBeNull();
  });

  it('returns null for undefined', () => {
    const coords = geocodePostalCode(undefined);
    expect(coords).toBeNull();
  });

  it('returns coordinates for Scarborough postal code', () => {
    const coords = geocodePostalCode('M1B 0A1');
    expect(coords).toBeDefined();
    expect(coords).toHaveLength(2);
  });
});
