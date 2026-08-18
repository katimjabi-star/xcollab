import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import path from 'path';

/**
 * Collaboration + Architect suite — exercises the real user flows end to end:
 * discussion threads with mention notifications, approval verdicts, task
 * assignment, the live inbox, cross-window real-time sync, and the AI
 * Program Architect. Each test cleans up after itself so the demo database
 * stays pristine.
 */

const DB = path.join(__dirname, '..', '..', 'db', 'custom.db');
// execFileSync with an argument array — no shell, so nothing in the query can inject
const sql = (query: string) => execFileSync('sqlite3', [DB, query]).toString().trim();

// The suite assumes the seeded BRAIN program is active — pin it regardless of
// what a previous run or live demo left behind, and purge debris from any
// earlier run that failed before its own cleanup executed.
const TEST_PROGRAM_NAMES = ['XCollab', 'New Initiative', 'SHAHEEN Tactical Data Link'];
test.beforeAll(() => {
  for (const name of TEST_PROGRAM_NAMES) {
    const ids = sql(`SELECT id FROM Program WHERE name='${name}'`).split('\n').filter(Boolean);
    for (const pid of ids) {
      sql(`DELETE FROM Dependency WHERE fromWbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
      sql(`DELETE FROM Task WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
      sql(`DELETE FROM Risk WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
      sql(`DELETE FROM Milestone WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
      sql(`DELETE FROM WBP WHERE programId='${pid}'`);
      sql(`DELETE FROM AIConversation WHERE programId='${pid}'`);
      sql(`DELETE FROM Team WHERE slug LIKE '%-' || substr('${pid}', -4)`);
      sql(`DELETE FROM Program WHERE id='${pid}'`);
    }
  }
  sql(`UPDATE Program SET status='paused' WHERE status='active'`);
  sql(`UPDATE Program SET status='active' WHERE name LIKE 'BRAIN%'`);
});

async function openWbpPanel(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('aside nav button', { hasText: 'Work Packages' }).first().click();
  await page.locator('[role=treeitem]').first().click();
  // Program-agnostic: the dossier panel always carries the Discussion section
  await expect(page.getByText('Discussion', { exact: false }).last()).toBeVisible();
}

test.describe('Discussion threads', () => {
  test('posting a comment with an @mention notifies the mentioned member', async ({ page }) => {
    const marker = `e2e-${Date.now()}`;
    await openWbpPanel(page);

    const composer = page.getByPlaceholder(/Write a comment/);
    await composer.fill(`@Alice please review the thermal margins ${marker}`);
    await page.getByRole('button', { name: 'Post' }).click();

    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });

    // The mention created a real notification for Alice
    const notif = sql(
      `SELECT COUNT(*) FROM Notification WHERE type='mention' AND body LIKE '%${marker}%'`,
    );
    expect(Number(notif)).toBe(1);

    sql(`DELETE FROM Comment WHERE body LIKE '%${marker}%'`);
    sql(`DELETE FROM Notification WHERE body LIKE '%${marker}%'`);
  });

  test('a comment appears in a second browser window without a refresh', async ({ browser }) => {
    const marker = `live-${Date.now()}`;
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await openWbpPanel(pageA);
    await openWbpPanel(pageB);

    await pageA.getByPlaceholder(/Write a comment/).fill(`Real-time check ${marker}`);
    await pageA.getByRole('button', { name: 'Post' }).click();

    // Window B picks it up via polling — no interaction, no refresh
    await expect(pageB.getByText(marker)).toBeVisible({ timeout: 15_000 });

    await ctxA.close();
    await ctxB.close();
    sql(`DELETE FROM Comment WHERE body LIKE '%${marker}%'`);
  });
});

test.describe('Approvals', () => {
  test('request an approval, record a verdict, see it reflected', async ({ page, request }) => {
    const marker = `sign-off-${Date.now()}`;
    await openWbpPanel(page);

    await page.getByRole('button', { name: 'Request approval' }).click();
    await page.getByPlaceholder('What needs sign-off?').fill(marker);
    await page.locator('[role=combobox]').last().click();
    await page.getByRole('option', { name: /Alice/ }).click();
    await page.getByRole('button', { name: 'Send request' }).click();

    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pending').first()).toBeVisible();

    // Approver notification is real
    expect(Number(sql(`SELECT COUNT(*) FROM Notification WHERE type='approval' AND body LIKE '%${marker}%'`))).toBe(1);

    // Record the verdict through the API and watch the UI update via polling
    const id = sql(`SELECT id FROM Approval WHERE title='${marker}'`);
    const res = await request.patch('/api/approvals', { data: { id, status: 'approved' } });
    expect(res.ok()).toBeTruthy();
    await expect(page.getByText('Approved').first()).toBeVisible({ timeout: 10_000 });

    sql(`DELETE FROM Approval WHERE title='${marker}'`);
    sql(`DELETE FROM Notification WHERE body LIKE '%${marker}%'`);
  });
});

test.describe('Task assignment', () => {
  test('assigning a task from the board persists and notifies the assignee', async ({ page, request }) => {
    // Work against whatever program is active — pick a live task from the board
    const before = await (await request.get('/api/tasks')).json();
    const target = before[0];
    expect(target).toBeTruthy();
    const originalAssignee = target.assigneeId ?? null;

    await page.goto('/');
    await page.locator('aside nav button', { hasText: 'Kanban Board' }).first().click();
    await page.waitForLoadState('networkidle');

    const card = page.locator('div').filter({ has: page.locator(`p:text-is("${target.title}")`) }).last();
    await card.scrollIntoViewIfNeeded();
    await card.getByLabel('Assign to').click();
    await page.getByRole('menuitem', { name: /Bob Chen/ }).click();
    await page.waitForTimeout(1200);

    const tasks = await (await request.get('/api/tasks')).json();
    const task = tasks.find((t: { id: string }) => t.id === target.id);
    expect(task.assignee?.name).toBe('Bob Chen');
    expect(Number(sql(`SELECT COUNT(*) FROM Notification WHERE type='assignment'`))).toBeGreaterThan(0);

    // Restore the original assignee and clean up
    const restore = await request.patch('/api/tasks', { data: { id: target.id, assigneeId: originalAssignee } });
    expect(restore.ok()).toBeTruthy();
    sql(`DELETE FROM Notification WHERE type='assignment'`);
  });
});

test.describe('Inbox', () => {
  test('inbox view renders live data', async ({ page, request }) => {
    await page.goto('/');
    await page.locator('aside nav button', { hasText: 'Inbox' }).first().click();
    await expect(page.getByRole('heading', { name: 'Inbox', level: 2 })).toBeVisible();
    // Assert against whatever the live inbox actually holds
    const inbox = await (await request.get('/api/inbox')).json();
    if (inbox.notifications.length === 0) {
      await expect(page.getByText('You are all caught up')).toBeVisible();
    } else {
      await expect(page.getByText(inbox.notifications[0].title).first()).toBeVisible();
    }
  });
});

test.describe('Prompt-first onboarding', () => {
  test('the first screen converts a prompt into a complete program', async ({ page, request }) => {
    const before = await (await request.get('/api/program')).json();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What are you building?' })).toBeVisible();

    await page.locator('textarea').fill(
      'I am developing a project called XCollab — a cross-team collaboration platform. Timeline is 3 weeks. Teams: design and QA.',
    );
    await page.getByRole('button', { name: 'Create the program' }).click();

    // Lands on the dashboard of the newly created program
    await expect(page.getByRole('heading', { name: 'Program Dashboard', level: 2 })).toBeVisible({ timeout: 60_000 });

    const created = await (await request.get('/api/program')).json();
    expect(created.name).toBe('XCollab');
    // 3-week timeline honored (±2 days)
    const days = (new Date(created.targetDate).getTime() - new Date(created.startDate).getTime()) / 86_400_000;
    expect(Math.abs(days - 21)).toBeLessThanOrEqual(2);
    // Requested teams present
    const teamNames = created.teams.map((t: { name: string }) => t.name);
    expect(teamNames).toContain('Design');
    expect(teamNames).toContain('Quality Assurance');
    expect(created.wbps.length).toBeGreaterThanOrEqual(4);

    // Restore the previously active program and remove the generated one
    await request.post('/api/programs', { data: { id: before.id } });
    const pid = created.id;
    sql(`DELETE FROM Dependency WHERE fromWbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM Task WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM Risk WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM Milestone WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM WBP WHERE programId='${pid}'`);
    sql(`DELETE FROM AIConversation WHERE programId='${pid}'`);
    sql(`DELETE FROM Team WHERE slug LIKE '%-' || substr('${pid}', -4)`);
    sql(`DELETE FROM Program WHERE id='${pid}'`);
  });
});

test.describe('Program Architect', () => {
  test('one brief creates a full program, switches to it, and can be switched back', async ({ page, request }) => {
    const res = await request.post('/api/architect', {
      data: { brief: 'E2E: secure tactical drone communications program with an external antenna vendor' },
    });
    expect(res.ok()).toBeTruthy();
    const result = await res.json();
    expect(result.wbps).toBeGreaterThan(4);

    // The new program is now the active one across the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(result.name).first()).toBeVisible({ timeout: 10_000 });

    // Switch back to BRAIN via the programs API
    const programs = await (await request.get('/api/programs')).json();
    const brain = programs.find((p: { name: string }) => p.name.includes('BRAIN'));
    const switched = await request.post('/api/programs', { data: { id: brain.id } });
    expect(switched.ok()).toBeTruthy();

    // Remove the generated program so the demo dataset stays pristine
    const pid = result.programId;
    sql(`DELETE FROM Dependency WHERE fromWbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM Task WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM Risk WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM Milestone WHERE wbpId IN (SELECT id FROM WBP WHERE programId='${pid}')`);
    sql(`DELETE FROM WBP WHERE programId='${pid}' AND parentId IS NOT NULL`);
    sql(`DELETE FROM WBP WHERE programId='${pid}'`);
    sql(`DELETE FROM AIConversation WHERE programId='${pid}'`);
    sql(`DELETE FROM Team WHERE slug LIKE '%-' || substr('${pid}', -4)`);
    sql(`DELETE FROM Program WHERE id='${pid}'`);
  });
});
