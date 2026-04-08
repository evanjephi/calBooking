import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Prevent window.location.replace from navigating
Object.defineProperty(window, 'location', {
  value: { replace: vi.fn() },
  writable: true,
});

describe('API module', () => {
  let api;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Re-import to reset module state
    vi.resetModules();
    api = await import('../api/api.js');
  });

  describe('Token management', () => {
    it('setToken stores token in localStorage', () => {
      api.setToken('my-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'my-token');
    });

    it('clearToken removes token from localStorage', () => {
      api.clearToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('Auth API calls', () => {
    it('login sends POST to /auth/login', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'jwt-123', user: { role: 'client' } }),
      });

      const result = await api.login({ email: 'test@test.com', password: 'pass' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@test.com', password: 'pass' }),
        })
      );
      expect(result.token).toBe('jwt-123');
    });

    it('register sends POST to /auth/register', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ token: 'jwt-456', user: { role: 'client' } }),
      });

      const result = await api.register({ email: 'new@test.com', password: 'pass123', firstName: 'A', lastName: 'B' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.token).toBe('jwt-456');
    });

    it('getMe sends GET to /auth/me', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ email: 'test@test.com', role: 'client' }),
      });

      const result = await api.getMe();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.email).toBe('test@test.com');
    });
  });

  describe('Error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad request' }),
      });

      await expect(api.login({ email: 'a', password: 'b' }))
        .rejects.toThrow('Bad request');
    });

    it('clears token and redirects on 401 for non-auth routes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      await expect(api.getBookings()).rejects.toThrow('Session expired');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });

    it('does NOT redirect on 401 for auth routes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      await expect(api.login({ email: 'a', password: 'b' }))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('Booking request pipeline', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'req-1' }),
      });
    });

    it('createBookingRequest sends POST to /booking-requests', async () => {
      await api.createBookingRequest({ city: 'Toronto', postalCode: 'M5H' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/booking-requests'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('checkAvailability sends GET with correct ID', async () => {
      await api.checkAvailability('abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/booking-requests/abc123/availability'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('selectPSW sends PATCH with body', async () => {
      await api.selectPSW('abc123', { pswWorkerId: 'psw-1' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/booking-requests/abc123/select-psw'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('finalizeBooking sends POST', async () => {
      await api.finalizeBooking('abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/booking-requests/abc123/finalize'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Booking management', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
    });

    it('getBookings sends GET to /bookings', async () => {
      await api.getBookings();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('cancelBooking sends DELETE with correct ID', async () => {
      await api.cancelBooking('booking-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings/booking-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Authorization header', () => {
    it('includes Bearer token when set', async () => {
      api.setToken('my-jwt-token');

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await api.getMe();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });
  });
});
