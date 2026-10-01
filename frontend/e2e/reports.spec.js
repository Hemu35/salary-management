import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Workforce & Compensation Insights E2E Browser Automation', () => {
  test.beforeAll(() => {
    try {
      execSync('docker compose exec -T db psql -U postgres -d compensation_dev -c "DELETE FROM employees WHERE id > 4;"', { stdio: 'ignore' });
      execSync('docker compose exec -T backend bundle exec rails db:seed', { stdio: 'ignore', timeout: 30000 });
    } catch (e) {
      console.warn('Note: db:seed beforeAll skipped in test environment:', e.message);
    }
  });

  test('Org Admin navigates to Insights & Analytics and inspects global workforce and currency-segregated compensation', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Wait for main dashboard
    await expect(page.locator('.welcome-header h2')).toContainText('admin@example.com');

    // Switch to Insights & Analytics tab
    const insightsTab = page.locator('button[role="tab"]:has-text("Insights & Analytics")');
    await expect(insightsTab).toBeVisible();
    await insightsTab.click();

    // Verify Reports Dashboard renders
    await expect(page.locator('.reports-dashboard')).toBeVisible();
    await expect(page.locator('.reports-titles h3')).toHaveText('Workforce & Compensation Insights');

    // Verify Top KPI cards
    await expect(page.locator('[data-testid="kpi-headcount"]')).toContainText('4');
    await expect(page.locator('[data-testid="kpi-countries"]')).toContainText('3');
    await expect(page.locator('[data-testid="kpi-domains"]')).toContainText('2');

    // Verify Workforce Distribution cards
    const countryCard = page.locator('[data-testid="card-by-country"]');
    await expect(countryCard).toContainText('United States');
    await expect(countryCard).toContainText('United Kingdom');

    const domainCard = page.locator('[data-testid="card-by-domain"]');
    await expect(domainCard).toContainText('Engineering');
    await expect(domainCard).toContainText('Sales & Marketing');

    // Verify Currency Isolated Compensation Insights
    await expect(page.locator('.currency-safety-tag')).toHaveText('🛡️ Currency Isolated');

    // Check Currency Tabs
    const usdTab = page.locator('.currency-tab-btn:has-text("USD")');
    await expect(usdTab).toBeVisible();
    await usdTab.click();

    // Verify USD details panel
    const usdPanel = page.locator('[data-testid="comp-details-USD"]');
    await expect(usdPanel).toBeVisible();
    await expect(usdPanel.locator('.financial-card')).toHaveCount(4);

    // Verify component allocation for USD
    await expect(usdPanel.locator('.component-bars-list')).toContainText('Base Salary');
    await expect(usdPanel.locator('.component-bars-list')).toContainText('Bonus');

    // Verify Departmental Payroll Spend table
    await expect(usdPanel.locator('.mini-data-table')).toContainText('Engineering');

    // Switch back to Employee Directory tab
    const directoryTab = page.locator('button[role="tab"]:has-text("Employee Directory")');
    await directoryTab.click();
    await expect(page.locator('.employee-table')).toBeVisible();
  });

  test('Navbar domain scope dynamically filters analytics dashboard', async ({ page }) => {
    await page.goto('/');

    // Log in as Org Admin
    await page.click('button:has-text("Fill Org Admin")');
    await page.click('button[type="submit"]');

    // Switch to Insights & Analytics
    await page.click('button[role="tab"]:has-text("Insights & Analytics")');
    await expect(page.locator('.reports-dashboard')).toBeVisible();

    // Filter Navbar to Engineering domain
    await page.selectOption('#domain-select', { label: 'Engineering' });
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: Engineering');

    // Headcount should reflect Engineering only (2 seeded engineering employees)
    await expect(page.locator('[data-testid="kpi-headcount"] .kpi-number')).toHaveText('2');
    await expect(page.locator('[data-testid="card-by-domain"]')).toContainText('Engineering');
    await expect(page.locator('[data-testid="card-by-domain"]')).not.toContainText('Sales & Marketing');
  });

  test('HR Manager sees only assigned domain metrics in analytics', async ({ page }) => {
    await page.goto('/');

    // Log in as HR Manager (assigned to Engineering)
    await page.click('button:has-text("Fill HR Manager")');
    await page.click('button[type="submit"]');

    // Switch to Insights & Analytics
    await page.click('button[role="tab"]:has-text("Insights & Analytics")');
    await expect(page.locator('.reports-dashboard')).toBeVisible();

    // HR Manager is locked to Engineering
    await expect(page.locator('.directory-scope-tag')).toHaveText('Scope: Engineering');
    await expect(page.locator('[data-testid="kpi-headcount"] .kpi-number')).toHaveText('2');
    await expect(page.locator('[data-testid="card-by-domain"]')).toContainText('Engineering');
    await expect(page.locator('[data-testid="card-by-domain"]')).not.toContainText('Sales & Marketing');
  });
});
