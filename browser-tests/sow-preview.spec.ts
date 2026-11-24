import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const expectedPreviewHeaders = [
  'Wk',
  'Lsn',
  'Strand',
  'Sub-Strand',
  'Learning Outcomes',
  'Learning Experiences',
  'Key Inquiry Questions',
  'Learning Resources',
  'Assessment',
  'Remarks',
  'Actions',
];

test('mounted ContentDisplay renders the real SOW table, preserves rows, scrolls, and dispatches lesson actions', async ({ page }) => {
  const componentSource = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ContentDisplay.tsx'),
    'utf8'
  );
  expect(componentSource).toContain('overflow-x-auto my-8');
  expect(componentSource).toContain('min-w-[1600px] w-full');
  expect(componentSource).toContain('sticky top-0');

  await page.goto('/browser-tests/fixtures/sow-content-display.html');

  const table = page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Learning Outcomes' }) });
  await expect(table).toBeVisible();

  const headers = await table.locator('thead th').allTextContents();
  expect(headers.map(header => header.trim())).toEqual(expectedPreviewHeaders);

  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Describe theories of human origin.');
  await expect(rows.nth(1)).toContainText('Explain stages of human evolution.');
  await expect(rows.nth(1).locator('td').nth(9)).toContainText('FINAL RIGHTMOST COLUMN SENTINEL');

  const container = table.locator('xpath=..');
  const before = await container.evaluate(el => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    scrollLeft: el.scrollLeft,
  }));
  expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);

  await container.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  const after = await container.evaluate(el => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    scrollLeft: el.scrollLeft,
  }));
  expect(after.scrollLeft).toBeGreaterThan(0);
  expect(after.scrollLeft + after.clientWidth).toBeGreaterThanOrEqual(after.scrollWidth - 1);
  await expect(rows.nth(1).locator('td').nth(9)).toBeVisible();

  await rows.nth(0).getByRole('button', { name: /Plan/ }).click();
  await rows.nth(1).getByRole('button', { name: /Assessment/ }).click();
  const actionCalls = await page.evaluate(() => (window as any).__sowActionCalls);
  expect(actionCalls).toEqual([
    { type: 'resource', week: '2', lesson: '1' },
    { type: 'assessment', week: '2', lesson: '2' },
  ]);
});
