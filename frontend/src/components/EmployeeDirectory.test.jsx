import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmployeeDirectory from './EmployeeDirectory';
import * as DomainContextModule from '../context/DomainContext';
import * as EmployeesApiModule from '../api/employees';

const mockResponse = {
  employees: [
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
  ],
  meta: {
    current_page: 1,
    total_pages: 1,
    total_count: 1,
    per_page: 25,
  },
};

describe('EmployeeDirectory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(DomainContextModule, 'useDomain').mockReturnValue({
      selectedDomainId: 'all',
      activeDomain: null,
      isAllDomains: true,
      availableDomains: [{ id: '1', name: 'Engineering' }],
    });
    vi.spyOn(EmployeesApiModule, 'fetchEmployees').mockResolvedValue(mockResponse);
  });

  it('fetches and displays employees on mount', async () => {
    render(<EmployeeDirectory />);

    expect(screen.getByText(/Loading employee directory/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Walker')).toBeInTheDocument();
      expect(screen.getByText('EMP0001')).toBeInTheDocument();
      expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 1 of 1 employee');
    });
  });

  it('updates search query when typed in search bar', async () => {
    render(<EmployeeDirectory />);

    await waitFor(() => {
      expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name, email, or employee number/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(searchInput.value).toBe('Alice');
  });

  it('opens and closes Add Employee modal', async () => {
    render(<EmployeeDirectory />);

    await waitFor(() => {
      expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /\+ Add Employee/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: /Add New Employee/i })).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('heading', { name: /Add New Employee/i })).not.toBeInTheDocument();
  });
});
