/**
 * Compensations API Client
 * Interacts with Rails API /api/employees/:employee_id/compensation endpoints using cookie session credentials.
 */

export async function fetchEmployeeCompensation(employeeId) {
  const response = await fetch(`/api/employees/${employeeId}/compensation`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch compensation records');
  }

  return data;
}

export async function createEmployeeCompensation(employeeId, compensationData) {
  const response = await fetch(`/api/employees/${employeeId}/compensation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ compensation: compensationData }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.errors ? data.errors.join(', ') : (data.error || 'Failed to create compensation package');
    const err = new Error(errorMsg);
    err.errors = data.errors;
    throw err;
  }

  return data;
}

export async function updateEmployeeCompensation(employeeId, compensationId, compensationData) {
  const response = await fetch(`/api/employees/${employeeId}/compensation/${compensationId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ compensation: compensationData }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.errors ? data.errors.join(', ') : (data.error || 'Failed to update compensation package');
    const err = new Error(errorMsg);
    err.errors = data.errors;
    throw err;
  }

  return data;
}

