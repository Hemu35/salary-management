import { useRef, useEffect } from 'react';

export default function EmployeeTable({
  employees,
  loading,
  selectedEmployeeIds = [],
  onToggleSelectEmployee,
  onToggleSelectAll,
  onEditEmployee,
  onViewCompensation,
}) {
  const selectAllRef = useRef(null);

  const pageEmployeeIds = (employees || []).map((e) => e.id);
  const allOnPageSelected =
    pageEmployeeIds.length > 0 &&
    pageEmployeeIds.every((id) => selectedEmployeeIds.includes(id));
  const someOnPageSelected =
    pageEmployeeIds.some((id) => selectedEmployeeIds.includes(id)) && !allOnPageSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected;
    }
  }, [someOnPageSelected]);

  if (loading) {
    return (
      <div className="table-loading" aria-live="polite">
        <div className="spinner"></div>
        <p>Loading employee directory...</p>
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <div className="empty-table-state">
        <span className="empty-icon">👥</span>
        <h4>No employees found</h4>
        <p>Try adjusting your search criteria, domain scope, or filters.</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="status-pill status-pill-active">Active</span>;
      case 'on_leave':
        return <span className="status-pill status-pill-leave">On Leave</span>;
      case 'terminated':
        return <span className="status-pill status-pill-terminated">Terminated</span>;
      default:
        return <span className="status-pill">{status}</span>;
    }
  };

  const formatCountry = (code) => {
    const flags = { US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳', CA: '🇨🇦', DE: '🇩🇪' };
    return `${flags[code] || '🌐'} ${code}`;
  };

  return (
    <div className="table-responsive">
      <table className="employee-table">
        <thead>
          <tr>
            <th className="select-col">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="select-checkbox"
                checked={allOnPageSelected}
                onChange={onToggleSelectAll || (() => {})}
                aria-label="Select all employees on current page"
                title="Select all on current page"
              />
            </th>
            <th>Employee #</th>
            <th>Name</th>
            <th>Email</th>
            <th>Domain</th>
            <th>Job Title</th>
            <th>Country</th>
            <th>Status</th>
            <th>Hire Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const isSelected = selectedEmployeeIds.includes(emp.id);
            return (
              <tr
                key={emp.id}
                className={`employee-row ${isSelected ? 'row-selected' : ''}`}
                data-testid={`employee-row-${emp.id}`}
              >
                <td className="select-col">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelectEmployee && onToggleSelectEmployee(emp.id)}
                    aria-label={`Select employee ${emp.first_name} ${emp.last_name}`}
                  />
                </td>
                <td className="emp-number-cell font-mono">{emp.employee_number}</td>
                <td className="emp-name-cell font-semibold">
                  {emp.first_name} {emp.last_name}
                </td>
                <td className="emp-email-cell">{emp.email}</td>
                <td>
                  <span className="domain-badge">{emp.domain?.name}</span>
                </td>
                <td>{emp.job_title}</td>
                <td className="emp-country-cell">{formatCountry(emp.country_code)}</td>
                <td>{getStatusBadge(emp.employment_status)}</td>
                <td className="emp-date-cell">{emp.hire_date}</td>
                <td className="emp-actions-cell">
                  <button
                    type="button"
                    className="btn-action-comp"
                    onClick={() => onViewCompensation && onViewCompensation(emp)}
                    aria-label={`View compensation for ${emp.first_name} ${emp.last_name}`}
                  >
                    💰 Compensation
                  </button>
                  <button
                    type="button"
                    className="btn-action-edit"
                    onClick={() => onEditEmployee && onEditEmployee(emp)}
                    aria-label={`Edit ${emp.first_name} ${emp.last_name}`}
                  >
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
