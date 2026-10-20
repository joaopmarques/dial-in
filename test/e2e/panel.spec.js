import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { makeProject, startServer, startPageServer, cardPage, cardManifest, waitFor } from '../helpers.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Each test gets its own project dir, tweak server, and page server.
const test = base.extend({
  dial: async ({ page }, use) => {
    const made = [];
    const dial = {
      async open({ manifests = [cardManifest()], body } = {}) {
        const project = await makeProject(manifests);
        const server = await startServer(project.root);
        const pages = await startPageServer({ '/index.html': cardPage(server.panelUrl, { body }) });
        made.push({ project, server, pages });
        Object.assign(dial, { project, server, pages });
        await page.goto(pages.url);
        await page.waitForFunction(() => window.__dialIn?.ready);
        return dial;
      },
    };
    await use(dial);
    for (const { project, server, pages } of made) {
      await server.stop();
      await pages.close();
      await project.cleanup();
    }
  },
});

const panel = (page, id = 'card') => page.locator(`.dial-in[data-dial-in-panel="${id}"]`);
const row = (page, label) =>
  panel(page).locator('.tp-lblv').filter({ has: page.locator('.tp-lblv_l', { hasText: label }) });
const rootVar = (page, name) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

async function setText(page, label, value, { which = 'last' } = {}) {
  const inputs = row(page, label).locator('input');
  const input = which === 'first' ? inputs.first() : inputs.last();
  await input.fill(String(value));
  await input.press('Enter');
}

const savedValues = (dial) =>
  waitFor(async () => dial.project.has('card.json') && (await dial.project.readJson('card.json')).values);

test.describe('mounting', () => {
  test('mounts a small floating window next to its target', async ({ page, dial }) => {
    await dial.open();
    await expect(panel(page)).toBeVisible();
    const card = await page.locator('.card').boundingBox();
    const box = await panel(page).boundingBox();
    expect(box.x).toBeCloseTo(card.x + card.width + 12, 0);
    expect(box.y).toBeCloseTo(card.y, 0);
    expect(box.width).toBe(320);
    expect(box.height).toBeLessThan(page.viewportSize().height - 100);
    await expect(panel(page)).toHaveCSS('border-radius', '10px');
    await expect(panel(page)).toHaveCSS('resize', 'both');
    for (const label of ['padding', 'radius', 'accent', 'ease', 'press ms']) {
      await expect(row(page, label)).toHaveCount(1);
    }
  });

  test('mounts several panels and "Send to agent" sends all of them', async ({ page, dial }) => {
    await dial.open({
      manifests: [cardManifest(), cardManifest({ id: 'hero', target: '#hero' })],
      body: `<article class="card" data-tweak="card">Card</article><div id="hero" style="position:absolute;left:40px;top:500px;width:100px;height:50px">Hero</div>`,
    });
    await expect(page.locator('.dial-in')).toHaveCount(2);
    await panel(page, 'hero').getByRole('button', { name: 'Send to agent' }).click();
    const { stdout } = await dial.server.exited;
    expect(stdout).toMatch(/"ids":\["card","hero"\]|"ids":\["hero","card"\]/);
  });

  test('hides the panel while the target is missing and shows it once the target renders', async ({ page, dial }) => {
    await dial.open({ body: '<div id="slot"></div>' });
    await expect(panel(page)).toBeHidden();
    await page.evaluate(() => {
      document.getElementById('slot').innerHTML = '<article class="card" data-tweak="card">Late</article>';
    });
    await expect(panel(page)).toBeVisible();
  });
});

test.describe('live values', () => {
  test('a number change sets the CSS variable and restyles the target', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    expect(await rootVar(page, '--dial-card-padding')).toBe('30px');
    await expect(page.locator('.card')).toHaveCSS('padding-top', '30px');
  });

  test('a color change restyles the target', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'accent', '#e11d48', { which: 'first' });
    await expect(page.locator('.card')).toHaveCSS('background-color', 'rgb(225, 29, 72)');
  });

  test('a cubic-bezier change sets the easing', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'ease', 'cubic-bezier(0.5, 0, 0.5, 1)', { which: 'first' });
    expect(await rootVar(page, '--dial-card-ease')).toBe('cubic-bezier(0.5, 0, 0.5, 1)');
  });

  test('a JS value updates __tweak and fires the tweak event', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'press ms', 250);
    await expect(page.locator('#readout')).toHaveText('250');
    const events = await page.evaluate(() => window.tweakEvents);
    expect(events).toContainEqual({ id: 'card', key: 'pressMs', value: 250 });
  });

  test('marks changed controls with a dot', async ({ page, dial }) => {
    await dial.open();
    await expect(row(page, 'padding').locator('.tp-lblv_l')).toHaveText('padding');
    await setText(page, 'padding', 30);
    await expect(row(page, 'padding').locator('.tp-lblv_l')).toHaveText('padding •');
    await expect(row(page, 'radius').locator('.tp-lblv_l')).toHaveText('radius');
  });

  test('draws a ghost marker at the original value', async ({ page, dial }) => {
    await dial.open();
    const ghost = row(page, 'padding').locator('.dial-in-ghost');
    await expect(ghost).toHaveAttribute('style', /left: 50%/);
    await expect(ghost).toHaveAttribute('title', 'original: 24px');
  });

  test('Reset puts every control back to its original', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await setText(page, 'ease', 'cubic-bezier(0.5, 0, 0.5, 1)', { which: 'first' });
    await panel(page).getByRole('button', { name: 'Reset' }).click();
    expect(await rootVar(page, '--dial-card-padding')).toBe('24px');
    expect(await rootVar(page, '--dial-card-ease')).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    await expect(row(page, 'padding').locator('.tp-lblv_l')).toHaveText('padding');
  });
});

test.describe('Original / Tweaked toggle', () => {
  test('Original shows the original values and Tweaked brings yours back', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await setText(page, 'press ms', 250);
    const original = panel(page).getByRole('radio', { name: 'Original' });
    const tweaked = panel(page).getByRole('radio', { name: 'Tweaked' });
    await expect(tweaked).toHaveAttribute('aria-checked', 'true');

    await original.click();
    await expect(original).toHaveAttribute('aria-checked', 'true');
    expect(await rootVar(page, '--dial-card-padding')).toBe('24px');
    await expect(page.locator('#readout')).toHaveText('120');
    await expect(panel(page).locator('.dial-in-note')).toContainText('Showing the original');

    await tweaked.click();
    expect(await rootVar(page, '--dial-card-padding')).toBe('30px');
    await expect(page.locator('#readout')).toHaveText('250');
  });

  test('Original never overwrites the saved tweaks', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await waitFor(async () => (await savedValues(dial)).padding === 30);
    await panel(page).getByRole('radio', { name: 'Original' }).click();
    await page.waitForTimeout(500);
    expect((await dial.project.readJson('card.json')).values.padding).toBe(30);
  });

  test('arrow keys move the toggle', async ({ page, dial }) => {
    await dial.open();
    const tweaked = panel(page).getByRole('radio', { name: 'Tweaked' });
    await tweaked.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(panel(page).getByRole('radio', { name: 'Original' })).toHaveAttribute('aria-checked', 'true');
    await expect(panel(page).getByRole('radio', { name: 'Original' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tweaked).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('persistence', () => {
  test('auto-saves every change to the server file', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await setText(page, 'accent', '#e11d48', { which: 'first' });
    const values = await waitFor(async () => {
      const v = await savedValues(dial);
      return v.padding === 30 && v.accent === '#e11d48' && v;
    });
    expect(values.pressMs).toBe(120);
  });

  test('values survive a reload', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await page.reload();
    await page.waitForFunction(() => window.__dialIn?.ready);
    expect(await rootVar(page, '--dial-card-padding')).toBe('30px');
  });

  test('a fresh browser restores values from the server file', async ({ browser, page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await waitFor(async () => (await savedValues(dial)).padding === 30);
    const other = await (await browser.newContext()).newPage();
    await other.goto(dial.pages.url);
    await other.waitForFunction(() => window.__dialIn?.ready);
    expect(await rootVar(other, '--dial-card-padding')).toBe('30px');
  });

  test('ignores saved tweaks once the agent changes the original values', async ({ browser, page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await waitFor(async () => (await savedValues(dial)).padding === 30);
    const changed = cardManifest();
    changed.controls[0].value = 20;
    await writeFile(dial.project.file('card.manifest.json'), JSON.stringify(changed));

    await page.reload();
    await page.waitForFunction(() => window.__dialIn?.ready);
    expect(await rootVar(page, '--dial-card-padding')).toBe('20px');

    const other = await (await browser.newContext()).newPage();
    await other.goto(dial.pages.url);
    await other.waitForFunction(() => window.__dialIn?.ready);
    expect(await rootVar(other, '--dial-card-padding')).toBe('20px');
  });
});

test.describe('Send to agent', () => {
  test('sends the values, stops the server, and locks the panel', async ({ page, dial }) => {
    await dial.open();
    await setText(page, 'padding', 30);
    await panel(page).getByRole('button', { name: 'Send to agent' }).click();
    const { code, stdout } = await dial.server.exited;
    expect(code).toBe(0);
    expect(stdout).toContain('DIAL_IN_RESULT {"status":"apply"');
    expect((await dial.project.readJson('card.json')).values.padding).toBe(30);
    await expect(panel(page)).toHaveClass(/is-done/);
    await expect(panel(page).locator('.dial-in-note')).toContainText('Sent to agent');
    await expect(panel(page).locator('.dial-in-note')).not.toContainText('unreachable');
  });

  test('there is no Discard button', async ({ page, dial }) => {
    await dial.open();
    await expect(panel(page).getByRole('button', { name: /discard/i })).toHaveCount(0);
  });

  test('when the server is gone, it explains the fallback and keeps the panel usable', async ({ page, dial }) => {
    await dial.open();
    await dial.server.stop();
    await panel(page).getByRole('button', { name: 'Send to agent' }).click();
    await expect(panel(page).locator('.dial-in-note')).toContainText('The tweak server is not running');
    await expect(panel(page).locator('.dial-in-note')).toContainText('Click JSON');
    await expect(panel(page)).not.toHaveClass(/is-done/);
    await expect(panel(page).getByRole('button', { name: 'Send to agent' })).toBeVisible();
  });
});

test.describe('easing presets', () => {
  test('shows the six presets under the curve editor', async ({ page, dial }) => {
    await dial.open();
    const presets = row(page, 'ease').getByRole('group', { name: 'ease presets' }).getByRole('button');
    await expect(presets).toHaveText(['ease-out', 'ease-in-out', 'linear', 'out-sine', 'out-quad', 'out-cubic']);
    for (const name of ['ease-out', 'out-cubic']) {
      await expect(row(page, 'ease').getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('a preset sets the curve and shows as active', async ({ page, dial }) => {
    await dial.open();
    await row(page, 'ease').getByRole('button', { name: 'out-cubic' }).click();
    expect(await rootVar(page, '--dial-card-ease')).toBe('cubic-bezier(0.33, 1, 0.68, 1)');
    await expect(row(page, 'ease').getByRole('button', { name: 'out-cubic' })).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 'ease').locator('input').first()).toHaveValue(/0\.33, 1\.00, 0\.68, 1\.00/);
    await waitFor(async () => same((await savedValues(dial)).ease, [0.33, 1, 0.68, 1]));
  });

  test('a custom curve clears the active preset', async ({ page, dial }) => {
    await dial.open();
    await row(page, 'ease').getByRole('button', { name: 'linear' }).click();
    await setText(page, 'ease', 'cubic-bezier(0.1, 0.2, 0.3, 0.4)', { which: 'first' });
    await expect(row(page, 'ease').getByRole('button', { name: 'linear' })).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('docking', () => {
  const host = (page) => page.locator('.dial-in-host');
  const dockButton = (page, name) => panel(page).getByRole('radio', { name });
  const pagePadding = (page, side) => page.evaluate((s) => document.documentElement.style[`padding${s}`], side);

  test('starts floating, with the Undock option checked', async ({ page, dial }) => {
    await dial.open();
    await expect(host(page)).toHaveAttribute('data-dock', 'float');
    await expect(dockButton(page, 'Undock into a floating panel')).toHaveAttribute('aria-checked', 'true');
  });

  for (const [name, side, edge] of [
    ['Dock to right', 'Right', 'right'],
    ['Dock to left', 'Left', 'left'],
    ['Dock to bottom', 'Bottom', 'bottom'],
  ]) {
    test(`${name} pins the panel to the ${edge} edge and pads the page`, async ({ page, dial }) => {
      // A normal-flow page: docking padding moves it out from under the panel.
      await dial.open({ body: `<article class="card" data-tweak="card" style="position:static;margin:40px">Card</article>` });
      await dockButton(page, name).click();
      await expect(dockButton(page, name)).toHaveAttribute('aria-checked', 'true');
      await expect(host(page)).toHaveAttribute('data-dock', edge);
      expect(await pagePadding(page, side)).toBe('320px');
      const box = await host(page).boundingBox();
      const { width, height } = page.viewportSize();
      if (edge === 'right') expect(box.x + box.width).toBeCloseTo(width, 0);
      if (edge === 'left') expect(box.x).toBe(0);
      if (edge === 'bottom') {
        expect(box.y + box.height).toBeCloseTo(height, 0);
        expect(box.width).toBeCloseTo(width, 0);
      }
      if (edge !== 'bottom') expect(box.height).toBeCloseTo(height, 0);
      // The target is never under a docked panel.
      const card = await page.locator('.card').boundingBox();
      const overlaps = !(card.x + card.width <= box.x || box.x + box.width <= card.x || card.y + card.height <= box.y || box.y + box.height <= card.y);
      expect(overlaps).toBe(false);
    });
  }

  test('undocking restores the page padding', async ({ page, dial }) => {
    await dial.open();
    await page.evaluate(() => (document.documentElement.style.paddingRight = '5px'));
    await page.reload();
    await page.waitForFunction(() => window.__dialIn?.ready);
    await page.evaluate(() => (document.documentElement.style.paddingRight = ''));
    await dockButton(page, 'Dock to right').click();
    expect(await pagePadding(page, 'Right')).toBe('320px');
    await dockButton(page, 'Undock into a floating panel').click();
    expect(await pagePadding(page, 'Right')).toBe('');
    await expect(host(page)).toHaveAttribute('data-dock', 'float');
  });

  test('remembers the dock side across reloads', async ({ page, dial }) => {
    await dial.open();
    await dockButton(page, 'Dock to left').click();
    await page.reload();
    await page.waitForFunction(() => window.__dialIn?.ready);
    await expect(host(page)).toHaveAttribute('data-dock', 'left');
    expect(await pagePadding(page, 'Left')).toBe('320px');
  });

  test('docked panels stack in one bar and switch together', async ({ page, dial }) => {
    await dial.open({
      manifests: [cardManifest(), cardManifest({ id: 'hero', target: '#hero' })],
      body: `<article class="card" data-tweak="card">Card</article><div id="hero">Hero</div>`,
    });
    await panel(page, 'hero').getByRole('radio', { name: 'Dock to right' }).click();
    await expect(panel(page, 'card').getByRole('radio', { name: 'Dock to right' })).toHaveAttribute('aria-checked', 'true');
    const a = await panel(page, 'card').boundingBox();
    const b = await panel(page, 'hero').boundingBox();
    expect(a.x).toBeCloseTo(b.x, 0);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
  });

  test('a docked panel does not drag and shows no grip', async ({ page, dial }) => {
    await dial.open();
    await dockButton(page, 'Dock to right').click();
    const before = await panel(page).boundingBox();
    const t = await panel(page).locator('.dial-in-title').boundingBox();
    await page.mouse.move(t.x + 5, t.y + 5);
    await page.mouse.down();
    await page.mouse.move(t.x - 200, t.y + 5, { steps: 5 });
    await page.mouse.up();
    expect((await panel(page).boundingBox()).x).toBeCloseTo(before.x, 0);
    const grip = await panel(page).locator('.dial-in-grip').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(grip).toBe('none');
  });
});

test.describe('panel chrome', () => {
  test('every button has a label or an accessible name', async ({ page, dial }) => {
    await dial.open();
    for (const name of ['Reset', 'JSON', 'Send to agent', 'Collapse the panel']) {
      await expect(panel(page).getByRole('button', { name, exact: true })).toBeVisible();
    }
    for (const name of ['Original', 'Tweaked', 'Undock into a floating panel', 'Dock to left', 'Dock to bottom', 'Dock to right']) {
      await expect(panel(page).getByRole('radio', { name })).toBeVisible();
    }
  });

  test('Reset and JSON show an icon next to the label', async ({ page, dial }) => {
    await dial.open();
    for (const name of ['Reset', 'JSON']) {
      const button = panel(page).getByRole('button', { name, exact: true });
      await expect(button.locator('svg')).toHaveCount(1);
      await expect(button).toHaveText(name);
    }
  });

  test('the free header space shows a dotted grip', async ({ page, dial }) => {
    await dial.open();
    const grip = panel(page).locator('.dial-in-grip');
    expect(await grip.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('radial-gradient');
    expect((await grip.boundingBox()).width).toBeGreaterThan(40);
  });

  test('Copy JSON copies the values', async ({ page, context, dial }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await dial.open();
    await setText(page, 'padding', 30);
    await panel(page).getByRole('button', { name: 'JSON' }).click();
    await expect(panel(page).getByRole('button', { name: 'Copied' })).toBeVisible();
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(copied.id).toBe('card');
    expect(copied.values.padding).toBe(30);
  });

  test('the minus icon collapses the panel and the plus icon expands it', async ({ page, dial }) => {
    await dial.open();
    await panel(page).getByRole('button', { name: 'Collapse the panel' }).click();
    await expect(panel(page).locator('.dial-in-body')).toBeHidden();
    await expect(panel(page).locator('.dial-in-foot')).toBeHidden();
    expect((await panel(page).boundingBox()).height).toBeLessThan(60);
    await expect(panel(page)).toHaveCSS('resize', 'none');
    await panel(page).getByRole('button', { name: 'Expand the panel' }).click();
    await expect(panel(page).locator('.dial-in-body')).toBeVisible();
    expect((await panel(page).boundingBox()).height).toBeGreaterThan(200);
  });

  test('dragging the header moves the panel, remembers it, and a double-click re-anchors', async ({ page, dial }) => {
    await dial.open();
    const anchored = await panel(page).boundingBox();
    const title = panel(page).locator('.dial-in-title');
    const t = await title.boundingBox();
    await page.mouse.move(t.x + 10, t.y + 5);
    await page.mouse.down();
    await page.mouse.move(t.x + 110, t.y + 155, { steps: 5 });
    await page.mouse.up();
    const moved = await panel(page).boundingBox();
    expect(moved.x).toBeCloseTo(anchored.x + 100, 0);
    expect(moved.y).toBeCloseTo(anchored.y + 150, 0);

    await page.reload();
    await page.waitForFunction(() => window.__dialIn?.ready);
    expect((await panel(page).boundingBox()).x).toBeCloseTo(moved.x, 0);
    expect((await panel(page).boundingBox()).y).toBeCloseTo(moved.y, 0);

    await panel(page).locator('.dial-in-title').dblclick();
    await expect.poll(async () => (await panel(page).boundingBox()).x).toBeCloseTo(anchored.x, 0);
  });

  test('the corner handle resizes the floating window, and the size is remembered', async ({ page, dial }) => {
    await dial.open();
    const before = await panel(page).boundingBox();
    const corner = { x: before.x + before.width - 3, y: before.y + before.height - 3 };
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + 80, corner.y - 120, { steps: 5 });
    await page.mouse.up();
    const resized = await panel(page).boundingBox();
    expect(resized.width).toBeCloseTo(before.width + 80, -1);
    expect(resized.height).toBeCloseTo(before.height - 120, -1);

    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => window.__dialIn?.ready);
    const restored = await panel(page).boundingBox();
    expect(restored.width).toBeCloseTo(resized.width, 0);
    expect(restored.height).toBeCloseTo(resized.height, 0);
  });

  test('a docked panel ignores the floating size, and undocking brings it back', async ({ page, dial }) => {
    await dial.open();
    await panel(page).evaluate((el) => Object.assign(el.style, { width: '400px', height: '250px' }));
    await panel(page).getByRole('radio', { name: 'Dock to right' }).click();
    const docked = await panel(page).boundingBox();
    expect(docked.width).toBeCloseTo(320, 0);
    expect(docked.height).toBeCloseTo(page.viewportSize().height, 0);
    await expect(panel(page)).toHaveCSS('border-radius', '0px');
    await panel(page).getByRole('radio', { name: 'Undock into a floating panel' }).click();
    const floating = await panel(page).boundingBox();
    expect(floating.width).toBe(400);
    expect(floating.height).toBe(250);
  });

  test('follows the system light theme', async ({ page, dial }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await dial.open();
    await expect(panel(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('follows the system dark theme', async ({ page, dial }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await dial.open();
    await expect(panel(page)).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  });

  test('uses the system UI font everywhere, inputs included', async ({ page, dial }) => {
    await dial.open();
    for (const el of [row(page, 'padding').locator('.tp-lblv_l'), row(page, 'padding').locator('input').last()]) {
      const family = await el.evaluate((node) => getComputedStyle(node).fontFamily);
      expect(family).toContain('system-ui');
      expect(family).not.toMatch(/mono/i);
    }
  });
});
