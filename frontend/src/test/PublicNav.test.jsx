import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PublicNav from '../components/PublicNav';

vi.mock('../context/AuthContext', () => {
  let mockUser = null;
  return {
    useAuth: () => ({ user: mockUser, loading: false, logout: vi.fn() }),
    __setMockUser: (u) => { mockUser = u; },
  };
});

import { __setMockUser } from '../context/AuthContext';

describe('PublicNav', () => {
  it('renders brand name', () => {
    __setMockUser(null);
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );
    expect(screen.getByText('PremierPSW')).toBeInTheDocument();
  });

  it('shows public links', () => {
    __setMockUser(null);
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );
    expect(screen.getByText('Resources for clients')).toBeInTheDocument();
    expect(screen.getByText('About Us')).toBeInTheDocument();
    expect(screen.getByText('Contact Us')).toBeInTheDocument();
  });

  it('shows Sign up and Log in for unauthenticated users', () => {
    __setMockUser(null);
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );
    expect(screen.getByText('Sign up')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('shows Find PSW link for client users', () => {
    __setMockUser({ role: 'client', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );
    expect(screen.getByText('Find PSW')).toBeInTheDocument();
    expect(screen.getByText('My Bookings')).toBeInTheDocument();
  });

  it('shows Dashboard link for PSW users', () => {
    __setMockUser({ role: 'psw', firstName: 'John', lastName: 'Smith', email: 'john@test.com' });
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('shows user initials when logged in', () => {
    __setMockUser({ role: 'client', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
