import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from '../components/ChatWidget';

// Mock ChatPanel to avoid complex dependencies
vi.mock('../components/ChatPanel', () => ({
  default: ({ onClose }) => <div data-testid="chat-panel"><button onClick={onClose}>Close</button></div>,
}));

function renderWidget(user) {
  vi.doMock('../context/AuthContext', () => ({
    useAuth: () => ({ user, loading: false }),
  }));
}

// Use a wrapper approach for different auth states
vi.mock('../context/AuthContext', () => {
  let mockUser = null;
  return {
    useAuth: () => ({ user: mockUser, loading: false }),
    __setMockUser: (u) => { mockUser = u; },
  };
});

import { __setMockUser } from '../context/AuthContext';

describe('ChatWidget', () => {
  it('renders nothing for non-logged-in users', () => {
    __setMockUser(null);
    const { container } = render(
      <MemoryRouter>
        <ChatWidget />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for admin users', () => {
    __setMockUser({ role: 'admin', firstName: 'Admin', email: 'admin@test.com' });
    const { container } = render(
      <MemoryRouter>
        <ChatWidget />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the FAB button for client users', () => {
    __setMockUser({ role: 'client', firstName: 'Jane', email: 'jane@test.com' });
    render(
      <MemoryRouter>
        <ChatWidget />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Open booking assistant')).toBeInTheDocument();
    expect(screen.getByText('Need Help?')).toBeInTheDocument();
  });

  it('renders the FAB button for PSW users', () => {
    __setMockUser({ role: 'psw', firstName: 'John', email: 'john@test.com' });
    render(
      <MemoryRouter>
        <ChatWidget />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Open booking assistant')).toBeInTheDocument();
  });

  it('opens chat panel when FAB is clicked', async () => {
    __setMockUser({ role: 'client', firstName: 'Jane', email: 'jane@test.com' });
    render(
      <MemoryRouter>
        <ChatWidget />
      </MemoryRouter>
    );

    const fab = screen.getByLabelText('Open booking assistant');
    fireEvent.click(fab);

    await waitFor(() => {
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });
  });
});
