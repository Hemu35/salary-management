import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-badge">Multi-Tenant SaaS</div>
          <h1>Employee Compensation</h1>
          <p className="subtitle">Sign in to access your tenant domain records</p>
        </div>

        {errorMessage && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              placeholder="e.g. hr@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-submit"
            disabled={submitting || !email.trim() || !password}
          >
            {submitting ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>

        <div className="demo-credentials-box">
          <div className="demo-header">Assessment Demo Accounts:</div>
          <div className="demo-buttons">
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleFillDemo('hr@example.com', 'password123')}
            >
              Fill HR Manager (hr@example.com)
            </button>
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleFillDemo('admin@example.com', 'password123')}
            >
              Fill Org Admin (admin@example.com)
            </button>
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleFillDemo('admin@globex.com', 'password123')}
            >
              Fill Benchmark Admin (admin@globex.com - 10k dataset)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
