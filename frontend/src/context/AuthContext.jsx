import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, fetchCurrentSession, logout as apiLogout } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session on initial application load
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const sessionUser = await fetchCurrentSession();
        if (mounted) {
          setUser(sessionUser);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const authenticatedUser = await apiLogin(email, password);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await apiLogout();
      setUser(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
