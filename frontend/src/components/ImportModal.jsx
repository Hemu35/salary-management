import { useState, useEffect, useRef } from 'react';
import { createImport, fetchImports, cancelImport, rollbackImport } from '../api/imports';
import ConfirmModal from './ConfirmModal';

const CSV_TEMPLATE_HEADERS = [
  'employee_number',
  'first_name',
  'last_name',
  'email',
  'domain_name',
  'country_code',
  'job_title',
  'hire_date',
  'currency',
  'base_salary',
  'bonus'
];

const CSV_TEMPLATE_SAMPLE = [
  CSV_TEMPLATE_HEADERS.join(','),
  'EMP-9001,Alice,Smith,alice.smith@example.com,Engineering,US,Senior Engineer,2025-01-15,USD,135000,15000',
  'EMP-9002,Bob,Jones,bob.jones@example.com,Sales,GB,Account Executive,2025-02-01,GBP,75000,10000'
].join('\n');

export default function ImportModal({ isOpen, onClose, onImportCompleted }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewTab, setViewTab] = useState('upload'); // 'upload' | 'jobs'
  const [expandedJobErrors, setExpandedJobErrors] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const userInteractedTabRef = useRef(false);

  const loadJobs = async () => {
    try {
      const data = await fetchImports();
      setJobs(data || []);
      return data || [];
    } catch (err) {
      console.error('Failed to load imports:', err);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (isOpen) {
      setSelectedFiles([]);
      setError(null);
      setDragActive(false);
      setExpandedJobErrors(null);
      setViewTab('upload');
      loadJobs();
    } else {
      setViewTab('upload');
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Polling for active jobs
  useEffect(() => {
    if (!isOpen) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const hasActiveJobs = jobs.some(j => j.status === 'queued' || j.status === 'processing');

    if (hasActiveJobs && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(async () => {
        const updatedJobs = await loadJobs();
        const stillActive = updatedJobs.some(j => j.status === 'queued' || j.status === 'processing');
        if (!stillActive) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (onImportCompleted) {
            onImportCompleted();
          }
        }
      }, 1200);
    } else if (!hasActiveJobs && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, jobs]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_SAMPLE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employees_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFiles = (incomingFileList) => {
    const validCsvs = [];
    const invalid = [];

    Array.from(incomingFileList).forEach(file => {
      if (file.name.toLowerCase().endsWith('.csv')) {
        validCsvs.push(file);
      } else {
        invalid.push(file.name);
      }
    });

    if (invalid.length > 0) {
      setError(`Ignored non-CSV file(s): ${invalid.join(', ')}. Please upload .csv files only.`);
    } else {
      setError(null);
    }

    if (validCsvs.length > 0) {
      setSelectedFiles(prev => {
        // Prevent duplicate file objects by name & size
        const existingKeys = new Set(prev.map(f => `${f.name}_${f.size}`));
        const filteredNew = validCsvs.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
        return [...prev, ...filteredNew];
      });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select at least one CSV file to upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await createImport(selectedFiles);
      setSelectedFiles([]);
      userInteractedTabRef.current = true;
      setViewTab('jobs');
      await loadJobs();
      setUploading(false);
      if (onImportCompleted) onImportCompleted();
    } catch (err) {
      setUploading(false);
      setError(err.message || 'Failed to upload CSV files.');
    }
  };

  const handleCancelJob = (job) => {
    setConfirmAction({
      type: 'cancel',
      jobId: job.id,
      filename: job.filename,
    });
  };

  const handleRollbackJob = (job) => {
    setConfirmAction({
      type: 'rollback',
      jobId: job.id,
      filename: job.filename,
    });
  };

  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;

    const { type, jobId } = confirmAction;
    setActionInProgress(jobId);
    try {
      if (type === 'cancel') {
        await cancelImport(jobId);
      } else if (type === 'rollback') {
        await rollbackImport(jobId);
      }
      await loadJobs();
      if (onImportCompleted) onImportCompleted();
      setConfirmAction(null);
    } catch (err) {
      setError(err.message || `Failed to ${type} import job`);
      setConfirmAction(null);
    } finally {
      setActionInProgress(null);
    }
  };

  const activeJobsCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing' || j.status === 'cancelling').length;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <div className="modal-card modal-card-broad">
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h3 id="import-modal-title" className="modal-title">Bulk CSV Import Center</h3>
              {activeJobsCount > 0 && (
                <span className="badge-active-jobs">
                  <span className="status-spinner" /> {activeJobsCount} background job{activeJobsCount > 1 ? 's' : ''} running
                </span>
              )}
            </div>
            <p className="modal-subtitle">
              Parallel background imports for employee demographics and compensation structures.
            </p>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close modal"
            title="Close modal (imports continue running in background)"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="import-tab-nav">
          <button
            type="button"
            className={`import-tab-btn ${viewTab === 'upload' ? 'active' : ''}`}
            onClick={() => {
              userInteractedTabRef.current = true;
              setViewTab('upload');
            }}
          >
            📤 Upload Files {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
          <button
            type="button"
            className={`import-tab-btn ${viewTab === 'jobs' ? 'active' : ''}`}
            onClick={() => {
              userInteractedTabRef.current = true;
              setViewTab('jobs');
            }}
          >
            📋 Import Queue & History {jobs.length > 0 && `(${jobs.length})`}
            {activeJobsCount > 0 && <span className="tab-pill">{activeJobsCount}</span>}
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
              ⚠️ {error}
            </div>
          )}

          {viewTab === 'upload' ? (
            <form onSubmit={handleSubmit} className="import-form">
              <div className="import-template-banner">
                <div className="import-template-info">
                  <strong>Need the CSV formatting template?</strong>
                  <p>Includes required columns for employee details and optional compensation components.</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-download-template"
                  onClick={handleDownloadTemplate}
                >
                  📥 Download Sample Template
                </button>
              </div>

              <div
                className={`import-dropzone ${dragActive ? 'drag-active' : ''} ${selectedFiles.length > 0 ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
                aria-label="Upload CSV files"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  data-testid="import-file-input"
                />
                <div className="dropzone-icon">📁</div>
                <div className="dropzone-prompt">
                  <span className="prompt-title">Drag & drop your .csv file(s) here</span>
                  <span className="prompt-subtitle">Supports single or multi-file uploads (click to browse)</span>
                </div>
              </div>

              {/* Staged files list */}
              {selectedFiles.length > 0 && (
                <div className="staged-files-container">
                  <div className="staged-files-header">
                    <strong>Files ready to queue ({selectedFiles.length}):</strong>
                    <button
                      type="button"
                      className="btn-text-danger"
                      onClick={() => setSelectedFiles([])}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="staged-files-grid">
                    {selectedFiles.map((f, idx) => (
                      <div key={idx} className="staged-file-pill">
                        <span className="file-name">{f.name}</span>
                        <span className="file-size">({(f.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          aria-label={`Remove ${f.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="import-requirements-box">
                <h5>Import Job Specifications:</h5>
                <ul>
                  <li><strong>Multiple parallel files:</strong> Each uploaded file is processed as an independent background worker job.</li>
                  <li><strong>Run in background:</strong> You can close this modal at any time; imports continue processing safely in Sidekiq.</li>
                  <li><strong>Domain security:</strong> Any rows for departments outside your assigned access permissions are safely rejected.</li>
                </ul>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={selectedFiles.length === 0 || uploading}
                >
                  {uploading ? 'Queueing Jobs...' : `Start Import${selectedFiles.length > 1 ? ` (${selectedFiles.length} files)` : ''}`}
                </button>
              </div>
            </form>
          ) : (
            <div className="import-jobs-list-view">
              <div className="jobs-list-toolbar">
                <span className="jobs-list-count">
                  {jobs.length} total import job{jobs.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-upload-more"
                  onClick={() => setViewTab('upload')}
                >
                  + Upload More Files
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="empty-jobs-card">
                  <span className="empty-icon">📭</span>
                  <h4>No import jobs yet</h4>
                  <p>Upload a CSV file to begin importing employee records.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setViewTab('upload')}
                    style={{ marginTop: '0.75rem' }}
                  >
                    Upload CSV
                  </button>
                </div>
              ) : (
                <div className="jobs-cards-container">
                  {jobs.map((job) => {
                    const isProcessing = job.status === 'queued' || job.status === 'processing';
                    const hasErrors = job.error_summary && (
                      Array.isArray(job.error_summary) ? job.error_summary.length > 0 : !!job.error_summary
                    );

                    return (
                      <div key={job.id} className={`import-job-card card-status-${job.status}`}>
                        <div className="job-card-header">
                          <div className="job-file-info">
                            <span className="job-filename" title={job.filename}>
                              📄 {job.filename}
                            </span>
                            <span className="job-timestamp">
                              Job #{job.id} • {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div className="job-card-header-actions">
                            {(job.status === 'queued' || job.status === 'processing') && (
                              <button
                                type="button"
                                className="btn-job-action btn-cancel-job"
                                onClick={() => handleCancelJob(job)}
                                disabled={actionInProgress === job.id}
                                title="Cancel import and rollback processed rows"
                              >
                                {actionInProgress === job.id ? 'Cancelling...' : '🛑 Cancel'}
                              </button>
                            )}

                            {job.can_rollback && (
                              <button
                                type="button"
                                className="btn-job-action btn-rollback-job"
                                onClick={() => handleRollbackJob(job)}
                                disabled={actionInProgress === job.id}
                                title="Rollback this import and delete all created records"
                              >
                                {actionInProgress === job.id ? 'Rolling back...' : '↩ Rollback'}
                              </button>
                            )}

                            <span className={`status-badge status-badge-${job.status}`}>
                              {(job.status === 'processing' || job.status === 'cancelling') && <span className="status-spinner" />}
                              {job.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="job-card-progress">
                          <div className="import-progress-bar-container">
                            <div
                              className={`import-progress-bar-fill progress-${job.status}`}
                              style={{ width: `${job.progress_percentage || (job.status === 'completed' ? 100 : 0)}%` }}
                              role="progressbar"
                              aria-valuenow={job.progress_percentage || 0}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                          <div className="job-progress-row">
                            <span>{job.progress_percentage || (job.status === 'completed' ? 100 : 0)}% Complete</span>
                            <span>{job.processed_rows || 0} of {job.total_rows || 0} rows</span>
                          </div>
                        </div>

                        {/* Metrics Pills */}
                        <div className="job-card-stats">
                          <div className="stat-pill">
                            <span className="label">Total:</span>
                            <span className="val">{job.total_rows || 0}</span>
                          </div>
                          <div className="stat-pill stat-success">
                            <span className="label">Succeeded:</span>
                            <span className="val">{job.successful_rows || 0}</span>
                          </div>
                          <div className="stat-pill stat-danger">
                            <span className="label">Failed:</span>
                            <span className="val">{job.failed_rows || 0}</span>
                          </div>

                          {hasErrors && (
                            <button
                              type="button"
                              className="btn-toggle-errors"
                              onClick={() => setExpandedJobErrors(expandedJobErrors === job.id ? null : job.id)}
                            >
                              {expandedJobErrors === job.id ? 'Hide Issues ▴' : 'View Issues ▾'}
                            </button>
                          )}
                        </div>

                        {/* Expanded Error Table for this Job */}
                        {expandedJobErrors === job.id && job.error_summary && (
                          <div className="import-errors-section" style={{ marginTop: '0.75rem' }}>
                            <h4 className="import-errors-title">
                              ⚠️ Error Details for Job #{job.id}
                            </h4>
                            <div className="import-errors-scroll">
                              {Array.isArray(job.error_summary) ? (
                                <table className="import-errors-table">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '60px' }}>Row</th>
                                      <th style={{ width: '130px' }}>Employee #</th>
                                      <th>Error Details</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {job.error_summary.map((err, idx) => (
                                      <tr key={idx}>
                                        <td><strong>{err.row ?? '-'}</strong></td>
                                        <td><code>{err.employee_number || 'N/A'}</code></td>
                                        <td className="text-danger">
                                          {Array.isArray(err.errors) ? err.errors.join('; ') : (err.error || JSON.stringify(err))}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="error-message-text">
                                  {typeof job.error_summary === 'object' ? JSON.stringify(job.error_summary) : job.error_summary}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onClose}
                >
                  ✕ Close & Run in Background
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={() => setViewTab('upload')}
                >
                  + Upload Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-app Confirmation Modal for Cancel & Rollback Actions */}
      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'cancel' ? 'Cancel Running Import?' : 'Confirm Import Rollback'}
        message={
          confirmAction?.type === 'cancel' ? (
            <span>
              Are you sure you want to cancel the import of <strong>{confirmAction?.filename}</strong>? Processing will stop immediately and any rows processed so far will be rolled back.
            </span>
          ) : (
            <span>
              Are you sure you want to rollback import of <strong>{confirmAction?.filename}</strong>? All employees and compensation structures created by this batch will be reverted and removed from the directory.
            </span>
          )
        }
        confirmText={confirmAction?.type === 'cancel' ? 'Yes, Cancel Job' : 'Yes, Rollback Import'}
        cancelText={confirmAction?.type === 'cancel' ? 'Continue Import' : 'Keep Data'}
        variant={confirmAction?.type === 'cancel' ? 'danger' : 'warning'}
        isLoading={!!actionInProgress}
        onConfirm={handleExecuteConfirm}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}
