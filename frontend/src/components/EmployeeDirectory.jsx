import { useState, useEffect, useCallback } from 'react';
import { useDomain } from '../context/DomainContext';
import { fetchEmployees } from '../api/employees';
import EmployeeTable from './EmployeeTable';
import CreateEmployeeModal from './CreateEmployeeModal';
import EditEmployeeModal from './EditEmployeeModal';

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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

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

  return (
    <div className="employee-directory">
      <div className="directory-header">
        <div className="directory-titles">
          <h3>Employee Directory</h3>
          <span className="directory-scope-tag">
            Scope: {isAllDomains ? 'All Domains' : (activeDomain?.name || 'Departmental')}
          </span>
        </div>

        <button
          type="button"
          className="btn-primary btn-add-employee"
          onClick={() => setIsModalOpen(true)}
        >
          + Add Employee
        </button>
      </div>

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

      <EmployeeTable
        employees={employees}
        loading={loading}
        onEditEmployee={setEditingEmployee}
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
    </div>
  );
}
