/**
 * Authentication API Client
 * Communicates with Rails API /api/session endpoints with cookie credentials.
 */

export async function login(email, password) {
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Authentication failed');
  }

  return data;
}

export async function fetchCurrentSession() {
  const response = await fetch('/api/session', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (response.status === 401) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch session');
  }

  return data;
}

export async function logout() {
  const response = await fetch('/api/session', {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Logout failed');
  }

  return true;
}
