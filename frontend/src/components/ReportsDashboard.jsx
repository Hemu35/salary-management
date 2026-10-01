import { useState, useEffect } from 'react';
import { useDomain } from '../context/DomainContext';
import { fetchWorkforceReport, fetchCompensationReport } from '../api/reports';

export default function ReportsDashboard() {
  const { selectedDomainId, activeDomain, isAllDomains } = useDomain();

  const [workforceData, setWorkforceData] = useState(null);
  const [compensationData, setCompensationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected currency tab for compensation insights
  const [selectedCurrency, setSelectedCurrency] = useState('');

  const loadReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const [wf, comp] = await Promise.all([
        fetchWorkforceReport({ domain_id: selectedDomainId }),
        fetchCompensationReport({ domain_id: selectedDomainId }),
      ]);

      setWorkforceData(wf);
      setCompensationData(comp);

      // Default to first available currency if none selected or if previous currency disappeared
      const availableCurrencies = comp.currencies || [];
      if (availableCurrencies.length > 0) {
        if (!selectedCurrency || !availableCurrencies.some((c) => c.currency === selectedCurrency)) {
          setSelectedCurrency(availableCurrencies[0].currency);
        }
      } else {
        setSelectedCurrency('');
      }
    } catch (err) {
      setError(err.message || 'Failed to load organizational analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [selectedDomainId]);

  const formatCurrencyAmount = (amount, currencyCode) => {
    const symbols = {
      USD: '$',
      GBP: '£',
      EUR: '€',
      INR: '₹',
      CAD: 'CA$',
      AUD: 'A$',
    };
    const symbol = symbols[currencyCode] || `${currencyCode} `;
    return `${symbol}${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return (
      <div className="reports-loading" aria-live="polite">
        <div className="spinner"></div>
        <p>Loading organizational analytics & insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner" role="alert">
        <span>⚠️ {error}</span>
        <button type="button" className="btn-secondary" onClick={loadReports} style={{ marginLeft: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  const currencies = compensationData?.currencies || [];
  const activeCurrencyData = currencies.find((c) => c.currency === selectedCurrency) || currencies[0];

  return (
    <div className="reports-dashboard" data-testid="reports-dashboard">
      <div className="reports-header">
        <div className="reports-titles">
          <h3>Workforce & Compensation Insights</h3>
          <span className="directory-scope-tag">
            Scope: {isAllDomains ? 'All Domains (Global)' : (activeDomain?.name || 'Departmental')}
          </span>
        </div>
        <button type="button" className="btn-secondary" onClick={loadReports} title="Refresh report metrics">
          🔄 Refresh Analytics
        </button>
      </div>

      {/* Top Level KPI Metrics */}
      <div className="reports-kpi-grid">
        <div className="kpi-card" data-testid="kpi-headcount">
          <span className="kpi-label">Total Headcount</span>
          <span className="kpi-number">{workforceData?.total_headcount || 0}</span>
          <div className="kpi-sub">
            <span className="badge-status-active">
              {workforceData?.active_headcount || 0} Active
            </span>
            <span className="badge-status-leave">
              {workforceData?.on_leave_headcount || 0} On Leave
            </span>
            {workforceData?.terminated_headcount > 0 && (
              <span className="badge-status-term">
                {workforceData?.terminated_headcount} Terminated
              </span>
            )}
          </div>
        </div>

        <div className="kpi-card" data-testid="kpi-countries">
          <span className="kpi-label">Global Presence</span>
          <span className="kpi-number">{workforceData?.by_country?.length || 0}</span>
          <span className="kpi-sub-text">Operating across international jurisdictions</span>
        </div>

        <div className="kpi-card" data-testid="kpi-domains">
          <span className="kpi-label">Active Domains</span>
          <span className="kpi-number">{workforceData?.by_domain?.length || 0}</span>
          <span className="kpi-sub-text">Organizational departments represented</span>
        </div>

        <div className="kpi-card" data-testid="kpi-currencies">
          <span className="kpi-label">Payroll Currencies</span>
          <span className="kpi-number">{currencies.length}</span>
          <span className="kpi-sub-text">
            {currencies.map((c) => c.currency).join(', ') || 'No active packages'}
          </span>
        </div>
      </div>

      {/* Workforce Demographics & Breakdown Section */}
      <div className="analytics-section">
        <h4 className="section-heading">👥 Workforce Distribution</h4>
        <div className="analytics-grid-two-col">
          {/* Distribution By Country */}
          <div className="analytics-card" data-testid="card-by-country">
            <h5>Distribution by Country</h5>
            {workforceData?.by_country?.length === 0 ? (
              <p className="text-muted">No country records found.</p>
            ) : (
              <div className="distribution-list">
                {workforceData?.by_country?.map((item) => (
                  <div key={item.country_code} className="distribution-item">
                    <div className="distribution-info">
                      <span className="distribution-flag">{item.flag}</span>
                      <span className="distribution-name">{item.country_name}</span>
                      <span className="distribution-count">
                        <strong>{item.count}</strong> ({item.percentage}%)
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distribution By Domain */}
          <div className="analytics-card" data-testid="card-by-domain">
            <h5>Distribution by Department</h5>
            {workforceData?.by_domain?.length === 0 ? (
              <p className="text-muted">No department records found.</p>
            ) : (
              <div className="distribution-list">
                {workforceData?.by_domain?.map((item) => (
                  <div key={item.domain_id} className="distribution-item">
                    <div className="distribution-info">
                      <span className="domain-badge">{item.domain_name}</span>
                      <span className="distribution-count">
                        <strong>{item.count}</strong> ({item.percentage}%)
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill progress-fill-domain"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compensation Insights Section (Strictly Currency Isolated) */}
      <div className="analytics-section">
        <div className="section-heading-row">
          <div>
            <h4 className="section-heading">💰 Compensation Insights</h4>
            <p className="section-subtext">
              Amounts are segregated by currency. Cross-currency summation is strictly prohibited.
            </p>
          </div>
          <span className="currency-safety-tag">🛡️ Currency Isolated</span>
        </div>

        {currencies.length === 0 ? (
          <div className="empty-analytics-state">
            <span className="empty-icon">💳</span>
            <h5>No Active Compensation Records</h5>
            <p>Employees in the selected scope do not have active compensation packages assigned yet.</p>
          </div>
        ) : (
          <div className="compensation-currency-container">
            {/* Currency Tabs */}
            <div className="currency-tabs-nav" role="tablist" aria-label="Select currency for compensation analysis">
              {currencies.map((currObj) => (
                <button
                  key={currObj.currency}
                  type="button"
                  role="tab"
                  aria-selected={selectedCurrency === currObj.currency}
                  className={`currency-tab-btn ${selectedCurrency === currObj.currency ? 'active' : ''}`}
                  onClick={() => setSelectedCurrency(currObj.currency)}
                >
                  <span className="tab-currency-code">{currObj.currency}</span>
                  <span className="tab-emp-count">({currObj.employee_count} employees)</span>
                </button>
              ))}
            </div>

            {activeCurrencyData && (
              <div className="currency-details-panel" data-testid={`comp-details-${activeCurrencyData.currency}`}>
                {/* Financial Summary KPI Cards */}
                <div className="financial-kpi-grid">
                  <div className="financial-card">
                    <span className="financial-label">Total Annualized Payroll</span>
                    <span className="financial-value">
                      {formatCurrencyAmount(activeCurrencyData.total_annualized_budget, activeCurrencyData.currency)}
                    </span>
                    <span className="financial-sub">Annualized commitment</span>
                  </div>

                  <div className="financial-card">
                    <span className="financial-label">Average Compensation</span>
                    <span className="financial-value">
                      {formatCurrencyAmount(activeCurrencyData.avg_annualized_compensation, activeCurrencyData.currency)}
                    </span>
                    <span className="financial-sub">Per employee mean</span>
                  </div>

                  <div className="financial-card">
                    <span className="financial-label">Median Compensation</span>
                    <span className="financial-value">
                      {formatCurrencyAmount(activeCurrencyData.median_annualized_compensation, activeCurrencyData.currency)}
                    </span>
                    <span className="financial-sub">50th percentile</span>
                  </div>

                  <div className="financial-card">
                    <span className="financial-label">Salary Range</span>
                    <span className="financial-value financial-range">
                      {formatCurrencyAmount(activeCurrencyData.min_annualized_compensation, activeCurrencyData.currency)} -{' '}
                      {formatCurrencyAmount(activeCurrencyData.max_annualized_compensation, activeCurrencyData.currency)}
                    </span>
                    <span className="financial-sub">Min to Max range</span>
                  </div>
                </div>

                {/* Component Breakdown & Department Spend */}
                <div className="analytics-grid-two-col" style={{ marginTop: '1.5rem' }}>
                  {/* Component Breakdown */}
                  <div className="analytics-card">
                    <h5>Compensation Component Allocation ({activeCurrencyData.currency})</h5>
                    <div className="component-bars-list">
                      {Object.entries(activeCurrencyData.component_breakdown || {}).map(([type, amount]) => {
                        const total = activeCurrencyData.total_annualized_budget || 1;
                        const pct = ((amount / total) * 100).round ? ((amount / total) * 100).toFixed(1) : (((amount / total) * 100) || 0).toFixed(1);
                        const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

                        return (
                          <div key={type} className="component-stat-row">
                            <div className="component-stat-meta">
                              <span className="component-name font-semibold">{label}</span>
                              <span className="component-amount">
                                {formatCurrencyAmount(amount, activeCurrencyData.currency)}{' '}
                                <span className="text-muted">({pct}%)</span>
                              </span>
                            </div>
                            <div className="progress-track">
                              <div
                                className={`progress-fill progress-component-${type}`}
                                style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Department Breakdown */}
                  <div className="analytics-card">
                    <h5>Departmental Payroll Spend ({activeCurrencyData.currency})</h5>
                    {activeCurrencyData.by_domain?.length === 0 ? (
                      <p className="text-muted">No department data available.</p>
                    ) : (
                      <div className="department-spend-table-wrapper">
                        <table className="mini-data-table">
                          <thead>
                            <tr>
                              <th>Department</th>
                              <th>Employees</th>
                              <th>Total Budget</th>
                              <th>Avg Salary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeCurrencyData.by_domain.map((dom) => (
                              <tr key={dom.domain_id}>
                                <td className="font-semibold">{dom.domain_name}</td>
                                <td>{dom.employee_count}</td>
                                <td>{formatCurrencyAmount(dom.total_annualized_budget, activeCurrencyData.currency)}</td>
                                <td>{formatCurrencyAmount(dom.avg_annualized_compensation, activeCurrencyData.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
