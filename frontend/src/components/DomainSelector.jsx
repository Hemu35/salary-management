import { useAuth } from '../context/AuthContext';
import { useDomain } from '../context/DomainContext';

export default function DomainSelector() {
  const { user } = useAuth();
  const { availableDomains, selectedDomainId, setSelectedDomainId } = useDomain();

  if (!user) return null;

  const isOrgAdmin = user.role === 'organization_admin';
  const isSingleDomain = !isOrgAdmin && availableDomains.length <= 1;

  return (
    <div className="domain-scope-control">
      <label htmlFor="domain-select" className="domain-scope-label">
        Domain Scope:
      </label>
      <select
        id="domain-select"
        className="domain-select"
        value={selectedDomainId}
        onChange={(e) => setSelectedDomainId(e.target.value)}
        disabled={isSingleDomain}
        aria-label="Select domain scope"
      >
        {isOrgAdmin && <option value="all">All Domains (Global Scope)</option>}
        {availableDomains.map((domain) => (
          <option key={domain.id} value={String(domain.id)}>
            {domain.name}
          </option>
        ))}
      </select>
      {isSingleDomain && (
        <span className="domain-restricted-badge" title="Access is restricted by tenant domain assignment">
          Restricted
        </span>
      )}
    </div>
  );
}
