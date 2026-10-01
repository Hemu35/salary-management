import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DomainProvider, useDomain } from './context/DomainContext';
import Navbar from './components/Navbar';
import LoginForm from './components/LoginForm';
import EmployeeDirectory from './components/EmployeeDirectory';
import ReportsDashboard from './components/ReportsDashboard';
import './App.css';

function MainContent() {
  const { user, loading } = useAuth();
  const { isAllDomains, activeDomain } = useDomain();
  const [activeTab, setActiveTab] = useState('directory');

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
              <span className="status-label">Active Domain Scope</span>
              <span className="status-value domain-scope-display">
                {isAllDomains ? 'All Domains (Global)' : activeDomain?.name || 'Scoped Domain'}
              </span>
              <span className="status-help">
                {isOrgAdmin
                  ? 'Can switch between all departments or filter to a single domain'
                  : 'Enforced scope for directory and compensation visibility'}
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

          <div className="view-navigation-tabs" role="tablist" aria-label="Main Navigation">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'directory'}
              className={`view-nav-tab ${activeTab === 'directory' ? 'active' : ''}`}
              onClick={() => setActiveTab('directory')}
            >
              👥 Employee Directory
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'insights'}
              className={`view-nav-tab ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              📊 Insights & Analytics
            </button>
          </div>

          {activeTab === 'directory' ? <EmployeeDirectory /> : <ReportsDashboard />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DomainProvider>
        <MainContent />
      </DomainProvider>
    </AuthProvider>
  );
}
