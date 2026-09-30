import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DomainContext = createContext(null);

export function DomainProvider({ children }) {
  const { user } = useAuth();

  // Compute available domains for the current user
  const availableDomains = (() => {
    if (!user) return [];
    if (user.domains && user.domains.length > 0) return user.domains;
    // Default domains seeded for Acme Corporation demo accounts
    if (user.role === 'organization_admin') {
      return [
        { id: '1', name: 'Engineering' },
        { id: '2', name: 'Sales & Marketing' }
      ];
    }
    // HR Manager defaults to assigned Engineering domain
    return [
      { id: '1', name: 'Engineering' }
    ];
  })();

  const [selectedDomainId, setSelectedDomainId] = useState(
    user?.role === 'organization_admin' ? 'all' : (availableDomains[0]?.id || '')
  );

  // Synchronize selected domain whenever user context changes
  useEffect(() => {
    if (!user) {
      setSelectedDomainId('');
      return;
    }
    if (user.role === 'organization_admin') {
      setSelectedDomainId('all');
    } else {
      setSelectedDomainId(availableDomains[0]?.id || '');
    }
  }, [user]);

  const activeDomain = availableDomains.find((d) => String(d.id) === String(selectedDomainId));

  return (
    <DomainContext.Provider
      value={{
        availableDomains,
        selectedDomainId,
        setSelectedDomainId,
        activeDomain,
        isAllDomains: selectedDomainId === 'all',
      }}
    >
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain() {
  const context = useContext(DomainContext);
  if (!context) {
    throw new Error('useDomain must be used within a DomainProvider');
  }
  return context;
}
