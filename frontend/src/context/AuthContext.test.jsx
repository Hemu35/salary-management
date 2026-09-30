import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import * as authApi from '../api/auth';

function TestConsumer() {
  const { user, loading, error, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="tenant">{user?.tenant?.name || 'none'}</span>
      <span data-testid="error">{error || 'none'}</span>
      <button onClick={() => login('hr@example.com', 'password123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks session on mount and sets user when authenticated', async () => {
    vi.spyOn(authApi, 'fetchCurrentSession').mockResolvedValueOnce({
      id: 1,
      email: 'hr@example.com',
      role: 'hr_manager',
      tenant: { id: 5, name: 'Cyberdyne Systems' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initial check
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    // After session resolves
    await screen.findByText('hr@example.com');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('tenant')).toHaveTextContent('Cyberdyne Systems');
  });

  it('logs in user and updates context state', async () => {
    vi.spyOn(authApi, 'fetchCurrentSession').mockResolvedValueOnce(null);
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      id: 2,
      email: 'admin@example.com',
      role: 'organization_admin',
      tenant: { id: 5, name: 'Cyberdyne Systems' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByText('false'); // wait for initial loading to complete
    expect(screen.getByTestId('user')).toHaveTextContent('none');

    await act(async () => {
      screen.getByRole('button', { name: /Login/i }).click();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('admin@example.com');
  });

  it('logs out user and resets context state', async () => {
    vi.spyOn(authApi, 'fetchCurrentSession').mockResolvedValueOnce({
      id: 1,
      email: 'hr@example.com',
      tenant: { id: 5, name: 'Cyberdyne Systems' },
    });
    vi.spyOn(authApi, 'logout').mockResolvedValueOnce(true);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByText('hr@example.com');

    await act(async () => {
      screen.getByRole('button', { name: /Logout/i }).click();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
