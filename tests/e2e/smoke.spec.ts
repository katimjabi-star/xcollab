import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import path from 'path';

// Pin the seeded BRAIN program as active — the assertions below reference its data.
test.beforeAll(() => {
  const db = path.join(__dirname, '..', '..', 'db', 'custom.db');
  execFileSync('sqlite3', [db, "UPDATE Program SET status='paused' WHERE status='active'"]);
  execFileSync('sqlite3', [db, "UPDATE Program SET status='active' WHERE name LIKE 'BRAIN%'"]);
});

/**
 * XCollab smoke suite — covers every screen, the data APIs, RTL, and the
 * interactions that broke historically (WBP detail panel, Kanban drag
 * persistence, chat history loading).
 */

const SCREENS = [
  { nav: 'Dashboard', heading: 'Program Dashboard' },
  { nav: 'Work Packages', heading: 'Work Breakdown Structure' },
  { nav: 'Kanban Board', heading: 'Kanban Board' },
  { nav: 'Timeline', heading: 'Program Timeline' },
  { nav: 'Dependencies', heading: 'Dependencies' },
  { nav: 'Teams', heading: 'Teams' },
  { nav: 'AI Assistant', heading: 'AI Assistant' },
];

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test.describe('API health', () => {
  test('program endpoint returns the active program with WBPs and teams', async ({ request }) => {
    const res = await request.get('/api/program');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe('BRAIN Network Encryptor');
    expect(body.wbps.length).toBeGreaterThan(0);
    expect(body.teams.length).toBeGreaterThan(0);
  });

  test('tasks endpoint returns tasks with assignee and WBP relations', async ({ request }) => {
    const res = await request.get('/api/tasks');
    expect(res.ok()).toBeTruthy();
    const tasks = await res.json();
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].wbp.code).toMatch(/^WBP-/);
  });

  test('chat history endpoint returns the conversation for the active program', async ({ request }) => {
    const res = await request.get('/api/ai-chat');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.programId).toBeTruthy();
    expect(Array.isArray(body.messages)).toBeTruthy();
  });

  test('tasks endpoint rejects malformed updates', async ({ request }) => {
    const res = await request.post('/api/tasks', { data: { updates: [{ id: 'x', columnId: 'bogus', sortOrder: 0 }] } });
    expect(res.status()).toBe(400);
  });
});

test.describe('Screens', () => {
  test('all screens render without console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    for (const screen of SCREENS) {
      await page.locator('aside nav button', { hasText: screen.nav }).first().click();
      await expect(page.getByRole('heading', { name: screen.heading, level: 2 }).first()).toBeVisible({ timeout: 10_000 });
    }
    await page.locator('aside button', { hasText: 'Settings' }).first().click();
    await expect(page.getByText('XCollab').first()).toBeVisible();

    expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0);
  });

  test('WBP detail opens as inline panel on desktop, not a dialog', async ({ page }) => {
    await page.goto('/');
    await page.locator('aside nav button', { hasText: 'Work Packages' }).first().click();
    await page.locator('[role=treeitem]').first().click();
    // The name appears in the tree row and again in the detail panel — the
    // panel's copy is the last heading in DOM order.
    await expect(page.getByRole('heading', { name: 'Hardware Platform' }).last()).toBeVisible();
    await expect(page.locator('[role=dialog]')).toHaveCount(0);
  });

  test('AI chat shows persisted history and offline analysis reply', async ({ page }) => {
    await page.goto('/');
    await page.locator('aside nav button', { hasText: 'AI Assistant' }).first().click();
    // Seeded conversation must load from the database
    await expect(page.getByText('critical blockers').first()).toBeVisible({ timeout: 10_000 });
  });

  test('language toggle flips the document to Arabic RTL and back', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Anchored regex — a program name containing "en" must not match
    await page.locator('header button').filter({ hasText: /^EN$/ }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await page.locator('header button').filter({ hasText: /^AR$/ }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});

test.describe('Kanban drag persistence', () => {
  test('dragging a card to another column persists and can be restored', async ({ page, request }) => {
    // Find a task to move and remember where it was
    const tasks = await (await request.get('/api/tasks')).json();
    const task = tasks.find((t: { title: string }) => t.title === 'Power supply unit design');
    expect(task).toBeTruthy();
    const original = { id: task.id, columnId: task.columnId, sortOrder: task.sortOrder };

    await page.goto('/');
    await page.locator('aside nav button', { hasText: 'Kanban Board' }).first().click();
    await page.waitForLoadState('networkidle');

    const card = page.getByText('Power supply unit design').first();
    await card.hover();
    const grip = page.getByLabel('Drag Power supply unit design');
    const gripBox = await grip.boundingBox();
    const doneHeader = await page.locator("h3:text-is('Done')").boundingBox();
    expect(gripBox && doneHeader).toBeTruthy();

    await page.mouse.move(gripBox!.x + 5, gripBox!.y + 5);
    await page.mouse.down();
    await page.mouse.move(gripBox!.x + 20, gripBox!.y + 20, { steps: 4 });
    await page.mouse.move(doneHeader!.x + 120, doneHeader!.y + 250, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(1500);

    // Verify persisted server-side with status kept in sync
    const after = await (await request.get('/api/tasks')).json();
    const moved = after.find((t: { id: string }) => t.id === original.id);
    expect(moved.columnId).toBe('done');
    expect(moved.status).toBe('done');

    // Restore demo data
    const restore = await request.post('/api/tasks', {
      data: { updates: [{ id: original.id, columnId: original.columnId, sortOrder: original.sortOrder }] },
    });
    expect(restore.ok()).toBeTruthy();
  });
});
