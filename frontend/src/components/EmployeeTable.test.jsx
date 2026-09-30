import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmployeeTable from './EmployeeTable';

const mockEmployees = [
  {
    id: 1,
    employee_number: 'EMP0001',
    first_name: 'Alice',
    last_name: 'Walker',
    email: 'alice.walker@example.com',
    domain: { id: 1, name: 'Engineering' },
    country_code: 'US',
    job_title: 'Staff Engineer',
    employment_status: 'active',
    hire_date: '2024-03-15',
  },
  {
    id: 2,
    employee_number: 'EMP0002',
    first_name: 'Bob',
    last_name: 'Martin',
    email: 'bob.martin@example.com',
    domain: { id: 2, name: 'Sales & Marketing' },
    country_code: 'GB',
    job_title: 'Sales Lead',
    employment_status: 'terminated',
    hire_date: '2023-01-10',
  },
];

describe('EmployeeTable Component', () => {
  it('renders loading state when loading is true', () => {
    render(<EmployeeTable employees={[]} loading={true} />);
    expect(screen.getByText(/Loading employee directory/i)).toBeInTheDocument();
  });

  it('renders empty state when no employees are present', () => {
    render(<EmployeeTable employees={[]} loading={false} />);
    expect(screen.getByText(/No employees found/i)).toBeInTheDocument();
  });

  it('renders employee rows with details and badges', () => {
    render(<EmployeeTable employees={mockEmployees} loading={false} />);

    expect(screen.getByText('EMP0001')).toBeInTheDocument();
    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.getByText('alice.walker@example.com')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('EMP0002')).toBeInTheDocument();
    expect(screen.getByText('Bob Martin')).toBeInTheDocument();
    expect(screen.getByText('Terminated')).toBeInTheDocument();
  });

  it('calls onEditEmployee when Edit button is clicked', () => {
    const onEditEmployee = vi.fn();
    render(<EmployeeTable employees={mockEmployees} loading={false} onEditEmployee={onEditEmployee} />);

    const editBtn = screen.getByRole('button', { name: /Edit Alice Walker/i });
    editBtn.click();

    expect(onEditEmployee).toHaveBeenCalledWith(mockEmployees[0]);
  });
});
