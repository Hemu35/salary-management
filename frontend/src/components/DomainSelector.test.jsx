import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DomainSelector from './DomainSelector';
import * as AuthContextModule from '../context/AuthContext';
import * as DomainContextModule from '../context/DomainContext';

describe('DomainSelector Component', () => {
  const mockSetSelectedDomainId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when user is null', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({ user: null });
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      availableDomains: [],
      selectedDomainId: '',
      setSelectedDomainId: mockSetSelectedDomainId,
    });

    const { container } = render(<DomainSelector />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "All Domains" option and domain choices for Org Admin', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, role: 'organization_admin' },
    });
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      availableDomains: [
        { id: '1', name: 'Engineering' },
        { id: '2', name: 'Sales & Marketing' },
      ],
      selectedDomainId: 'all',
      setSelectedDomainId: mockSetSelectedDomainId,
    });

    render(<DomainSelector />);

    const select = screen.getByRole('combobox', { name: /Select domain scope/i });
    expect(select).toBeEnabled();
    expect(screen.getByRole('option', { name: /All Domains/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Engineering' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sales & Marketing' })).toBeInTheDocument();
  });

  it('calls setSelectedDomainId when user selects a different domain', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, role: 'organization_admin' },
    });
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      availableDomains: [
        { id: '1', name: 'Engineering' },
        { id: '2', name: 'Sales & Marketing' },
      ],
      selectedDomainId: 'all',
      setSelectedDomainId: mockSetSelectedDomainId,
    });

    render(<DomainSelector />);

    const select = screen.getByRole('combobox', { name: /Select domain scope/i });
    fireEvent.change(select, { target: { value: '1' } });

    expect(mockSetSelectedDomainId).toHaveBeenCalledWith('1');
  });

  it('disables dropdown and shows Restricted badge when HR Manager has single domain', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 2, role: 'hr_manager' },
    });
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      availableDomains: [{ id: '1', name: 'Engineering' }],
      selectedDomainId: '1',
      setSelectedDomainId: mockSetSelectedDomainId,
    });

    render(<DomainSelector />);

    const select = screen.getByRole('combobox', { name: /Select domain scope/i });
    expect(select).toBeDisabled();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /All Domains/i })).not.toBeInTheDocument();
  });
});
