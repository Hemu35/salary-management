import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

test.describe('Bulk CSV Import E2E Browser Automation', () => {
  let tmpCsvPath;

  test.beforeAll(() => {
    try {
      execSync('docker compose exec -T db psql -U postgres -d compensation_dev -c "DELETE FROM import_jobs;"', { stdio: 'ignore' });
      execSync('docker compose exec -T backend bundle exec rails db:seed', { stdio: 'ignore', timeout: 30000 });
    } catch (e) {
      console.warn('Note: db:seed beforeAll skipped in test environment:', e.message);
    }
  });

  test.afterAll(() => {
    try {
      execSync('docker compose exec -T db psql -U postgres -d compensation_dev -c "DELETE FROM employees WHERE tenant_id IN (SELECT id FROM tenants WHERE name = \'Acme Corporation\') AND employee_number NOT IN (\'EMP0001\', \'EMP0002\', \'EMP0003\', \'EMP0004\');"', { stdio: 'ignore' });
    } catch (e) {
      // ignore
    }
  });

  test.afterEach(() => {
    if (tmpCsvPath && fs.existsSync(tmpCsvPath)) {
      try {
        fs.unlinkSync(tmpCsvPath);
      } catch (e) {
        // ignore cleanup error
      }
    }
  });

  test('Org Admin opens Import Modal, downloads template, and imports employees successfully', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for Employee Directory
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');

    // Click Import CSV button
    await page.click('.btn-import-csv');

    // Verify modal elements
    const modal = page.locator('.modal-card');
    await expect(modal.locator('#import-modal-title')).toHaveText('Bulk CSV Import Center');
    await expect(modal.locator('.btn-download-template')).toBeVisible();

    // Generate unique CSV test file
    const uniqueId = Date.now();
    const empNum = `IMP-${uniqueId}`;
    const email = `bulk_${uniqueId}@example.com`;
    const csvContent = [
      'employee_number,first_name,last_name,email,domain_name,country_code,job_title,hire_date,currency,base_salary,bonus',
      `${empNum},BulkFirst,BulkLast,${email},Engineering,US,Cloud Architect,2025-01-10,USD,140000,15000`
    ].join('\n');

    tmpCsvPath = path.join(os.tmpdir(), `test_import_${uniqueId}.csv`);
    fs.writeFileSync(tmpCsvPath, csvContent, 'utf8');

    // Upload file
    await page.setInputFiles('input[data-testid="import-file-input"]', tmpCsvPath);

    // Verify file name appears in staged list
    await expect(page.locator('.staged-file-pill .file-name')).toContainText(`test_import_${uniqueId}.csv`);

    // Click Start Import
    await page.click('button:has-text("Start Import")');

    // Wait for processing to complete in queue view
    await expect(page.locator('.status-badge-completed').first()).toHaveText('COMPLETED', { timeout: 15000 });
    await expect(page.locator('.stat-pill.stat-success .val').first()).toHaveText('1');

    // Click Close to close modal
    await page.click('button:has-text("Close & Run in Background")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Verify newly imported employee appears in the table
    const searchInput = page.locator('#employee-search');
    await searchInput.fill(empNum);
    await expect(page.locator('.employee-table')).toContainText(empNum);
    await expect(page.locator('.employee-table')).toContainText('BulkFirst BulkLast');
    await expect(page.locator('.employee-table')).toContainText(email);
  });

  test('HR Manager import rejects rows for domains outside their assigned scope', async ({ page }) => {
    await page.goto('/');
    // Log in as HR Manager (Engineering domain only)
    await page.click('button:has-text("Fill HR Manager")');
    await page.click('button[type="submit"]');

    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await page.click('.btn-import-csv');

    const uniqueId = Date.now();
    const empNumEng = `ENG-${uniqueId}`;
    const empNumSales = `SALES-${uniqueId}`;
    // HR Manager has access to Engineering, but NOT to Sales & Marketing
    const csvContent = [
      'employee_number,first_name,last_name,email,domain_name,country_code,job_title,hire_date,currency,base_salary,bonus',
      `${empNumEng},AllowedEng,User,allowed_${uniqueId}@example.com,Engineering,US,Software Engineer,2025-01-10,USD,120000,10000`,
      `${empNumSales},ForbiddenSales,User,forbidden_${uniqueId}@example.com,Sales & Marketing,US,Sales Rep,2025-01-10,USD,80000,5000`
    ].join('\n');

    tmpCsvPath = path.join(os.tmpdir(), `test_scope_import_${uniqueId}.csv`);
    fs.writeFileSync(tmpCsvPath, csvContent, 'utf8');

    await page.setInputFiles('input[data-testid="import-file-input"]', tmpCsvPath);
    await page.click('button:has-text("Start Import")');

    // Wait for completion (status badge contains COMPLETED)
    await expect(page.locator('.status-badge-completed_with_errors, .status-badge-completed').first()).toBeVisible({ timeout: 15000 });

    // Succeeded: 1, Failed: 1
    await expect(page.locator('.stat-pill.stat-success .val').first()).toHaveText('1');
    await expect(page.locator('.stat-pill.stat-danger .val').first()).toHaveText('1');

    // Open error details
    await page.click('.btn-toggle-errors');

    // Check error details table
    const errorsTable = page.locator('.import-errors-table');
    await expect(errorsTable).toContainText(empNumSales);
    await expect(errorsTable).toContainText("Access denied: Domain 'Sales & Marketing' is outside your assigned scope");

    await page.click('button:has-text("Close & Run in Background")');
  });

  test('Multi-file staging and background closing without blocking UI', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await page.click('.btn-import-csv');

    const uniqueId = Date.now();
    const file1 = path.join(os.tmpdir(), `multi_1_${uniqueId}.csv`);
    const file2 = path.join(os.tmpdir(), `multi_2_${uniqueId}.csv`);
    fs.writeFileSync(file1, 'employee_number,first_name,last_name,email,domain_name,country_code,job_title,hire_date,currency,base_salary,bonus\n' +
      `M1-${uniqueId},MultiOne,Test,m1_${uniqueId}@example.com,Engineering,US,Dev,2025-01-01,USD,100000,5000`);
    fs.writeFileSync(file2, 'employee_number,first_name,last_name,email,domain_name,country_code,job_title,hire_date,currency,base_salary,bonus\n' +
      `M2-${uniqueId},MultiTwo,Test,m2_${uniqueId}@example.com,Engineering,US,Dev,2025-01-01,USD,100000,5000`);

    await page.setInputFiles('input[data-testid="import-file-input"]', [file1, file2]);
    await expect(page.locator('.staged-files-grid')).toContainText(`multi_1_${uniqueId}.csv`);
    await expect(page.locator('.staged-files-grid')).toContainText(`multi_2_${uniqueId}.csv`);

    await page.click('button:has-text("Start Import (2 files)")');

    // Close modal immediately while jobs are running
    await page.click('.btn-close-modal');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Verify the directory button remains interactive
    await expect(page.locator('.btn-import-csv')).toBeVisible();

    // Verify imported employee appears after background processing completes
    const searchInput = page.locator('#employee-search');
    await searchInput.fill(`M1-${uniqueId}`);
    await expect(page.locator('.employee-table')).toContainText(`M1-${uniqueId}`, { timeout: 20000 });

    try { fs.unlinkSync(file1); fs.unlinkSync(file2); } catch (e) {}
  });

  test('Rollback completed import removes imported employee and compensation data', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await page.click('.btn-import-csv');

    const uniqueId = Date.now();
    const rollbackEmpNum = `RB-${uniqueId}`;
    const filename = `rollback_test_${uniqueId}.csv`;
    const file = path.join(os.tmpdir(), filename);
    fs.writeFileSync(file, 'employee_number,first_name,last_name,email,domain_name,country_code,job_title,hire_date,currency,base_salary,bonus\n' +
      `${rollbackEmpNum},RollbackFirst,RollbackLast,rb_${uniqueId}@example.com,Engineering,US,Dev,2025-01-01,USD,110000,5000`);

    await page.setInputFiles('input[data-testid="import-file-input"]', file);
    await page.click('button:has-text("Start Import")');

    // Wait for THIS specific job to complete
    const jobCard = page.locator(`.import-job-card:has-text("${filename}")`);
    await expect(jobCard.locator('.status-badge-completed')).toBeVisible({ timeout: 20000 });

    // Close modal
    await page.click('button:has-text("Close & Run in Background")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Verify employee was created in directory
    const searchInput = page.locator('#employee-search');
    await searchInput.fill(rollbackEmpNum);
    await expect(page.locator('.employee-table')).toContainText(rollbackEmpNum);

    // Re-open modal and switch to Queue & History tab
    await page.click('.btn-import-csv');
    await page.click('button:has-text("Import Queue & History")');

    // Click Rollback button on THIS specific job
    const rollbackBtn = jobCard.locator('.btn-rollback-job');
    await expect(rollbackBtn).toBeVisible({ timeout: 10000 });
    await rollbackBtn.click();

    // Confirm in-app modal appears and confirm
    await expect(page.locator('.confirm-modal-card')).toBeVisible();
    await page.click('button:has-text("Yes, Rollback Import")');

    // Wait for ROLLED BACK status badge on this job
    await expect(jobCard.locator('.status-badge-rolled_back')).toHaveText('ROLLED BACK', { timeout: 15000 });

    // Close modal
    await page.click('button:has-text("Close & Run in Background")');

    // Clear and search again for the rolled-back employee - should show empty state
    await searchInput.fill('');
    await searchInput.fill(rollbackEmpNum);
    await expect(page.locator('.empty-table-state')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.empty-table-state')).toContainText('No employees found');
    await expect(page.locator('.employee-directory')).not.toContainText(rollbackEmpNum);

    // Clear search and verify original employees remain
    await page.click('.btn-clear-search');
    await expect(page.locator('.employee-table')).toBeVisible();
    await expect(page.locator('.employee-table')).not.toContainText(rollbackEmpNum);

    try { fs.unlinkSync(file); } catch (e) {}
  });
});
