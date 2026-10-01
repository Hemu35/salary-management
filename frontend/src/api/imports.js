/**
 * Imports API Client
 * Interacts with Rails API /api/imports endpoints for asynchronous CSV import.
 */

export async function fetchImports() {
  const response = await fetch('/api/imports', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch imports');
  }

  return data.import_jobs || [];
}

export async function createImport(filesOrFile) {
  const formData = new FormData();

  if (Array.isArray(filesOrFile) || (typeof FileList !== 'undefined' && filesOrFile instanceof FileList)) {
    if (filesOrFile.length === 0) {
      throw new Error('Please select at least one CSV file.');
    }
    if (filesOrFile.length === 1) {
      formData.append('file', filesOrFile[0]);
    } else {
      for (let i = 0; i < filesOrFile.length; i++) {
        formData.append('files[]', filesOrFile[i]);
      }
    }
  } else if (typeof File !== 'undefined' && filesOrFile instanceof File) {
    formData.append('file', filesOrFile);
  } else {
    throw new Error('Please select a valid CSV file to upload.');
  }

  const response = await fetch('/api/imports', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit import file');
  }

  return data;
}

export async function fetchImport(id) {
  if (!id) {
    throw new Error('Import job ID is required');
  }

  const response = await fetch(`/api/imports/${id}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch import job status');
  }

  return data;
}

export async function cancelImport(id) {
  if (!id) {
    throw new Error('Import job ID is required');
  }

  const response = await fetch(`/api/imports/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to cancel import job');
  }

  return data;
}

export async function rollbackImport(id) {
  if (!id) {
    throw new Error('Import job ID is required');
  }

  const response = await fetch(`/api/imports/${id}/rollback`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to rollback import job');
  }

  return data;
}
