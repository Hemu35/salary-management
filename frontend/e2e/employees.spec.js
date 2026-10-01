import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Employee Directory E2E Browser Automation', () => {
  test.beforeAll(() => {
    try {
      execSync('docker compose exec -T db psql -U postgres -d compensation_dev -c "DELETE FROM employees WHERE tenant_id IN (SELECT id FROM tenants WHERE name = \'Acme Corporation\') AND employee_number NOT IN (\'EMP0001\', \'EMP0002\', \'EMP0003\', \'EMP0004\');"', { stdio: 'ignore' });
      execSync('docker compose exec -T backend bundle exec rails db:seed', { stdio: 'ignore', timeout: 30000 });
    } catch (e) {
      console.warn('Note: db:seed beforeAll skipped in test environment:', e.message);
    }
  });
  test('Organization Admin sees all seeded employees across departments', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Verify Employee Directory header
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: All Domains');

    // Verify seeded employees appear in the table
    const table = page.locator('.employee-table');
    await expect(table).toContainText('Alice Walker');
    await expect(table).toContainText('Bob Martin');
    await expect(table).toContainText('Carol Danvers');
    await expect(table).toContainText('David Miller');

    // Verify badges and counts
    await expect(page.locator('.pagination-info')).toContainText('employees');
  });

  test('Searches employees by name, email, or employee number', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory to be loaded
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');

    const searchInput = page.locator('#employee-search');

    // Search for "Alice"
    await searchInput.fill('Alice');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');
    await expect(page.locator('.employee-table')).not.toContainText('Bob Martin');
    await expect(page.locator('.employee-table')).not.toContainText('Carol Danvers');

    // Search by employee number "EMP0003"
    await searchInput.fill('EMP0003');
    await expect(page.locator('.employee-table')).toContainText('Carol Danvers');
    await expect(page.locator('.employee-table')).not.toContainText('Alice Walker');

    // Clear search
    await page.click('.btn-clear-search');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');
    await expect(page.locator('.employee-table')).toContainText('Bob Martin');
  });

  test('Filters employees by employment status dropdown', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory to be loaded
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');

    const statusFilter = page.locator('#filter-status');

    // Filter by "On Leave" (David Miller)
    await statusFilter.selectOption('on_leave');
    await expect(page.locator('.employee-table')).toContainText('David Miller');
    await expect(page.locator('.employee-table')).not.toContainText('Alice Walker');
    await expect(page.locator('.status-pill-leave')).toBeVisible();

    // Reset filter
    await statusFilter.selectOption('all');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');
    await expect(page.locator('.employee-table')).toContainText('Bob Martin');
  });

  test('Switches directory domain scope using Navbar domain selector', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory to be loaded
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');

    const domainSelect = page.locator('#domain-select');

    // Filter to Sales & Marketing
    await domainSelect.selectOption({ label: 'Sales & Marketing' });
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: Sales & Marketing');
    await expect(page.locator('.employee-table')).toContainText('Carol Danvers');
    await expect(page.locator('.employee-table')).toContainText('David Miller');
    await expect(page.locator('.employee-table')).not.toContainText('Alice Walker');
    await expect(page.locator('.employee-table')).not.toContainText('Bob Martin');

    // Switch to Engineering
    await domainSelect.selectOption({ label: 'Engineering' });
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: Engineering');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');
    await expect(page.locator('.employee-table')).toContainText('Bob Martin');
    await expect(page.locator('.employee-table')).not.toContainText('Carol Danvers');
    await expect(page.locator('.employee-table')).not.toContainText('David Miller');

    // Switch back to All Domains
    await domainSelect.selectOption('all');
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: All Domains');
    await expect(page.locator('.employee-table')).toContainText('Carol Danvers');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');
  });

  test('HR Manager is strictly restricted to assigned domain records', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill HR Manager")');
    await page.click('button[type="submit"]');

    // Verify HR Manager only sees Engineering
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: Engineering');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');
    await expect(page.locator('.employee-table')).toContainText('Bob Martin');
    await expect(page.locator('.employee-table')).not.toContainText('Carol Danvers');
    await expect(page.locator('.employee-table')).not.toContainText('David Miller');
  });

  test('Creates a new employee record via Add Employee modal', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory to be loaded
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');

    // Open modal
    await page.click('button:has-text("+ Add Employee")');
    await expect(page.locator('.modal-card')).toBeVisible();

    // Fill form
    const uniqueNumber = `EMP${Date.now().toString().slice(-4)}`;
    await page.fill('#modal-emp-number', uniqueNumber);
    await page.fill('#modal-first-name', 'Natasha');
    await page.fill('#modal-last-name', 'Romanoff');
    await page.fill('#modal-email', `natasha.${Date.now()}@example.com`);
    await page.fill('#modal-job-title', 'Security Architect');

    // Submit
    await page.click('.modal-card button[type="submit"]');

    // Verify modal closes
    await expect(page.locator('.modal-card')).not.toBeVisible();

    // Verify new employee appears in directory
    await expect(page.locator('.employee-table')).toContainText('Natasha Romanoff');
    await expect(page.locator('.employee-table')).toContainText(uniqueNumber);
  });

  test('Opens Edit Employee modal, updates details, and reflects changes in directory table', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory to be loaded
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker', { timeout: 10000 });

    // Find Bob Martin's edit button and click it
    const bobRow = page.locator('tr:has-text("Bob Martin")');
    await expect(bobRow).toBeVisible();
    await bobRow.locator('button:has-text("Edit")').click();

    // Verify Edit Employee modal is open
    const editModal = page.locator('.modal-overlay[role="dialog"]');
    await expect(editModal).toBeVisible();
    await expect(editModal.locator('#modal-edit-title')).toHaveText('Edit Employee');
    await expect(editModal.locator('#edit-emp-number')).toHaveValue('EMP0002');
    await expect(editModal.locator('#edit-emp-number')).toBeDisabled();
    await expect(editModal.locator('#edit-first-name')).toHaveValue('Bob');
    await expect(editModal.locator('#edit-last-name')).toHaveValue('Martin');

    // Update Job Title
    const newTitle = `Lead Infrastructure Architect ${Date.now().toString().slice(-3)}`;
    await editModal.locator('#edit-job-title').fill(newTitle);

    // Save changes
    await editModal.locator('button[type="submit"]').click();

    // Verify modal closes
    await expect(editModal).not.toBeVisible();

    // Verify updated title is displayed in Bob Martin's table row
    await expect(page.locator('tr:has-text("Bob Martin")')).toContainText(newTitle);
  });
});
