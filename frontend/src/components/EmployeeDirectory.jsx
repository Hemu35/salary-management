import { useState, useEffect, useCallback } from 'react';
import { useDomain } from '../context/DomainContext';
import { fetchEmployees } from '../api/employees';
import { fetchImports } from '../api/imports';
import { createExport, fetchExport, downloadExportFile } from '../api/exports';
import EmployeeTable from './EmployeeTable';
import CreateEmployeeModal from './CreateEmployeeModal';
import EditEmployeeModal from './EditEmployeeModal';
import CompensationModal from './CompensationModal';
import ImportModal from './ImportModal';

export default function EmployeeDirectory() {
  const { selectedDomainId, activeDomain, isAllDomains } = useDomain();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 25,
  });

  // Modal & Export state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [runningImportsCount, setRunningImportsCount] = useState(0);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingCompensationEmployee, setViewingCompensationEmployee] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Async Export state
  const [isExporting, setIsExporting] = useState(false);
  const [activeExport, setActiveExport] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchEmployees({
          page,
          per_page: 25,
          search: searchQuery,
          domain_id: selectedDomainId,
          employment_status: statusFilter,
        });

        if (!ignore) {
          setEmployees(data.employees || []);
          if (data.meta) {
            setMeta(data.meta);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [page, searchQuery, selectedDomainId, statusFilter, reloadTrigger]);

  // Reset page when domain scope changes
  useEffect(() => {
    setPage(1);
  }, [selectedDomainId]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleEmployeeCreated = () => {
    setReloadTrigger((prev) => prev + 1);
  };

  const handleEmployeeUpdated = () => {
    setReloadTrigger((prev) => prev + 1);
  };

  // Periodically check for active background imports
  useEffect(() => {
    let ignore = false;
    let timer = null;

    async function checkBackgroundImports() {
      try {
        const jobs = await fetchImports();
        if (!ignore) {
          const activeCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing' || j.status === 'cancelling').length;
          setRunningImportsCount(prevCount => {
            if (prevCount > 0 && activeCount === 0) {
              setReloadTrigger(prev => prev + 1);
            }
            return activeCount;
          });
          if (activeCount > 0) {
            timer = setTimeout(checkBackgroundImports, 2000);
          }
        }
      } catch (e) {
        // silent
      }
    }

    checkBackgroundImports();

    return () => {
      ignore = true;
      if (timer) clearTimeout(timer);
    };
  }, [reloadTrigger, isImportModalOpen]);

  // Poll background export job
  useEffect(() => {
    if (!activeExport || activeExport.status === 'completed' || activeExport.status === 'failed') {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const updated = await fetchExport(activeExport.id);
        setActiveExport(updated);
        if (updated.status === 'completed') {
          clearInterval(timer);
          try {
            await downloadExportFile(updated.id, updated.filename);
          } catch (dlErr) {
            console.error('Auto-download failed:', dlErr);
          }
        } else if (updated.status === 'failed') {
          clearInterval(timer);
        }
      } catch (err) {
        clearInterval(timer);
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [activeExport?.id, activeExport?.status]);

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const job = await createExport({
        domain_id: selectedDomainId,
        employment_status: statusFilter,
        search: searchQuery,
      });
      setActiveExport(job);
    } catch (err) {
      setExportError(err.message || 'Failed to start export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleSelectEmployee = (id) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageIds = (employees || []).map((e) => e.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedEmployeeIds.includes(id));
    if (allSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedEmployeeIds([]);
  };

  const handleExportSelected = async () => {
    if (selectedEmployeeIds.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const job = await createExport({
        employee_ids: selectedEmployeeIds,
      });
      setActiveExport(job);
    } catch (err) {
      setExportError(err.message || 'Failed to start export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleManualDownload = async () => {
    if (!activeExport?.id) return;
    try {
      await downloadExportFile(activeExport.id, activeExport.filename);
    } catch (err) {
      setExportError(err.message || 'Download failed');
    }
  };

  return (
    <div className="employee-directory">
      <div className="directory-header">
        <div className="directory-titles">
          <h3>Employee Directory</h3>
          <span className="directory-scope-tag">
            Scope: {isAllDomains ? 'All Domains' : (activeDomain?.name || 'Departmental')}
          </span>
        </div>

        <div className="directory-actions">
          <button
            type="button"
            className="btn-secondary btn-export-csv"
            onClick={handleStartExport}
            disabled={isExporting}
            title="Export filtered employee directory and compensation data to CSV"
          >
            {isExporting ? (
              <>
                <span className="status-spinner" /> 📤 Exporting...
              </>
            ) : (
              '📤 Export CSV'
            )}
          </button>
          <button
            type="button"
            className="btn-secondary btn-import-csv"
            onClick={() => setIsImportModalOpen(true)}
          >
            {runningImportsCount > 0 ? (
              <>
                <span className="status-spinner" /> 📥 Imports ({runningImportsCount} running...)
              </>
            ) : (
              '📥 Import CSV'
            )}
          </button>
          <button
            type="button"
            className="btn-primary btn-add-employee"
            onClick={() => setIsModalOpen(true)}
          >
            + Add Employee
          </button>
        </div>
      </div>

      {exportError && (
        <div className="error-banner" role="alert">
          ⚠️ {exportError}
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          ⚠️ {error}
        </div>
      )}

      <div className="directory-toolbar">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            id="employee-search"
            type="text"
            placeholder="Search by name, email, or employee number..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search employees"
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => handleSearchChange('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="filter-status" className="filter-label">
            Status:
          </label>
          <select
            id="filter-status"
            className="filter-select"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="Filter by employment status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
      </div>

      {selectedEmployeeIds.length > 0 && (
        <div className="selection-action-bar" role="region" aria-label="Selection actions">
          <div className="selection-count">
            <span className="selection-badge">✓</span>
            <span>
              <strong>{selectedEmployeeIds.length}</strong> employee
              {selectedEmployeeIds.length === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="selection-buttons">
            <button
              type="button"
              className="btn-export-selected"
              onClick={handleExportSelected}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className="status-spinner" /> 📤 Exporting...
                </>
              ) : (
                `📤 Export Selected (${selectedEmployeeIds.length})`
              )}
            </button>
            <button
              type="button"
              className="btn-clear-selection"
              onClick={handleClearSelection}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <EmployeeTable
        employees={employees}
        loading={loading}
        selectedEmployeeIds={selectedEmployeeIds}
        onToggleSelectEmployee={handleToggleSelectEmployee}
        onToggleSelectAll={handleToggleSelectAll}
        onEditEmployee={setEditingEmployee}
        onViewCompensation={setViewingCompensationEmployee}
      />

      {meta.total_count > 0 && (
        <div className="pagination-bar">
          <span className="pagination-info">
            Showing <strong>{employees.length}</strong> of <strong>{meta.total_count}</strong> employee
            {meta.total_count === 1 ? '' : 's'}
          </span>

          <div className="pagination-actions">
            <button
              type="button"
              className="btn-page"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              aria-label="Previous page"
            >
              ← Previous
            </button>

            <span className="page-indicator">
              Page {meta.current_page} of {meta.total_pages || 1}
            </span>

            <button
              type="button"
              className="btn-page"
              disabled={page >= meta.total_pages || loading}
              onClick={() => setPage((prev) => prev + 1)}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <CreateEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEmployeeCreated={handleEmployeeCreated}
      />

      <EditEmployeeModal
        isOpen={!!editingEmployee}
        employee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        onEmployeeUpdated={handleEmployeeUpdated}
      />

      <CompensationModal
        isOpen={!!viewingCompensationEmployee}
        employee={viewingCompensationEmployee}
        onClose={() => setViewingCompensationEmployee(null)}
        onCompensationUpdated={() => setReloadTrigger((prev) => prev + 1)}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setReloadTrigger((prev) => prev + 1);
        }}
        onImportCompleted={() => setReloadTrigger((prev) => prev + 1)}
      />

      {/* Non-blocking Async Export Toast */}
      {activeExport && (
        <div className="export-notification-toast" role="status" aria-live="polite">
          <div className="export-toast-content">
            <div className="export-toast-header">
              <span className="export-icon">{activeExport.status === 'completed' ? '✅' : '📤'}</span>
              <strong>
                {activeExport.status === 'completed'
                  ? 'Export Complete!'
                  : `Generating Export (${activeExport.progress_percentage || 0}%)`}
              </strong>
              <button
                type="button"
                className="btn-close-toast"
                onClick={() => setActiveExport(null)}
                aria-label="Dismiss export notification"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
            <p className="export-toast-sub">
              {activeExport.filename} ({activeExport.total_rows || 0} rows)
            </p>
            {(activeExport.status === 'queued' || activeExport.status === 'processing') && (
              <div className="export-progress-track">
                <div
                  className="export-progress-bar"
                  style={{ width: `${Math.max(activeExport.progress_percentage || 0, 10)}%` }}
                />
              </div>
            )}
            {activeExport.status === 'completed' && activeExport.can_download && (
              <button
                type="button"
                className="btn-download-export"
                onClick={handleManualDownload}
              >
                ⬇️ Download CSV File
              </button>
            )}
            {activeExport.status === 'failed' && (
              <div className="text-danger" style={{ fontSize: '0.8rem' }}>
                Failed: {activeExport.error_message || 'Internal error'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
