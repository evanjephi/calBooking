import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyBookings from '../pages/MyBookings';

// Mock the API
vi.mock('../api/api', () => ({
  getBookings: vi.fn(),
  cancelBooking: vi.fn(),
}));

import { getBookings, cancelBooking } from '../api/api';

/** Helper: builds a booking object matching API shape */
function makeBooking(overrides = {}) {
  return {
    _id: 'b1',
    status: 'confirmed',
    startTime: '2026-04-10T09:00:00.000Z',
    endTime: '2026-04-10T12:00:00.000Z',
    serviceLevel: 'home_helper',
    recurring: false,
    pswWorker: {
      _id: 'psw1',
      firstName: 'Sarah',
      lastName: 'Miller',
    },
    ...overrides,
  };
}

function renderMyBookings() {
  return render(
    <MemoryRouter>
      <MyBookings />
    </MemoryRouter>
  );
}

describe('MyBookings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getBookings.mockReturnValue(new Promise(() => {})); // never resolves
    renderMyBookings();
    expect(screen.getByText('Loading bookings…')).toBeInTheDocument();
  });

  it('shows empty state when no bookings exist', async () => {
    getBookings.mockResolvedValue([]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('No bookings yet')).toBeInTheDocument();
    });
    expect(screen.getByText('Book a Caregiver')).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getBookings.mockRejectedValue(new Error('Server down'));
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Server down')).toBeInTheDocument();
    });
  });

  it('renders a booking with PSW name, status, and service level', async () => {
    getBookings.mockResolvedValue([makeBooking()]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Sarah Miller')).toBeInTheDocument();
    });
    expect(screen.getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByText('Home Helper')).toBeInTheDocument();
  });

  it('renders booking date and time', async () => {
    getBookings.mockResolvedValue([makeBooking()]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Sarah Miller')).toBeInTheDocument();
    });
    const dateEl = screen.getByText(/Apr/);
    expect(dateEl).toBeInTheDocument();
  });

  // ---- Chat assistant booking tests ----

  it('displays a booking created by the chat assistant', async () => {
    const chatBooking = makeBooking({
      _id: 'chat-booking-1',
      status: 'confirmed',
      serviceLevel: 'care_services',
      startTime: '2026-04-15T10:00:00.000Z',
      endTime: '2026-04-15T14:00:00.000Z',
      pswWorker: {
        _id: 'psw2',
        firstName: 'Emma',
        lastName: 'Wilson',
      },
    });

    getBookings.mockResolvedValue([chatBooking]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    });
    expect(screen.getByText('Care Services')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });

  it('re-fetches bookings when "booking-created" event fires (chat assistant flow)', async () => {
    // Initially no bookings
    getBookings.mockResolvedValue([]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('No bookings yet')).toBeInTheDocument();
    });

    // Chat assistant creates a booking → dispatches event
    const chatBooking = makeBooking({
      _id: 'chat-created-1',
      serviceLevel: 'specialized_care',
      pswWorker: { _id: 'psw3', firstName: 'Lisa', lastName: 'Chen' },
    });
    getBookings.mockResolvedValue([chatBooking]);

    act(() => {
      window.dispatchEvent(new Event('booking-created'));
    });

    await waitFor(() => {
      expect(screen.getByText('Lisa Chen')).toBeInTheDocument();
    });
    expect(screen.getByText('Specialized Care')).toBeInTheDocument();
    // getBookings called twice: once on mount, once on event
    expect(getBookings).toHaveBeenCalledTimes(2);
  });

  // ---- Other MyBookings tests ----

  it('groups multiple bookings under the same PSW', async () => {
    getBookings.mockResolvedValue([
      makeBooking({ _id: 'b1', startTime: '2026-04-10T09:00:00.000Z' }),
      makeBooking({ _id: 'b2', startTime: '2026-04-11T09:00:00.000Z' }),
    ]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Sarah Miller')).toBeInTheDocument();
    });
    expect(screen.getByText('2 bookings')).toBeInTheDocument();
  });

  it('shows cancel button for future confirmed bookings', async () => {
    getBookings.mockResolvedValue([
      makeBooking({ startTime: '2027-12-01T09:00:00.000Z', endTime: '2027-12-01T12:00:00.000Z' }),
    ]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('does not show cancel button for cancelled bookings', async () => {
    getBookings.mockResolvedValue([
      makeBooking({ status: 'cancelled' }),
    ]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('cancelled')).toBeInTheDocument();
    });
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('handles cancel flow', async () => {
    window.confirm = vi.fn(() => true);
    cancelBooking.mockResolvedValue({});

    getBookings.mockResolvedValue([
      makeBooking({ _id: 'b-cancel', startTime: '2027-12-01T09:00:00.000Z', endTime: '2027-12-01T12:00:00.000Z' }),
    ]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(cancelBooking).toHaveBeenCalledWith('b-cancel');
    });
    expect(screen.getByText('cancelled')).toBeInTheDocument();
  });

  it('separates recurring and one-time bookings', async () => {
    getBookings.mockResolvedValue([
      makeBooking({ _id: 'r1', recurring: true, startTime: '2026-04-10T09:00:00.000Z', endTime: '2026-05-10T09:00:00.000Z' }),
      makeBooking({ _id: 'o1', recurring: false }),
    ]);
    renderMyBookings();

    await waitFor(() => {
      expect(screen.getByText(/Recurring/)).toBeInTheDocument();
    });
    expect(screen.getByText(/One-Time/)).toBeInTheDocument();
  });
});