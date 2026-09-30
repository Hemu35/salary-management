import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Navbar from './Navbar';
import * as AuthContextModule from '../context/AuthContext';
import { DomainProvider } from '../context/DomainContext';

function renderNavbar() {
  return render(
    <DomainProvider>
      <Navbar />
    </DomainProvider>
  );
}

describe('Navbar Component', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when user is null', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      logout: mockLogout,
    });

    const { container } = renderNavbar();
    expect(container.firstChild).toBeNull();
  });

  it('displays organization tenant name, user email, and HR Manager badge', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'hr@example.com',
        role: 'hr_manager',
        tenant: { id: 10, name: 'Wayne Enterprises' },
      },
      logout: mockLogout,
    });

    renderNavbar();

    expect(screen.getByText('Wayne Enterprises')).toBeInTheDocument();
    expect(screen.getByText('hr@example.com')).toBeInTheDocument();
    expect(screen.getByText('HR Manager')).toBeInTheDocument();
  });

  it('displays Org Admin role badge for organization_admin role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 2,
        email: 'admin@example.com',
        role: 'organization_admin',
        tenant: { id: 10, name: 'Wayne Enterprises' },
      },
      logout: mockLogout,
    });

    renderNavbar();

    expect(screen.getByText('Org Admin')).toBeInTheDocument();
  });

  it('renders domain scope selector when user is authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 2,
        email: 'admin@example.com',
        role: 'organization_admin',
        tenant: { id: 10, name: 'Wayne Enterprises' },
      },
      logout: mockLogout,
    });

    renderNavbar();

    expect(screen.getByLabelText(/Select domain scope/i)).toBeInTheDocument();
  });

  it('triggers logout when Sign out button is clicked', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'hr@example.com',
        role: 'hr_manager',
        tenant: { id: 10, name: 'Wayne Enterprises' },
      },
      logout: mockLogout,
    });

    renderNavbar();

    const signoutBtn = screen.getByRole('button', { name: /Sign out/i });
    fireEvent.click(signoutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
