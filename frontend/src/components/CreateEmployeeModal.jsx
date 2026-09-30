import { useState, useEffect } from 'react';
import { useDomain } from '../context/DomainContext';
import { createEmployee } from '../api/employees';

export default function CreateEmployeeModal({ isOpen, onClose, onEmployeeCreated }) {
  const { availableDomains, selectedDomainId } = useDomain();

  const defaultDomainId = selectedDomainId !== 'all' && selectedDomainId
    ? selectedDomainId
    : (availableDomains[0]?.id || '');

  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    domain_id: defaultDomainId,
    country_code: 'US',
    job_title: '',
    employment_status: 'active',
    hire_date: new Date().toISOString().split('T')[0],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronize and reset form state when modal opens or availableDomains load
  useEffect(() => {
    if (isOpen) {
      const initialDomainId = (selectedDomainId !== 'all' && selectedDomainId)
        ? selectedDomainId
        : (availableDomains[0]?.id || '');

      setFormData({
        employee_number: '',
        first_name: '',
        last_name: '',
        email: '',
        domain_id: initialDomainId,
        country_code: 'US',
        job_title: '',
        employment_status: 'active',
        hire_date: new Date().toISOString().split('T')[0],
      });
      setError(null);
    }
  }, [isOpen, selectedDomainId, availableDomains]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const created = await createEmployee(formData);
      if (onEmployeeCreated) {
        onEmployeeCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <h3 id="modal-title">Add New Employee</h3>
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
              <label htmlFor="modal-emp-number">Employee Number</label>
              <input
                id="modal-emp-number"
                name="employee_number"
                type="text"
                placeholder="e.g. EMP0005"
                required
                value={formData.employee_number}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-domain">Domain / Department</label>
              <select
                id="modal-domain"
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
              <label htmlFor="modal-first-name">First Name</label>
              <input
                id="modal-first-name"
                name="first_name"
                type="text"
                placeholder="First name"
                required
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-last-name">Last Name</label>
              <input
                id="modal-last-name"
                name="last_name"
                type="text"
                placeholder="Last name"
                required
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="modal-email">Work Email</label>
            <input
              id="modal-email"
              name="email"
              type="email"
              placeholder="e.g. employee@company.com"
              required
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="modal-job-title">Job Title</label>
              <input
                id="modal-job-title"
                name="job_title"
                type="text"
                placeholder="e.g. Software Engineer"
                required
                value={formData.job_title}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-country">Country (ISO-2)</label>
              <select
                id="modal-country"
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
              <label htmlFor="modal-status">Employment Status</label>
              <select
                id="modal-status"
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
              <label htmlFor="modal-hire-date">Hire Date</label>
              <input
                id="modal-hire-date"
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
              {loading ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
