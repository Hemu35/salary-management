import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DomainProvider, useDomain } from './DomainContext';
import * as AuthContextModule from './AuthContext';

function TestConsumer() {
  const { availableDomains, selectedDomainId, setSelectedDomainId, activeDomain, isAllDomains } = useDomain();

  return (
    <div>
      <span data-testid="selected-domain">{selectedDomainId}</span>
      <span data-testid="is-all">{isAllDomains ? 'true' : 'false'}</span>
      <span data-testid="active-domain-name">{activeDomain?.name || 'none'}</span>
      <ul data-testid="domain-list">
        {availableDomains.map((d) => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
      <button onClick={() => setSelectedDomainId('2')}>Select Domain 2</button>
      <button onClick={() => setSelectedDomainId('all')}>Select All</button>
    </div>
  );
}

describe('DomainContext', () => {
  it('defaults Org Admin to "all" with all tenant domains available', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'admin@example.com',
        role: 'organization_admin',
        tenant: { id: 1, name: 'Acme Corp' },
      },
    });

    render(
      <DomainProvider>
        <TestConsumer />
      </DomainProvider>
    );

    expect(screen.getByTestId('selected-domain')).toHaveTextContent('all');
    expect(screen.getByTestId('is-all')).toHaveTextContent('true');
    expect(screen.getByTestId('domain-list')).toHaveTextContent('Engineering');
    expect(screen.getByTestId('domain-list')).toHaveTextContent('Sales & Marketing');
  });

  it('defaults HR Manager to assigned domain and restricts scope', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 2,
        email: 'hr@example.com',
        role: 'hr_manager',
        tenant: { id: 1, name: 'Acme Corp' },
        domains: [{ id: '10', name: 'Operations' }],
      },
    });

    render(
      <DomainProvider>
        <TestConsumer />
      </DomainProvider>
    );

    expect(screen.getByTestId('selected-domain')).toHaveTextContent('10');
    expect(screen.getByTestId('is-all')).toHaveTextContent('false');
    expect(screen.getByTestId('active-domain-name')).toHaveTextContent('Operations');
    expect(screen.getByTestId('domain-list')).toHaveTextContent('Operations');
  });

  it('updates selectedDomainId and activeDomain when switched', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'admin@example.com',
        role: 'organization_admin',
        tenant: { id: 1, name: 'Acme Corp' },
        domains: [
          { id: '1', name: 'Engineering' },
          { id: '2', name: 'Sales & Marketing' },
        ],
      },
    });

    render(
      <DomainProvider>
        <TestConsumer />
      </DomainProvider>
    );

    expect(screen.getByTestId('selected-domain')).toHaveTextContent('all');

    act(() => {
      screen.getByText('Select Domain 2').click();
    });

    expect(screen.getByTestId('selected-domain')).toHaveTextContent('2');
    expect(screen.getByTestId('is-all')).toHaveTextContent('false');
    expect(screen.getByTestId('active-domain-name')).toHaveTextContent('Sales & Marketing');
  });

  it('throws error when useDomain is used outside DomainProvider', () => {
    // Suppress console.error during throw test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useDomain must be used within a DomainProvider'
    );

    consoleSpy.mockRestore();
  });
});
