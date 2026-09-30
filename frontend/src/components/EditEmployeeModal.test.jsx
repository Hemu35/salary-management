import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditEmployeeModal from './EditEmployeeModal';
import * as DomainContextModule from '../context/DomainContext';
import * as employeesApi from '../api/employees';

vi.mock('../api/employees', () => ({
  updateEmployee: vi.fn(),
}));

const mockEmployee = {
  id: 42,
  employee_number: 'EMP0042',
  first_name: 'Carol',
  last_name: 'Danvers',
  email: 'carol.danvers@example.com',
  domain: { id: 11, name: 'Sales & Marketing' },
  job_title: 'Enterprise Sales Director',
  country_code: 'US',
  employment_status: 'active',
  hire_date: '2023-11-10',
};

describe('EditEmployeeModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      availableDomains: [
        { id: 10, name: 'Engineering' },
        { id: 11, name: 'Sales & Marketing' },
      ],
      selectedDomainId: 10,
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <EditEmployeeModal
        isOpen={false}
        employee={mockEmployee}
        onClose={vi.fn()}
        onEmployeeUpdated={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders employee data into form fields when open', () => {
    render(
      <EditEmployeeModal
        isOpen={true}
        employee={mockEmployee}
        onClose={vi.fn()}
        onEmployeeUpdated={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Employee')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EMP0042')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EMP0042')).toBeDisabled(); // employee number immutable
    expect(screen.getByDisplayValue('Carol')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Danvers')).toBeInTheDocument();
    expect(screen.getByDisplayValue('carol.danvers@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Enterprise Sales Director')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2023-11-10')).toBeInTheDocument();
  });

  it('calls updateEmployee and onClose on successful form submission', async () => {
    employeesApi.updateEmployee.mockResolvedValueOnce({
      ...mockEmployee,
      job_title: 'VP of Global Sales',
      employment_status: 'active',
    });

    const onEmployeeUpdated = vi.fn();
    const onClose = vi.fn();

    render(
      <EditEmployeeModal
        isOpen={true}
        employee={mockEmployee}
        onClose={onClose}
        onEmployeeUpdated={onEmployeeUpdated}
      />
    );

    const titleInput = screen.getByLabelText(/Job Title/i);
    fireEvent.change(titleInput, { target: { value: 'VP of Global Sales' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(employeesApi.updateEmployee).toHaveBeenCalledWith(42, expect.objectContaining({
        job_title: 'VP of Global Sales',
      }));
      expect(onEmployeeUpdated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays error banner when update fails', async () => {
    employeesApi.updateEmployee.mockRejectedValueOnce(new Error('Email has already been taken'));

    render(
      <EditEmployeeModal
        isOpen={true}
        employee={mockEmployee}
        onClose={vi.fn()}
        onEmployeeUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email has already been taken');
    });
  });
});
