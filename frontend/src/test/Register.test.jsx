import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register';

const mockRegister = vi.fn();
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
    register: mockRegister,
    user: null,
    loading: false,
  }),
}));

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

const getInput = (type) => document.querySelector(`input[type="${type}"]`);
const getInputByPlaceholder = (ph) => screen.getByPlaceholderText(ph);

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the registration form', () => {
    renderRegister();
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(getInput('email')).toBeInTheDocument();
    expect(getInput('password')).toBeInTheDocument();
  });

  it('has a link to login page', () => {
    renderRegister();
    expect(screen.getByText('Sign In')).toHaveAttribute('href', '/login');
  });

  it('submits with correct payload', async () => {
    mockRegister.mockResolvedValue({ role: 'client' });
    renderRegister();

    const inputs = document.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: 'Jane' } }); // First Name
    fireEvent.change(inputs[1], { target: { value: 'Doe' } });  // Last Name
    fireEvent.change(getInput('email'), { target: { value: 'jane@test.com' } });
    fireEvent.change(getInput('password'), { target: { value: 'securePass123' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        password: 'securePass123',
      });
    });
  });

  it('navigates to /find-psw on success', async () => {
    mockRegister.mockResolvedValue({ role: 'client' });
    renderRegister();

    const inputs = document.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: 'Jane' } });
    fireEvent.change(inputs[1], { target: { value: 'Doe' } });
    fireEvent.change(getInput('email'), { target: { value: 'jane@test.com' } });
    fireEvent.change(getInput('password'), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/find-psw');
    });
  });

  it('shows error on failure', async () => {
    mockRegister.mockRejectedValue(new Error('Email already registered'));
    renderRegister();

    const inputs = document.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: 'Jane' } });
    fireEvent.change(inputs[1], { target: { value: 'Doe' } });
    fireEvent.change(getInput('email'), { target: { value: 'jane@test.com' } });
    fireEvent.change(getInput('password'), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('includes address in payload when provided', async () => {
    mockRegister.mockResolvedValue({ role: 'client' });
    renderRegister();

    const inputs = document.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: 'Jane' } });
    fireEvent.change(inputs[1], { target: { value: 'Doe' } });
    fireEvent.change(getInput('email'), { target: { value: 'jane@test.com' } });
    fireEvent.change(getInput('password'), { target: { value: 'securePass123' } });
    fireEvent.change(getInputByPlaceholder('e.g. Toronto'), { target: { value: 'Toronto' } });
    fireEvent.change(getInputByPlaceholder('e.g. M5V 2T6'), { target: { value: 'M5H 2N2' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
        address: expect.objectContaining({
          city: 'Toronto',
          postalCode: 'M5H 2N2',
        }),
      }));
    });
  });
});
