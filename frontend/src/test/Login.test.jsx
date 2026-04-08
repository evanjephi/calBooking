import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    loading: false,
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

const getEmail = () => document.querySelector('input[type="email"]');
const getPassword = () => document.querySelector('input[type="password"]');

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sign-in form', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(getEmail()).toBeInTheDocument();
    expect(getPassword()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('has links to registration pages', () => {
    renderLogin();
    expect(screen.getByText('Register')).toHaveAttribute('href', '/register');
    expect(screen.getByText('Register as a provider')).toHaveAttribute('href', '/register/psw');
  });

  it('updates input values when typing', () => {
    renderLogin();
    fireEvent.change(getEmail(), { target: { value: 'test@test.com' } });
    fireEvent.change(getPassword(), { target: { value: 'mypassword' } });

    expect(getEmail()).toHaveValue('test@test.com');
    expect(getPassword()).toHaveValue('mypassword');
  });

  it('calls login and navigates to /find-psw for client', async () => {
    mockLogin.mockResolvedValue({ role: 'client' });
    renderLogin();

    fireEvent.change(getEmail(), { target: { value: 'client@test.com' } });
    fireEvent.change(getPassword(), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('client@test.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/find-psw');
    });
  });

  it('navigates to /admin for admin role', async () => {
    mockLogin.mockResolvedValue({ role: 'admin' });
    renderLogin();

    fireEvent.change(getEmail(), { target: { value: 'admin@test.com' } });
    fireEvent.change(getPassword(), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  it('navigates to /dashboard for PSW role', async () => {
    mockLogin.mockResolvedValue({ role: 'psw' });
    renderLogin();

    fireEvent.change(getEmail(), { target: { value: 'psw@test.com' } });
    fireEvent.change(getPassword(), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    renderLogin();

    fireEvent.change(getEmail(), { target: { value: 'bad@test.com' } });
    fireEvent.change(getPassword(), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    let resolveLogin;
    mockLogin.mockImplementation(() => new Promise(r => { resolveLogin = r; }));
    renderLogin();

    fireEvent.change(getEmail(), { target: { value: 'test@test.com' } });
    fireEvent.change(getPassword(), { target: { value: 'pass123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Signing in…')).toBeInTheDocument();

    resolveLogin({ role: 'client' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });
  });
});
