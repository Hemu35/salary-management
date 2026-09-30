import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateEmployeeModal from './CreateEmployeeModal';
import * as DomainContextModule from '../context/DomainContext';
import * as EmployeesApiModule from '../api/employees';

describe('CreateEmployeeModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnEmployeeCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      availableDomains: [
        { id: '1', name: 'Engineering' },
        { id: '2', name: 'Sales & Marketing' },
      ],
      selectedDomainId: '1',
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CreateEmployeeModal
        isOpen={false}
        onClose={mockOnClose}
        onEmployeeCreated={mockOnEmployeeCreated}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders form inputs when isOpen is true', () => {
    render(
      <CreateEmployeeModal
        isOpen={true}
        onClose={mockOnClose}
        onEmployeeCreated={mockOnEmployeeCreated}
      />
    );

    expect(screen.getByRole('heading', { name: /Add New Employee/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Employee Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Job Title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Employee/i })).toBeInTheDocument();
  });

  it('submits form data and calls onEmployeeCreated on success', async () => {
    const createdEmployee = { id: 10, first_name: 'John', last_name: 'Doe' };
    vi.spyOn(EmployeesApiModule, 'createEmployee').mockResolvedValue(createdEmployee);

    render(
      <CreateEmployeeModal
        isOpen={true}
        onClose={mockOnClose}
        onEmployeeCreated={mockOnEmployeeCreated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Employee Number/i), { target: { value: 'EMP9999' } });
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByLabelText(/Job Title/i), { target: { value: 'QA Engineer' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Employee/i }));

    await waitFor(() => {
      expect(EmployeesApiModule.createEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          employee_number: 'EMP9999',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          job_title: 'QA Engineer',
        })
      );
      expect(mockOnEmployeeCreated).toHaveBeenCalledWith(createdEmployee);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('displays error banner when API throws an error', async () => {
    vi.spyOn(EmployeesApiModule, 'createEmployee').mockRejectedValue(
      new Error('Email has already been taken')
    );

    render(
      <CreateEmployeeModal
        isOpen={true}
        onClose={mockOnClose}
        onEmployeeCreated={mockOnEmployeeCreated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Employee Number/i), { target: { value: 'EMP9999' } });
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'taken@example.com' } });
    fireEvent.change(screen.getByLabelText(/Job Title/i), { target: { value: 'Developer' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Employee/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Email has already been taken/i);
    });
  });
});
