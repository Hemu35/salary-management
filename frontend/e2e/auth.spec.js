import { test, expect } from '@playwright/test';

test.describe('Authentication & Tenant Context E2E Browser Automation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local frontend app
    await page.goto('/');
  });

  test('HR Manager can log in and sign out in a real browser session', async ({ page }) => {
    // Check initial login card is visible
    await expect(page.locator('.login-badge')).toHaveText('Multi-Tenant SaaS');
    await expect(page.locator('h1')).toHaveText('Employee Compensation');

    // Type credentials
    await page.fill('#email', 'hr@example.com');
    await page.fill('#password', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify authenticated Navbar renders tenant name and role
    await expect(page.locator('.brand-tenant')).toHaveText('Acme Corporation');
    await expect(page.locator('.user-email')).toHaveText('hr@example.com');
    await expect(page.locator('.role-badge')).toHaveText('HR Manager');

    // Verify dashboard welcome message
    await expect(page.locator('.welcome-header h2')).toContainText('Welcome back, hr@example.com');
    await expect(page.locator('.status-active').first()).toBeVisible();

    // Sign out
    await page.click('.btn-logout');

    // Verify returned to login view
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Sign in');
  });

  test('Organization Admin can log in and view administrative status', async ({ page }) => {
    // Use demo quick-fill button
    await page.click('button:has-text("Fill Org Admin")');

    // Verify inputs populated
    await expect(page.locator('#email')).toHaveValue('admin@example.com');
    await expect(page.locator('#password')).toHaveValue('password123');

    // Sign in
    await page.click('button[type="submit"]');

    // Verify Org Admin badge
    await expect(page.locator('.role-badge')).toHaveText('Org Admin');
    await expect(page.locator('.user-email')).toHaveText('admin@example.com');
    await expect(page.locator('.status-value').first()).toHaveText('Organization Administrator');
  });

  test('Rejects invalid credentials with error banner', async ({ page }) => {
    await page.fill('#email', 'hr@example.com');
    await page.fill('#password', 'incorrectpassword');
    await page.click('button[type="submit"]');

    // Verify error banner appears
    const errorBanner = page.locator('.error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Invalid email or password');

    // Verify user remains unauthenticated
    await expect(page.locator('.navbar')).not.toBeVisible();
  });

  test('Maintains session persistence across browser page reloads (F5)', async ({ page }) => {
    // Log in
    await page.fill('#email', 'hr@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Verify authenticated
    await expect(page.locator('.brand-tenant')).toHaveText('Acme Corporation');

    // Reload the page
    await page.reload();

    // Verify user is still authenticated without logging in again
    await expect(page.locator('.brand-tenant')).toHaveText('Acme Corporation');
    await expect(page.locator('.user-email')).toHaveText('hr@example.com');
    await expect(page.locator('.role-badge')).toHaveText('HR Manager');
  });

  test('Submits form successfully when pressing Enter key in password field', async ({ page }) => {
    await page.fill('#email', 'hr@example.com');
    await page.fill('#password', 'password123');

    // Hit Enter inside password field
    await page.press('#password', 'Enter');

    // Verify authenticated
    await expect(page.locator('.brand-tenant')).toHaveText('Acme Corporation');
    await expect(page.locator('.user-email')).toHaveText('hr@example.com');
  });

  test('Validates password input masking for security', async ({ page }) => {
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Disables submit button when email or password is empty', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Only email filled
    await page.fill('#email', 'hr@example.com');
    await expect(submitBtn).toBeDisabled();

    // Password filled too
    await page.fill('#password', 'password123');
    await expect(submitBtn).toBeEnabled();

    // Clear password
    await page.fill('#password', '');
    await expect(submitBtn).toBeDisabled();
  });

  test('Organization Admin can switch domain scope between All Domains and specific domains', async ({ page }) => {
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Verify initial global scope
    const domainSelect = page.locator('#domain-select');
    await expect(domainSelect).toBeVisible();
    await expect(domainSelect).toBeEnabled();
    await expect(domainSelect).toHaveValue('all');
    await expect(page.locator('.domain-scope-display')).toHaveText('All Domains (Global)');

    // Switch to Engineering
    await domainSelect.selectOption('1');
    await expect(domainSelect).toHaveValue('1');
    await expect(page.locator('.domain-scope-display')).toHaveText('Engineering');

    // Switch to Sales & Marketing
    await domainSelect.selectOption('2');
    await expect(domainSelect).toHaveValue('2');
    await expect(page.locator('.domain-scope-display')).toHaveText('Sales & Marketing');

    // Switch back to All Domains
    await domainSelect.selectOption('all');
    await expect(domainSelect).toHaveValue('all');
    await expect(page.locator('.domain-scope-display')).toHaveText('All Domains (Global)');
  });

  test('HR Manager domain scope is locked and restricted to assigned domain', async ({ page }) => {
    await page.click('button:has-text("Fill HR Manager")');
    await page.click('button[type="submit"]');

    // Verify domain select is disabled and locked to Engineering
    const domainSelect = page.locator('#domain-select');
    await expect(domainSelect).toBeVisible();
    await expect(domainSelect).toBeDisabled();
    await expect(domainSelect).toHaveValue('1');

    // Verify restricted badge and dashboard display
    await expect(page.locator('.domain-restricted-badge')).toHaveText('Restricted');
    await expect(page.locator('.domain-scope-display')).toHaveText('Engineering');
  });
});
