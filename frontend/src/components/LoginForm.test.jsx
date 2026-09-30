import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginForm from './LoginForm';
import * as AuthContextModule from '../context/AuthContext';

describe('LoginForm Component', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      user: null,
      loading: false,
      error: null,
    });
  });

  it('renders form inputs and disabled submit button initially', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/Work Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeDisabled();
  });

  it('masks password input with type="password"', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/Password/i)).toHaveAttribute('type', 'password');
  });

  it('disables submit button when email consists only of whitespace', () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign in/i });

    fireEvent.change(emailInput, { target: { value: '   ' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when valid email and password are typed', () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign in/i });

    fireEvent.change(emailInput, { target: { value: 'hr@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(submitBtn).toBeEnabled();
  });

  it('populates credentials when clicking Fill HR Manager demo button', () => {
    render(<LoginForm />);

    const demoBtn = screen.getByRole('button', { name: /Fill HR Manager/i });
    fireEvent.click(demoBtn);

    expect(screen.getByLabelText(/Work Email/i)).toHaveValue('hr@example.com');
    expect(screen.getByLabelText(/Password/i)).toHaveValue('password123');
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeEnabled();
  });

  it('populates credentials when clicking Fill Org Admin demo button', () => {
    render(<LoginForm />);

    const demoBtn = screen.getByRole('button', { name: /Fill Org Admin/i });
    fireEvent.click(demoBtn);

    expect(screen.getByLabelText(/Work Email/i)).toHaveValue('admin@example.com');
    expect(screen.getByLabelText(/Password/i)).toHaveValue('password123');
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeEnabled();
  });

  it('calls login on submit with form data', async () => {
    mockLogin.mockResolvedValueOnce({ id: 1, email: 'hr@example.com' });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'hr@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('hr@example.com', 'password123');
    });
  });

  it('displays error banner when authentication fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
    });
  });
});
