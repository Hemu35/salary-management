/**
 * Reports & Insights API Client
 * Interacts with Rails API /api/reports endpoints using cookie session credentials.
 */

export async function fetchWorkforceReport(params = {}) {
  const query = new URLSearchParams();
  if (params.domain_id && params.domain_id !== 'all') {
    query.set('domain_id', params.domain_id);
  }

  const url = `/api/reports/workforce${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch workforce report');
  }

  return data;
}

export async function fetchCompensationReport(params = {}) {
  const query = new URLSearchParams();
  if (params.domain_id && params.domain_id !== 'all') {
    query.set('domain_id', params.domain_id);
  }

  const url = `/api/reports/compensation${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch compensation report');
  }

  return data;
}
