import { useAuth } from '../context/AuthContext';
import DomainSelector from './DomainSelector';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const isOrgAdmin = user.role === 'organization_admin';

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-logo">🌐</span>
        <div className="brand-text">
          <span className="brand-title">Compensation OS</span>
          <span className="brand-tenant">{user.tenant?.name}</span>
        </div>
      </div>

      <div className="navbar-center">
        <DomainSelector />
      </div>

      <div className="navbar-actions">
        <div className="user-profile">
          <span className="user-email">{user.email}</span>
          <span className={`role-badge ${isOrgAdmin ? 'role-admin' : 'role-hr'}`}>
            {isOrgAdmin ? 'Org Admin' : 'HR Manager'}
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="btn-logout"
          title="Sign out of current tenant session"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
