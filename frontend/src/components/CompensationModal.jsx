import { useState, useEffect } from 'react';
import { fetchEmployeeCompensation } from '../api/compensations';
import AdjustCompensationModal from './AdjustCompensationModal';

export default function CompensationModal({ employee, isOpen, onClose, onCompensationUpdated }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState('adjust'); // 'adjust' or 'edit'

  useEffect(() => {
    if (isOpen && employee?.id) {
      loadCompensation();
    }
  }, [isOpen, employee?.id]);

  const loadCompensation = async () => {
    if (!employee?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployeeCompensation(employee.id);
      setRecords(data.compensation_records || []);
    } catch (err) {
      setError(err.message || 'Failed to load compensation records');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  const activeRecord = records.find((r) => r.status === 'active') || records[0];
  const historyRecords = records.filter((r) => r.id !== activeRecord?.id);

  const formatCurrency = (amount, currency = 'USD') => {
    const num = parseFloat(amount) || 0;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${currency} ${num.toFixed(2)}`;
    }
  };

  const formatComponentType = (type) => {
    switch (type) {
      case 'base_salary':
        return 'Base Salary';
      case 'bonus':
        return 'Performance Bonus';
      case 'stock_grant':
        return 'Stock / Equity Grant';
      case 'allowance':
        return 'Allowance';
      case 'commission':
        return 'Sales Commission';
      default:
        return type.replace('_', ' ');
    }
  };

  const handleCompensationCreated = () => {
    loadCompensation();
    if (onCompensationUpdated) {
      onCompensationUpdated();
    }
  };

  const openAdjustModal = (mode = 'adjust') => {
    setAdjustMode(mode);
    setIsAdjustOpen(true);
  };

  return (
    <>
      <div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-compensation-title"
      >
        <div className="modal-card modal-card-lg">
          {/* Header matching EditEmployeeModal */}
          <div className="modal-header">
            <div className="modal-title-group">
              <h3 id="modal-compensation-title">
                Compensation & Package — {employee.first_name} {employee.last_name}
              </h3>
              <span className="modal-subtitle">
                {employee.employee_number} • {employee.job_title} • {employee.domain?.name}
              </span>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              ⚠️ {error}
            </div>
          )}

          {/* Modal Body Scroll */}
          <div className="modal-body-scroll">
            {loading ? (
              <div className="py-12 text-center" aria-live="polite">
                <div className="spinner mx-auto mb-3"></div>
                <p className="text-sm text-slate-500">Loading compensation package details...</p>
              </div>
            ) : !activeRecord ? (
              /* Robust Empty State matching app design system */
              <div className="empty-state-box">
                <span className="empty-icon" role="img" aria-label="No compensation document">📄</span>
                <h4>No Compensation Records</h4>
                <p>
                  This employee does not have an active compensation package recorded yet.
                </p>
                <button
                  type="button"
                  onClick={() => openAdjustModal('adjust')}
                  className="btn-empty-action"
                >
                  + Set Initial Compensation
                </button>
              </div>
            ) : (
              <>
                {/* Active Compensation Hero Card */}
                <div className="comp-hero-card">
                  <div className="comp-hero-badges">
                    <div className="comp-badge-group">
                      <span className="comp-status-pill">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        {activeRecord.status === 'active' ? 'Active Package' : activeRecord.status}
                      </span>
                      <span className="comp-currency-badge">
                        {activeRecord.currency}
                      </span>
                      <span className="comp-freq-text">
                        {activeRecord.pay_frequency} Frequency
                      </span>
                      <button
                        type="button"
                        className="btn-action-edit"
                        style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem', height: '26px' }}
                        onClick={() => openAdjustModal('edit')}
                        title="Edit current package in place"
                      >
                        ✏️ Edit Current Package
                      </button>
                    </div>

                    <div className="comp-effective-date">
                      Effective since <strong>{activeRecord.effective_date}</strong>
                    </div>
                  </div>

                  <div className="comp-kpi-grid">
                    <div>
                      <span className="comp-kpi-label">
                        Total Annualized Compensation
                      </span>
                      <div className="comp-kpi-amount">
                        {formatCurrency(activeRecord.total_annualized_compensation, activeRecord.currency)}
                        <span className="comp-kpi-period">/ yr</span>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <span className="comp-kpi-label">
                        Base Salary
                      </span>
                      <div className="comp-kpi-base">
                        {formatCurrency(activeRecord.base_salary_amount, activeRecord.currency)}
                      </div>
                    </div>
                  </div>

                  {activeRecord.notes && (
                    <div className="comp-notes-box">
                      <strong>Notes:</strong> {activeRecord.notes}
                    </div>
                  )}

                  {/* Components Breakdown Table */}
                  <div className="comp-table-card">
                    <div className="comp-table-header">
                      <h4>
                        Component Breakdown ({activeRecord.components?.length || 0})
                      </h4>
                      <span>Fixed precision NUMERIC(15,2)</span>
                    </div>

                    <div>
                      {activeRecord.components?.map((comp) => (
                        <div key={comp.id} className="comp-table-row">
                          <div>
                            <span className="comp-row-title">{formatComponentType(comp.component_type)}</span>
                            <span className="comp-row-sub">{comp.frequency}</span>
                          </div>
                          <div>
                            <span className="comp-row-val">
                              {formatCurrency(comp.amount, activeRecord.currency)}
                            </span>
                            {comp.frequency !== 'annual' && (
                              <span className="comp-row-annualized">
                                {formatCurrency(comp.annualized_amount, activeRecord.currency)} / yr
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Compensation History & Revision Timeline */}
                {historyRecords.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">Compensation Revision History</h4>
                      <span className="text-xs text-slate-500">{historyRecords.length} past revisions</span>
                    </div>

                    <div className="space-y-2.5">
                      {historyRecords.map((record) => (
                        <div
                          key={record.id}
                          className="comp-history-card"
                          data-testid={`history-record-${record.id}`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 text-slate-600 uppercase">
                                {record.status}
                              </span>
                              <span className="text-xs font-semibold text-slate-800">
                                Effective {record.effective_date}
                              </span>
                              {record.created_by && (
                                <span className="text-[11px] text-slate-400">
                                  by {record.created_by.email}
                                </span>
                              )}
                            </div>
                            {record.notes && <p className="text-xs text-slate-500 italic">"{record.notes}"</p>}
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-800 font-mono block">
                              {formatCurrency(record.total_annualized_compensation, record.currency)} / yr
                            </span>
                            <span className="text-xs text-slate-500">
                              Base: {formatCurrency(record.base_salary_amount, record.currency)} ({record.components?.length || 0} components)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal Actions - Equal sized buttons matching Edit modal */}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Close
            </button>
            {activeRecord && (
              <button
                type="button"
                className="btn-submit"
                onClick={() => openAdjustModal('adjust')}
              >
                + Adjust Compensation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested Adjust/Edit Modal */}
      {isAdjustOpen && (
        <AdjustCompensationModal
          employee={employee}
          initialRecord={activeRecord}
          mode={adjustMode}
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          onCompensationCreated={handleCompensationCreated}
        />
      )}
    </>
  );
}
