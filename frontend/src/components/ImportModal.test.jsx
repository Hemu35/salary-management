import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ImportModal from './ImportModal';
import * as ImportsApiModule from '../api/imports';

describe('ImportModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnImportCompleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ImportsApiModule, 'fetchImports').mockResolvedValue([]);
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ImportModal
        isOpen={false}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dropzone, template download button, and requirements when open', async () => {
    render(
      <ImportModal
        isOpen={true}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );

    expect(screen.getByRole('heading', { name: /Bulk CSV Import Center/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Sample Template/i })).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop your .csv file\(s\) here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Import/i })).toBeDisabled();
  });

  it('allows closing modal at any time via close button', () => {
    render(
      <ImportModal
        isOpen={true}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    expect(closeBtn).toBeEnabled();
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('validates file extension on selection and supports multiple files', async () => {
    render(
      <ImportModal
        isOpen={true}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );

    const input = screen.getByTestId('import-file-input');

    // Invalid non-csv file
    const invalidFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [invalidFile] } });
    expect(screen.getByText(/Ignored non-CSV file\(s\)/i)).toBeInTheDocument();

    // Multiple valid csv files
    const file1 = new File(['num,name\n1,alice'], 'team_a.csv', { type: 'text/csv' });
    const file2 = new File(['num,name\n2,bob'], 'team_b.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file1, file2] } });

    expect(screen.getByText('team_a.csv')).toBeInTheDocument();
    expect(screen.getByText('team_b.csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Import \(2 files\)/i })).not.toBeDisabled();
  });

  it('submits multiple CSV files, transitions to queue view, and tracks progress', async () => {
    const file1 = new File(['num,name'], 'batch_one.csv', { type: 'text/csv' });

    const activeJob = {
      id: 101,
      status: 'processing',
      filename: 'batch_one.csv',
      total_rows: 50,
      processed_rows: 25,
      successful_rows: 25,
      failed_rows: 0,
      progress_percentage: 50,
      created_at: new Date().toISOString(),
    };

    const completedJob = {
      ...activeJob,
      status: 'completed',
      processed_rows: 50,
      successful_rows: 50,
      progress_percentage: 100,
    };

    vi.spyOn(ImportsApiModule, 'createImport').mockResolvedValue({ count: 1 });
    vi.spyOn(ImportsApiModule, 'fetchImports')
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([activeJob]) // after upload
      .mockResolvedValue([completedJob]); // polling

    render(
      <ImportModal
        isOpen={true}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );

    const input = screen.getByTestId('import-file-input');
    fireEvent.change(input, { target: { files: [file1] } });

    const submitBtn = screen.getByRole('button', { name: /Start Import/i });
    fireEvent.click(submitBtn);

    // Should switch to jobs queue view
    await waitFor(() => {
      expect(screen.getByText(/batch_one.csv/i)).toBeInTheDocument();
      expect(screen.getByText(/PROCESSING/i)).toBeInTheDocument();
    });

    // Background close button is active and accessible
    const bgCloseBtn = screen.getByRole('button', { name: /Close & Run in Background/i });
    expect(bgCloseBtn).toBeEnabled();
    fireEvent.click(bgCloseBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows cancelling an active import job', async () => {
    const runningJob = {
      id: 202,
      status: 'processing',
      filename: 'long_running.csv',
      total_rows: 500,
      processed_rows: 100,
      successful_rows: 100,
      failed_rows: 0,
      progress_percentage: 20,
      can_cancel: true,
      can_rollback: false,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cancelSpy = vi.spyOn(ImportsApiModule, 'cancelImport').mockResolvedValue({ message: 'Cancelled' });
    vi.spyOn(ImportsApiModule, 'fetchImports').mockResolvedValue([runningJob]);

    render(
      <ImportModal
        isOpen={true}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );

    // Switch to jobs tab
    const queueTab = screen.getByRole('button', { name: /Import Queue & History/i });
    fireEvent.click(queueTab);

    await waitFor(() => {
      expect(screen.getByText(/long_running.csv/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Confirm modal should appear
    expect(screen.getByText(/Cancel Running Import\?/i)).toBeInTheDocument();
    const confirmCancelBtn = screen.getByRole('button', { name: /Yes, Cancel Job/i });
    fireEvent.click(confirmCancelBtn);

    expect(cancelSpy).toHaveBeenCalledWith(202);
  });

  it('allows rolling back a completed import job', async () => {
    const completedJob = {
      id: 303,
      status: 'completed',
      filename: 'mistake_salaries.csv',
      total_rows: 20,
      processed_rows: 20,
      successful_rows: 20,
      failed_rows: 0,
      progress_percentage: 100,
      can_cancel: false,
      can_rollback: true,
      created_at: new Date().toISOString(),
    };

    const rollbackSpy = vi.spyOn(ImportsApiModule, 'rollbackImport').mockResolvedValue({ message: 'Rolled back' });
    vi.spyOn(ImportsApiModule, 'fetchImports').mockResolvedValue([completedJob]);

    render(
      <ImportModal
        isOpen={true}
        onClose={mockOnClose}
        onImportCompleted={mockOnImportCompleted}
      />
    );

    // Switch to jobs tab
    const queueTab = screen.getByRole('button', { name: /Import Queue & History/i });
    fireEvent.click(queueTab);

    await waitFor(() => {
      expect(screen.getByText(/mistake_salaries.csv/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rollback/i })).toBeInTheDocument();
    });

    const rollbackBtn = screen.getByRole('button', { name: /Rollback/i });
    fireEvent.click(rollbackBtn);

    // Confirm modal should appear
    expect(screen.getByText(/Confirm Import Rollback/i)).toBeInTheDocument();
    const confirmRollbackBtn = screen.getByRole('button', { name: /Yes, Rollback Import/i });
    fireEvent.click(confirmRollbackBtn);

    expect(rollbackSpy).toHaveBeenCalledWith(303);
    await waitFor(() => {
      expect(mockOnImportCompleted).toHaveBeenCalled();
    });
  });
});
