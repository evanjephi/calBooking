import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminRoute from '../components/AdminRoute';

vi.mock('../context/AuthContext', () => {
  let mockUser = null;
  let mockLoading = false;
  return {
    useAuth: () => ({ user: mockUser, loading: mockLoading }),
    __setMockUser: (u) => { mockUser = u; },
    __setMockLoading: (l) => { mockLoading = l; },
  };
});

import { __setMockUser, __setMockLoading } from '../context/AuthContext';

describe('AdminRoute', () => {
  it('shows loading text while loading', () => {
    __setMockUser(null);
    __setMockLoading(true);
    render(
      <MemoryRouter>
        <AdminRoute><div>Admin Content</div></AdminRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('redirects to /login when no user', () => {
    __setMockUser(null);
    __setMockLoading(false);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute><div>Admin Content</div></AdminRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('redirects to / when user is not admin', () => {
    __setMockUser({ role: 'client', firstName: 'Jane' });
    __setMockLoading(false);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute><div>Admin Content</div></AdminRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('redirects PSW users away from admin', () => {
    __setMockUser({ role: 'psw', firstName: 'John' });
    __setMockLoading(false);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute><div>Admin Content</div></AdminRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children for admin users', () => {
    __setMockUser({ role: 'admin', firstName: 'Super' });
    __setMockLoading(false);
    render(
      <MemoryRouter>
        <AdminRoute><div>Admin Content</div></AdminRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});
