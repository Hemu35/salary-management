import { useState, useEffect } from 'react';
import { createEmployeeCompensation, updateEmployeeCompensation } from '../api/compensations';

const COMPONENT_TYPES = [
  { value: 'base_salary', label: 'Base Salary' },
  { value: 'bonus', label: 'Bonus / Incentive' },
  { value: 'stock_grant', label: 'Stock Grant / Equity' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'commission', label: 'Commission' },
];

const FREQUENCIES = [
  { value: 'annual', label: 'Annual' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'one_time', label: 'One-Time' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'INR', 'AUD', 'SGD', 'JPY'];

export default function AdjustCompensationModal({
  employee,
  initialRecord,
  mode = 'adjust',
  isOpen,
  onClose,
  onCompensationCreated,
}) {
  const [actionType, setActionType] = useState(mode);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [payFrequency, setPayFrequency] = useState('annual');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [components, setComponents] = useState([
    { component_type: 'base_salary', amount: '', frequency: 'annual' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pre-populate form whenever modal opens or initialRecord changes
  useEffect(() => {
    if (isOpen) {
      setActionType(mode);
      setError(null);

      if (initialRecord) {
        setEffectiveDate(
          mode === 'edit' && initialRecord.effective_date
            ? initialRecord.effective_date
            : new Date().toISOString().split('T')[0]
        );
        setCurrency(initialRecord.currency || 'USD');
        setPayFrequency(initialRecord.pay_frequency || 'annual');
        setStatus(initialRecord.status || 'active');
        setNotes(initialRecord.notes || '');

        if (initialRecord.components && initialRecord.components.length > 0) {
          setComponents(
            initialRecord.components.map((c) => ({
              component_type: c.component_type,
              amount: c.amount || '',
              frequency: c.frequency || 'annual',
            }))
          );
        } else {
          setComponents([{ component_type: 'base_salary', amount: '', frequency: 'annual' }]);
        }
      } else {
        setEffectiveDate(new Date().toISOString().split('T')[0]);
        setCurrency('USD');
        setPayFrequency('annual');
        setStatus('active');
        setNotes('');
        setComponents([{ component_type: 'base_salary', amount: '', frequency: 'annual' }]);
      }
    }
  }, [isOpen, initialRecord, mode]);

  if (!isOpen || !employee) return null;

  const handleAddComponent = () => {
    setComponents([
      ...components,
      { component_type: 'allowance', amount: '', frequency: 'annual' },
    ]);
  };

  const handleRemoveComponent = (index) => {
    if (components.length === 1) return;
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleComponentChange = (index, field, value) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  // Compute live annualized sum for user preview
  const liveAnnualizedTotal = components.reduce((sum, comp) => {
    const amt = parseFloat(comp.amount) || 0;
    let factor = 1;
    if (comp.frequency === 'monthly') factor = 12;
    else if (comp.frequency === 'bi_weekly') factor = 26;
    else if (comp.frequency === 'hourly') factor = 2080;
    return sum + amt * factor;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate that at least one component has a positive amount
    const validComponents = components.filter((c) => parseFloat(c.amount) > 0);
    if (validComponents.length === 0) {
      setError('Please add at least one compensation component with an amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        effective_date: effectiveDate,
        currency,
        pay_frequency: payFrequency,
        status,
        notes,
        components: validComponents.map((c) => ({
          component_type: c.component_type,
          amount: parseFloat(c.amount),
          frequency: c.frequency,
        })),
      };

      let result;
      if (actionType === 'edit' && initialRecord?.id) {
        result = await updateEmployeeCompensation(employee.id, initialRecord.id, payload);
      } else {
        result = await createEmployeeCompensation(employee.id, payload);
      }

      if (onCompensationCreated) {
        onCompensationCreated(result);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save compensation package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-adjust-title"
    >
      <div className="modal-card modal-card-lg">
        {/* Header matching EditEmployeeModal */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="modal-adjust-title">
              {actionType === 'edit' ? 'Edit Compensation Package' : 'Adjust Compensation Package'}
            </h3>
            <span className="modal-subtitle">
              {employee.first_name} {employee.last_name} ({employee.employee_number})
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

        {/* Update Mode Selector when existing package is present */}
        {initialRecord && (
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-lg text-xs font-semibold self-start border border-slate-200">
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-all ${
                actionType === 'adjust'
                  ? 'bg-white shadow text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActionType('adjust')}
            >
              🔄 New Revision (Preserve History)
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-all ${
                actionType === 'edit'
                  ? 'bg-white shadow text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActionType('edit')}
            >
              ✏️ In-Place Edit (Update Current)
            </button>
          </div>
        )}

        {/* Form Body matching EditEmployeeModal */}
        <form onSubmit={handleSubmit} className="modal-form flex-1 overflow-y-auto">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="adjust-effective-date">Effective Date *</label>
              <input
                id="adjust-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="adjust-currency">Currency *</label>
              <select
                id="adjust-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="adjust-pay-frequency">Pay Frequency *</label>
              <select
                id="adjust-pay-frequency"
                value={payFrequency}
                onChange={(e) => setPayFrequency(e.target.value)}
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="bi_weekly">Bi-Weekly</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="adjust-status">Status *</label>
              <select
                id="adjust-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="draft">Draft (Pending review)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="adjust-notes">Adjustment Notes</label>
            <input
              id="adjust-notes"
              type="text"
              placeholder="e.g. Annual merit promotion, added travel allowance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Dynamic Components */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Compensation Components</h4>
                <p className="text-xs text-slate-500">
                  Pre-populated with current structure. Add allowances, bonuses, or update amounts.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddComponent}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                + Add Component
              </button>
            </div>

            <div className="space-y-3">
              {components.map((comp, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200"
                  data-testid={`comp-row-${idx}`}
                >
                  <div className="col-span-5 sm:col-span-4">
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">Component</label>
                    <select
                      value={comp.component_type}
                      onChange={(e) => handleComponentChange(idx, 'component_type', e.target.value)}
                      aria-label="Component Type"
                      className="w-full h-10 px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    >
                      {COMPONENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">Frequency</label>
                    <select
                      value={comp.frequency}
                      onChange={(e) => handleComponentChange(idx, 'frequency', e.target.value)}
                      aria-label="Component Frequency"
                      className="w-full h-10 px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3 sm:col-span-4">
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">Amount ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={comp.amount}
                      onChange={(e) => handleComponentChange(idx, 'amount', e.target.value)}
                      aria-label="Component Amount"
                      className="w-full h-10 px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-1 flex justify-end items-end sm:mt-4">
                    <button
                      type="button"
                      disabled={components.length === 1}
                      onClick={() => handleRemoveComponent(idx)}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 rounded transition-colors text-sm"
                      title="Remove component"
                      aria-label="Remove component"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Annualized Summary Card */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-indigo-900">Total Annualized Equivalent</span>
              <p className="text-xs text-indigo-600">Calculated sum of annualized components</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-indigo-900 font-mono">
                {currency} {liveAnnualizedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-indigo-500 block">/ year</span>
            </div>
          </div>

          {/* Actions - Equal Sized Buttons matching Edit modal */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : actionType === 'edit'
                ? 'Update Compensation Package'
                : 'Save Compensation Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
