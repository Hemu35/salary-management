/**
 * Exports API Client
 * Interacts with Rails API /api/exports endpoints for asynchronous CSV export.
 */

export async function fetchExports() {
  const response = await fetch('/api/exports', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch export jobs');
  }

  return data.export_jobs || [];
}

export async function createExport(filters = {}) {
  const response = await fetch('/api/exports', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filters),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to initiate export');
  }

  return data;
}

export async function fetchExport(id) {
  if (!id) {
    throw new Error('Export job ID is required');
  }

  const response = await fetch(`/api/exports/${id}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch export job status');
  }

  return data;
}

export async function downloadExportFile(id, filename = 'employees_export.csv') {
  if (!id) {
    throw new Error('Export job ID is required for download');
  }

  const response = await fetch(`/api/exports/${id}/download`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to download export file');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
