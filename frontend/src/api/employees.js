/**
 * Employees API Client
 * Interacts with Rails API /api/employees endpoints using cookie session credentials.
 */

export async function fetchEmployees(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set('page', params.page);
  if (params.per_page) query.set('per_page', params.per_page);
  if (params.search) query.set('search', params.search);
  if (params.domain_id && params.domain_id !== 'all') query.set('domain_id', params.domain_id);
  if (params.employment_status && params.employment_status !== 'all') query.set('employment_status', params.employment_status);
  if (params.country_code && params.country_code !== 'all') query.set('country_code', params.country_code);

  const url = `/api/employees${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch employees');
  }

  return data;
}

export async function fetchEmployeeById(id) {
  const response = await fetch(`/api/employees/${id}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch employee details');
  }

  return data;
}

export async function createEmployee(employeeData) {
  const response = await fetch('/api/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ employee: employeeData }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.errors ? data.errors.join(', ') : (data.error || 'Failed to create employee');
    const err = new Error(errorMsg);
    err.errors = data.errors;
    throw err;
  }

  return data;
}

export async function updateEmployee(id, employeeData) {
  const response = await fetch(`/api/employees/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ employee: employeeData }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.errors ? data.errors.join(', ') : (data.error || 'Failed to update employee');
    const err = new Error(errorMsg);
    err.errors = data.errors;
    throw err;
  }

  return data;
}
