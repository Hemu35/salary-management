import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportsDashboard from './ReportsDashboard';
import * as DomainContextModule from '../context/DomainContext';
import * as ReportsApiModule from '../api/reports';

const mockWorkforceReport = {
  total_headcount: 3,
  active_headcount: 2,
  on_leave_headcount: 1,
  terminated_headcount: 0,
  by_country: [
    { country_code: 'US', country_name: 'United States', flag: '🇺🇸', count: 2, percentage: 66.7 },
    { country_code: 'GB', country_name: 'United Kingdom', flag: '🇬🇧', count: 1, percentage: 33.3 },
  ],
  by_domain: [
    { domain_id: 1, domain_name: 'Engineering', count: 2, percentage: 66.7 },
    { domain_id: 2, domain_name: 'Sales & Marketing', count: 1, percentage: 33.3 },
  ],
  by_status: [
    { status: 'active', count: 2, percentage: 66.7 },
    { status: 'on_leave', count: 1, percentage: 33.3 },
  ],
};

const mockCompensationReport = {
  currencies: [
    {
      currency: 'USD',
      employee_count: 2,
      total_annualized_budget: 230000.0,
      avg_annualized_compensation: 115000.0,
      median_annualized_compensation: 115000.0,
      min_annualized_compensation: 100000.0,
      max_annualized_compensation: 130000.0,
      component_breakdown: {
        base_salary: 220000.0,
        bonus: 10000.0,
        allowance: 0.0,
        stock_grant: 0.0,
        commission: 0.0,
      },
      by_domain: [
        {
          domain_id: 1,
          domain_name: 'Engineering',
          employee_count: 2,
          total_annualized_budget: 230000.0,
          avg_annualized_compensation: 115000.0,
        },
      ],
    },
    {
      currency: 'GBP',
      employee_count: 1,
      total_annualized_budget: 80000.0,
      avg_annualized_compensation: 80000.0,
      median_annualized_compensation: 80000.0,
      min_annualized_compensation: 80000.0,
      max_annualized_compensation: 80000.0,
      component_breakdown: {
        base_salary: 80000.0,
        bonus: 0.0,
        allowance: 0.0,
        stock_grant: 0.0,
        commission: 0.0,
      },
      by_domain: [
        {
          domain_id: 2,
          domain_name: 'Sales & Marketing',
          employee_count: 1,
          total_annualized_budget: 80000.0,
          avg_annualized_compensation: 80000.0,
        },
      ],
    },
  ],
};

describe('ReportsDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      selectedDomainId: 'all',
      activeDomain: null,
      isAllDomains: true,
      availableDomains: [{ id: '1', name: 'Engineering' }],
    });
    vi.spyOn(ReportsApiModule, 'fetchWorkforceReport').mockResolvedValue(mockWorkforceReport);
    vi.spyOn(ReportsApiModule, 'fetchCompensationReport').mockResolvedValue(mockCompensationReport);
  });

  it('renders loading state initially', () => {
    render(<ReportsDashboard />);
    expect(screen.getByText(/Loading organizational analytics/i)).toBeInTheDocument();
  });

  it('renders workforce metrics and KPI cards upon successful load', async () => {
    render(<ReportsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Workforce & Compensation Insights')).toBeInTheDocument();
    });

    // Check KPI headcount
    const headcountKpi = screen.getByTestId('kpi-headcount');
    expect(headcountKpi).toHaveTextContent('3');
    expect(headcountKpi).toHaveTextContent('2 Active');
    expect(headcountKpi).toHaveTextContent('1 On Leave');

    // Check Global Presence & Domains
    expect(screen.getByTestId('kpi-countries')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-domains')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-currencies')).toHaveTextContent('2');

    // Check By Country breakdown
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText('United Kingdom')).toBeInTheDocument();

    // Check By Department breakdown
    expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sales & Marketing').length).toBeGreaterThan(0);
  });

  it('renders currency-isolated compensation insights and allows switching currency tabs', async () => {
    render(<ReportsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Workforce & Compensation Insights')).toBeInTheDocument();
    });

    // Both currency tabs should exist
    const usdTab = screen.getByRole('tab', { name: /USD/i });
    const gbpTab = screen.getByRole('tab', { name: /GBP/i });
    expect(usdTab).toBeInTheDocument();
    expect(gbpTab).toBeInTheDocument();

    // Initially USD is selected
    expect(screen.getByTestId('comp-details-USD')).toBeInTheDocument();
    expect(screen.getAllByText('$230,000.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$115,000.00').length).toBeGreaterThan(0);

    // Switch to GBP
    fireEvent.click(gbpTab);

    // GBP panel should now be visible with GBP amounts
    expect(screen.getByTestId('comp-details-GBP')).toBeInTheDocument();
    expect(screen.getAllByText('£80,000.00').length).toBeGreaterThan(0);
  });

  it('displays error banner when API call fails', async () => {
    vi.spyOn(ReportsApiModule, 'fetchWorkforceReport').mockRejectedValue(new Error('Network error'));

    render(<ReportsDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('⚠️ Network error');
    });

    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});
