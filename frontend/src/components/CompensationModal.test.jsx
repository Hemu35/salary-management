import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CompensationModal from './CompensationModal';
import * as compApi from '../api/compensations';

vi.mock('../api/compensations');

describe('CompensationModal Component', () => {
  const mockEmployee = {
    id: 101,
    employee_number: 'EMP0001',
    first_name: 'Alice',
    last_name: 'Walker',
    job_title: 'Staff Systems Engineer',
    domain: { id: 1, name: 'Engineering' },
  };

  const mockCompensationData = {
    compensation_records: [
      {
        id: 1,
        effective_date: '2024-03-15',
        currency: 'USD',
        pay_frequency: 'annual',
        status: 'active',
        notes: 'Initial hiring package',
        base_salary_amount: '165000.0',
        total_annualized_compensation: '190000.0',
        created_by: { id: 1, email: 'admin@example.com' },
        components: [
          {
            id: 10,
            component_type: 'base_salary',
            amount: '165000.0',
            frequency: 'annual',
            annualized_amount: '165000.0',
          },
          {
            id: 11,
            component_type: 'bonus',
            amount: '25000.0',
            frequency: 'annual',
            annualized_amount: '25000.0',
          },
        ],
      },
      {
        id: 2,
        effective_date: '2023-03-15',
        currency: 'USD',
        pay_frequency: 'annual',
        status: 'superseded',
        notes: 'Entry level package',
        base_salary_amount: '140000.0',
        total_annualized_compensation: '150000.0',
        created_by: { id: 1, email: 'admin@example.com' },
        components: [
          {
            id: 8,
            component_type: 'base_salary',
            amount: '140000.0',
            frequency: 'annual',
            annualized_amount: '140000.0',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders employee information and active compensation details', async () => {
    compApi.fetchEmployeeCompensation.mockResolvedValueOnce(mockCompensationData);

    render(
      <CompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Compensation & Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice Walker/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(compApi.fetchEmployeeCompensation).toHaveBeenCalledWith(101);
    });

    // Check Active Package and components
    expect(await screen.findByText('Active Package')).toBeInTheDocument();
    expect(screen.getByText(/\$190,000\.00/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$165,000\.00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Base Salary').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Performance Bonus')).toBeInTheDocument();

    // Check revision history section
    expect(screen.getByText('Compensation Revision History')).toBeInTheDocument();
    expect(screen.getByText(/Effective 2023-03-15/i)).toBeInTheDocument();
  });

  it('renders empty state when no compensation records exist', async () => {
    compApi.fetchEmployeeCompensation.mockResolvedValueOnce({ compensation_records: [] });

    render(
      <CompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('No Compensation Records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Set Initial Compensation/i })).toBeInTheDocument();
  });

  it('opens Adjust Compensation modal when clicking adjust button', async () => {
    compApi.fetchEmployeeCompensation.mockResolvedValueOnce(mockCompensationData);

    render(
      <CompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const adjustBtn = await screen.findByRole('button', { name: /\+ Adjust Compensation/i });
    fireEvent.click(adjustBtn);

    expect(screen.getByRole('dialog', { name: /Adjust Compensation Package/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    compApi.fetchEmployeeCompensation.mockResolvedValueOnce(mockCompensationData);

    render(
      <CompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
