import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { execSync } from 'child_process';

test.describe('Bulk CSV Export E2E Browser Automation', () => {
  test.beforeAll(() => {
    try {
      execSync('docker compose exec -T db psql -U postgres -d compensation_dev -c "DELETE FROM employees WHERE id > 4;"', { stdio: 'ignore' });
      execSync('docker compose exec -T backend bundle exec rails db:seed', { stdio: 'ignore', timeout: 30000 });
    } catch (e) {
      console.warn('Note: db:seed beforeAll skipped in test environment:', e.message);
    }
  });

  test('Org Admin triggers full employee export and downloads CSV', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for Employee Directory
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toBeVisible();

    // Click Export CSV button
    const exportBtn = page.locator('button:has-text("Export CSV")');
    await expect(exportBtn).toBeVisible();

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    await exportBtn.click();

    // Verify floating notification toast appears
    const toast = page.locator('.export-notification-toast');
    await expect(toast).toBeVisible();

    // Wait for download to complete
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/employees_export_\d+_\d+\.csv/);

    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf8');

    // Verify CSV headers and content
    expect(content).toContain('employee_number');
    expect(content).toContain('domain_name');
    expect(content).toContain('total_annualized_compensation');
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');

    // Dismiss toast
    await toast.locator('.btn-close-toast').click();
    await expect(toast).not.toBeVisible();
  });

  test('Export respects active domain scope and filters', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');

    // Switch to Engineering domain
    await page.selectOption('#domain-select', { label: 'Engineering' });
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: Engineering');

    // Search for Alice
    const searchInput = page.locator('#employee-search');
    await searchInput.fill('Alice');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Trigger Export
    await page.click('button:has-text("Export CSV")');

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf8');

    // Should contain Alice Walker
    expect(content).toContain('Alice');
    expect(content).toContain('Walker');
    // Should NOT contain David or Carol (Sales)
    expect(content).not.toContain('Carol');
    expect(content).not.toContain('David');
  });

  test('HR Manager exports only employees within assigned domain', async ({ page }) => {
    await page.goto('/');

    // Log in as HR Manager (Engineering domain only)
    await page.click('button:has-text("Fill HR Manager")');
    await page.click('button[type="submit"]');

    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Trigger Export
    await page.click('button:has-text("Export CSV")');

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf8');

    // Engineering employees should be in the export
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');

    // Sales & Marketing employees and domain should NOT be present
    expect(content).not.toContain('Sales & Marketing');
    expect(content).not.toContain('carol.danvers@example.com');
    expect(content).not.toContain('david.miller@example.com');
  });

  test('User selects specific employees and exports only selected records to CSV', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toBeVisible();

    // Verify selection action bar is not visible initially
    await expect(page.locator('.selection-action-bar')).not.toBeVisible();

    // Select Alice Walker and Bob Martin using their row checkboxes
    const aliceCheckbox = page.locator('tr:has-text("Alice Walker") input.select-checkbox');
    const bobCheckbox = page.locator('tr:has-text("Bob Martin") input.select-checkbox');

    await aliceCheckbox.check();
    await expect(page.locator('.selection-action-bar')).toBeVisible();
    await expect(page.locator('.selection-count')).toContainText('1 employee selected');

    await bobCheckbox.check();
    await expect(page.locator('.selection-count')).toContainText('2 employees selected');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click Export Selected (2)
    const exportSelectedBtn = page.locator('button.btn-export-selected');
    await expect(exportSelectedBtn).toHaveText('📤 Export Selected (2)');
    await exportSelectedBtn.click();

    // Verify floating notification toast appears
    const toast = page.locator('.export-notification-toast');
    await expect(toast).toBeVisible();

    // Wait for download to complete
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/employees_export_selected_2_\d+_\d+\.csv/);

    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf8');

    // Selected employees must be present
    expect(content).toContain('Alice');
    expect(content).toContain('Walker');
    expect(content).toContain('Bob');
    expect(content).toContain('Martin');

    // Unselected seeded employees (Carol Danvers, David Miller) must NOT be present
    expect(content).not.toContain('Carol');
    expect(content).not.toContain('Danvers');
    expect(content).not.toContain('David');
    expect(content).not.toContain('Miller');

    // Dismiss toast
    await toast.locator('.btn-close-toast').click();
    await expect(toast).not.toBeVisible();

    // Clear selection
    await page.click('button.btn-clear-selection');
    await expect(page.locator('.selection-action-bar')).not.toBeVisible();
  });
});
