import { useState, useEffect } from 'react';
import { useDomain } from '../context/DomainContext';
import { updateEmployee } from '../api/employees';

export default function EditEmployeeModal({ isOpen, employee, onClose, onEmployeeUpdated }) {
  const { availableDomains } = useDomain();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    domain_id: '',
    country_code: 'US',
    job_title: '',
    employment_status: 'active',
    hire_date: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Populate formData whenever selected employee or open status changes
  useEffect(() => {
    if (isOpen && employee) {
      setFormData({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        domain_id: employee.domain?.id || '',
        country_code: employee.country_code || 'US',
        job_title: employee.job_title || '',
        employment_status: employee.employment_status || 'active',
        hire_date: employee.hire_date || '',
      });
      setError(null);
    }
  }, [isOpen, employee]);

  if (!isOpen || !employee) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updated = await updateEmployee(employee.id, formData);
      if (onEmployeeUpdated) {
        onEmployeeUpdated(updated);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-edit-title">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="modal-edit-title">Edit Employee</h3>
            <span className="modal-subtitle">
              {employee.first_name} {employee.last_name} ({employee.employee_number})
            </span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-emp-number">Employee Number</label>
              <input
                id="edit-emp-number"
                type="text"
                disabled
                value={employee.employee_number}
                className="input-disabled font-mono"
                title="Employee numbers are immutable"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-domain">Domain / Department</label>
              <select
                id="edit-domain"
                name="domain_id"
                required
                value={formData.domain_id}
                onChange={handleChange}
              >
                {availableDomains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-first-name">First Name</label>
              <input
                id="edit-first-name"
                name="first_name"
                type="text"
                required
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-last-name">Last Name</label>
              <input
                id="edit-last-name"
                name="last_name"
                type="text"
                required
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-email">Work Email</label>
            <input
              id="edit-email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-job-title">Job Title</label>
              <input
                id="edit-job-title"
                name="job_title"
                type="text"
                required
                value={formData.job_title}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-country">Country (ISO-2)</label>
              <select
                id="edit-country"
                name="country_code"
                required
                value={formData.country_code}
                onChange={handleChange}
              >
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="IN">India (IN)</option>
                <option value="CA">Canada (CA)</option>
                <option value="DE">Germany (DE)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-status">Employment Status</label>
              <select
                id="edit-status"
                name="employment_status"
                value={formData.employment_status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-hire-date">Hire Date</label>
              <input
                id="edit-hire-date"
                name="hire_date"
                type="date"
                required
                value={formData.hire_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
