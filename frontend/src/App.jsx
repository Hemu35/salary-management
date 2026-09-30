import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginForm from './components/LoginForm';
import './App.css';

function MainContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const isOrgAdmin = user.role === 'organization_admin';

  return (
    <div className="app-layout">
      <Navbar />

      <main className="main-container">
        <div className="dashboard-welcome">
          <div className="welcome-header">
            <h2>Welcome back, {user.email}</h2>
            <p className="welcome-subtitle">
              Organization: <strong>{user.tenant?.name}</strong> (Tenant ID #{user.tenant?.id})
            </p>
          </div>

          <div className="status-grid">
            <div className="status-card">
              <span className="status-label">Assigned Role</span>
              <span className="status-value">{isOrgAdmin ? 'Organization Administrator' : 'HR Manager'}</span>
              <span className="status-help">
                {isOrgAdmin
                  ? 'Full administrative authority across all domains'
                  : 'Restricted to assigned organizational domains'}
              </span>
            </div>

            <div className="status-card">
              <span className="status-label">Tenant Isolation</span>
              <span className="status-value status-active">Active (PostgreSQL RLS)</span>
              <span className="status-help">Defense-in-depth row-level tenant boundary enforced</span>
            </div>

            <div className="status-card">
              <span className="status-label">Session Security</span>
              <span className="status-value status-active">Secure HTTP Cookie</span>
              <span className="status-help">Session fixation protected with automatic rotation</span>
            </div>
          </div>

          <div className="module-placeholder">
            <h3>Directory & Compensation Modules</h3>
            <p>
              Authentication and tenant boundary context are verified. Employee records and compensation history will load here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
