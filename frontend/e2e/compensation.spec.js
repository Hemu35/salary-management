import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Compensation Management E2E Browser Automation', () => {
  test.beforeAll(() => {
    execSync('docker compose exec -T backend bundle exec rails db:seed', { stdio: 'inherit' });
  });

  test('Opens Compensation modal for an employee and displays current active package and components', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory table
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Alice Walker', { timeout: 10000 });

    // Click Compensation button on Alice Walker's row
    const aliceRow = page.locator('tr:has-text("Alice Walker")');
    await expect(aliceRow).toBeVisible();
    await aliceRow.locator('button:has-text("Compensation")').click();

    // Verify Compensation modal opened
    const compModal = page.locator('.modal-overlay[role="dialog"]');
    await expect(compModal).toBeVisible();
    await expect(compModal.locator('#modal-compensation-title')).toContainText('Alice Walker');
    await expect(compModal).toContainText('Active Package');
    await expect(compModal).toContainText('USD');
    await expect(compModal).toContainText('$190,000.00');
    await expect(compModal).toContainText('$165,000.00');
    await expect(compModal).toContainText('Base Salary');
    await expect(compModal).toContainText('Performance Bonus');

    // Close modal
    await compModal.locator('button:has-text("Close")').click();
    await expect(compModal).not.toBeVisible();
  });

  test('Adjusts compensation package with new components and supersedes previous active package', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory table
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    await expect(page.locator('.employee-table')).toContainText('Bob Martin', { timeout: 10000 });

    // Open Bob Martin's compensation modal
    const bobRow = page.locator('tr:has-text("Bob Martin")');
    await expect(bobRow).toBeVisible();
    await bobRow.locator('button:has-text("Compensation")').click();

    const compModal = page.locator('.modal-overlay[role="dialog"]');
    await expect(compModal).toBeVisible();
    await expect(compModal.locator('#modal-compensation-title')).toContainText('Bob Martin');
    await expect(compModal).toContainText('GBP');
    await expect(compModal).toContainText('£105,000.00');

    // Click "+ Adjust Compensation"
    await compModal.locator('button:has-text("Adjust Compensation")').click();

    // Verify Adjust Modal is open
    const adjustModal = page.locator('.modal-overlay[role="dialog"]:has(#modal-adjust-title)');
    await expect(adjustModal).toBeVisible();
    await expect(adjustModal.locator('#modal-adjust-title')).toHaveText('Adjust Compensation Package');

    // Fill form with unique future date to prevent duplicate date collision across runs
    const futureDate = new Date(Date.now() + 86400000 * (Math.floor(Math.random() * 500) + 30)).toISOString().split('T')[0];
    await adjustModal.locator('#adjust-effective-date').fill(futureDate);
    await adjustModal.locator('#adjust-currency').selectOption('GBP');
    await adjustModal.locator('#adjust-notes').fill('Promoted to Principal Architect - merit bump');

    // Set base salary amount to 120,000
    const firstAmount = adjustModal.locator('input[aria-label="Component Amount"]').first();
    await firstAmount.fill('120000');

    // Update bonus component to 15,000
    const secondRow = adjustModal.locator('[data-testid="comp-row-1"]');
    await expect(secondRow).toBeVisible();
    await secondRow.locator('input[aria-label="Component Amount"]').fill('15000');

    // Verify live annualized preview
    await expect(adjustModal).toContainText('GBP 135,000.00');

    // Save package
    await adjustModal.locator('button[type="submit"]:has-text("Save Compensation Package")').click();

    // Verify adjust modal closes
    await expect(adjustModal).not.toBeVisible({ timeout: 10000 });

    // Verify new active package is rendered in parent modal
    await expect(compModal).toContainText('£135,000.00', { timeout: 10000 });
    await expect(compModal).toContainText('£120,000.00');
    await expect(compModal).toContainText('Promoted to Principal Architect - merit bump');

    // Verify previous package is moved to revision history and marked superseded
    const historyItem = compModal.locator('[data-testid^="history-record-"]').first();
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toContainText('superseded');
    await expect(compModal).toContainText('£105,000.00');

    // Close modal
    await compModal.locator('button:has-text("Close")').click();
    await expect(compModal).not.toBeVisible();
  });

  test('Edits current compensation package in-place and adds an annual component', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for directory table
    await expect(page.locator('.directory-titles h3')).toHaveText('Employee Directory');
    const carolRow = page.locator('tr:has-text("Carol Danvers")');
    await expect(carolRow).toBeVisible();
    await carolRow.locator('button:has-text("Compensation")').click();

    // Verify modal is open
    const compModal = page.locator('.modal-overlay[role="dialog"]');
    await expect(compModal).toBeVisible();
    await expect(compModal.locator('#modal-compensation-title')).toContainText('Carol Danvers');

    // Click "Edit Current Package"
    await compModal.locator('button:has-text("Edit Current Package")').click();

    const editModal = page.locator('.modal-overlay[role="dialog"]:has(#modal-adjust-title)');
    await expect(editModal).toBeVisible();
    await expect(editModal.locator('#modal-adjust-title')).toHaveText('Edit Compensation Package');

    // Verify existing components are pre-populated (Base salary $140,000 + Commission $40,000)
    const amountInputs = editModal.locator('input[aria-label="Component Amount"]');
    await expect(amountInputs).toHaveCount(2);

    // Add an annual allowance component ($12,000)
    await editModal.locator('button:has-text("+ Add Component")').click();
    const thirdRow = editModal.locator('[data-testid="comp-row-2"]');
    await expect(thirdRow).toBeVisible();
    await thirdRow.locator('select[aria-label="Component Type"]').selectOption('allowance');
    await thirdRow.locator('input[aria-label="Component Amount"]').fill('12000');

    // Verify live preview includes the new annual component ($140k + $40k + $12k = $192k)
    await expect(editModal).toContainText('USD 192,000.00');

    // Submit in-place update
    await editModal.locator('button[type="submit"]:has-text("Update Compensation Package")').click();

    // Verify edit modal closes
    await expect(editModal).not.toBeVisible({ timeout: 10000 });

    // Verify updated package in compensation view
    await expect(compModal).toContainText('$192,000.00', { timeout: 10000 });
    await expect(compModal).toContainText('Allowance');
    await expect(compModal).toContainText('$12,000.00');

    // Close modal
    await compModal.locator('button:has-text("Close")').click();
    await expect(compModal).not.toBeVisible();
  });
});
