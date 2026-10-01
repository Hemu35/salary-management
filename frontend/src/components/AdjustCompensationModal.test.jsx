import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdjustCompensationModal from './AdjustCompensationModal';
import * as compApi from '../api/compensations';

vi.mock('../api/compensations');

describe('AdjustCompensationModal Component', () => {
  const mockEmployee = {
    id: 101,
    employee_number: 'EMP0001',
    first_name: 'Alice',
    last_name: 'Walker',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form elements with default values', () => {
    render(
      <AdjustCompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
        onCompensationCreated={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /Adjust Compensation Package/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Effective Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Currency/i)).toHaveValue('USD');
    expect(screen.getByLabelText(/Pay Frequency/i)).toHaveValue('annual');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('active');
    expect(screen.getByLabelText(/Component Amount/i)).toBeInTheDocument();
  });

  it('allows adding and removing dynamic components and calculates live annualized total', () => {
    render(
      <AdjustCompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
        onCompensationCreated={vi.fn()}
      />
    );

    // Initial component is base_salary. Enter amount 120000
    const initialAmountInput = screen.getByLabelText(/Component Amount/i);
    fireEvent.change(initialAmountInput, { target: { value: '120000' } });

    expect(screen.getByText(/USD 120,000\.00/i)).toBeInTheDocument();

    // Add another component
    const addCompBtn = screen.getByRole('button', { name: /\+ Add Component/i });
    fireEvent.click(addCompBtn);

    const amountInputs = screen.getAllByLabelText(/Component Amount/i);
    expect(amountInputs.length).to.eq(2);

    // Enter bonus of 20000
    fireEvent.change(amountInputs[1], { target: { value: '20000' } });
    expect(screen.getByText(/USD 140,000\.00/i)).toBeInTheDocument();

    // Remove the second component
    const removeButtons = screen.getAllByTitle('Remove component');
    fireEvent.click(removeButtons[1]);

    expect(screen.getAllByLabelText(/Component Amount/i).length).to.eq(1);
    expect(screen.getByText(/USD 120,000\.00/i)).toBeInTheDocument();
  });

  it('submits valid compensation package and invokes callback', async () => {
    const handleCreated = vi.fn();
    const handleClose = vi.fn();

    compApi.createEmployeeCompensation.mockResolvedValueOnce({
      id: 99,
      status: 'active',
      currency: 'USD',
    });

    render(
      <AdjustCompensationModal
        employee={mockEmployee}
        isOpen={true}
        onClose={handleClose}
        onCompensationCreated={handleCreated}
      />
    );

    const amountInput = screen.getByLabelText(/Component Amount/i);
    fireEvent.change(amountInput, { target: { value: '150000' } });

    const submitBtn = screen.getByRole('button', { name: /Save Compensation Package/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(compApi.createEmployeeCompensation).toHaveBeenCalledTimes(1);
    });

    expect(compApi.createEmployeeCompensation).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        currency: 'USD',
        pay_frequency: 'annual',
        status: 'active',
        components: [
          expect.objectContaining({
            component_type: 'base_salary',
            amount: 150000,
            frequency: 'annual',
          }),
        ],
      })
    );

    expect(handleCreated).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('pre-populates existing components when initialRecord is provided and supports in-place update', async () => {
    const handleCreated = vi.fn();
    const handleClose = vi.fn();

    const mockInitialRecord = {
      id: 55,
      effective_date: '2024-01-01',
      currency: 'GBP',
      pay_frequency: 'annual',
      status: 'active',
      notes: 'Initial package',
      components: [
        { component_type: 'base_salary', amount: '120000', frequency: 'annual' },
        { component_type: 'bonus', amount: '15000', frequency: 'annual' },
      ],
    };

    compApi.updateEmployeeCompensation.mockResolvedValueOnce({
      id: 55,
      currency: 'GBP',
      status: 'active',
    });

    render(
      <AdjustCompensationModal
        employee={mockEmployee}
        initialRecord={mockInitialRecord}
        mode="edit"
        isOpen={true}
        onClose={handleClose}
        onCompensationCreated={handleCreated}
      />
    );

    // Verify existing components are pre-populated
    const amountInputs = screen.getAllByLabelText(/Component Amount/i);
    expect(amountInputs.length).to.eq(2);
    expect(amountInputs[0]).toHaveValue(120000);
    expect(amountInputs[1]).toHaveValue(15000);
    expect(screen.getByText(/GBP 135,000\.00/i)).toBeInTheDocument();

    // Add an allowance component
    const addBtn = screen.getByRole('button', { name: /\+ Add Component/i });
    fireEvent.click(addBtn);

    const updatedAmountInputs = screen.getAllByLabelText(/Component Amount/i);
    expect(updatedAmountInputs.length).to.eq(3);
    fireEvent.change(updatedAmountInputs[2], { target: { value: '10000' } });

    // Submit in-place update
    const updateBtn = screen.getByRole('button', { name: /Update Compensation Package/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(compApi.updateEmployeeCompensation).toHaveBeenCalledTimes(1);
    });

    expect(compApi.updateEmployeeCompensation).toHaveBeenCalledWith(
      101,
      55,
      expect.objectContaining({
        currency: 'GBP',
        components: expect.arrayContaining([
          expect.objectContaining({ component_type: 'base_salary', amount: 120000 }),
          expect.objectContaining({ component_type: 'bonus', amount: 15000 }),
          expect.objectContaining({ component_type: 'allowance', amount: 10000 }),
        ]),
      })
    );

    expect(handleCreated).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

