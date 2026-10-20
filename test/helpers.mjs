// Test helpers: a throwaway project dir, the tweak server, and a static page server.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dial-in', 'scripts', 'tweak-server.mjs');

export const cardManifest = (overrides = {}) => ({
  id: 'card',
  target: "[data-tweak='card']",
  controls: [
    { key: 'padding', kind: 'css', type: 'number', min: 0, max: 48, step: 1, unit: 'px', value: 24, source: { file: 'index.html', line: 1, raw: '24px' } },
    { key: 'radius', kind: 'css', type: 'number', min: 0, max: 32, step: 1, unit: 'px', value: 12, source: { file: 'index.html', line: 2, raw: '12px' } },
    { key: 'accent', kind: 'css', type: 'color', value: '#4f46e5', source: { file: 'index.html', line: 3, raw: '#4f46e5' } },
    { key: 'ease', kind: 'css', type: 'cubic-bezier', value: [0.2, 0.8, 0.2, 1], source: { file: 'index.html', line: 4, raw: 'ease' } },
    { key: 'pressMs', label: 'press ms', kind: 'js', type: 'number', min: 0, max: 400, step: 10, value: 120, source: { file: 'index.html', line: 5, raw: '120' } },
  ],
  ...overrides,
});

export async function makeProject(manifests = [cardManifest()]) {
  const root = await mkdtemp(join(tmpdir(), 'dial-in-test-'));
  await mkdir(join(root, '.tweaks'));
  for (const m of manifests) {
    await writeFile(join(root, '.tweaks', `${m.id}.manifest.json`), JSON.stringify(m));
  }
  return {
    root,
    file: (name) => join(root, '.tweaks', name),
    async readJson(name) {
      return JSON.parse(await readFile(join(root, '.tweaks', name), 'utf8'));
    },
    has: (name) => existsSync(join(root, '.tweaks', name)),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

// Start the tweak server. Resolves once it prints DIAL_IN_READY.
export function startServer(root, extraArgs = []) {
  const child = spawn(process.execPath, [SERVER_SCRIPT, '--root', root, '--port', '0', ...extraArgs], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve({ code, stdout, stderr })));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start.\n${stdout}\n${stderr}`)), 5000);
    child.stdout.on('data', () => {
      const match = stdout.match(/DIAL_IN_READY (http:\/\/127\.0\.0\.1:(\d+))\/panel\.js/);
      if (!match) return;
      clearTimeout(timer);
      resolve({
        child,
        exited,
        port: Number(match[2]),
        url: match[1],
        panelUrl: `${match[1]}/panel.js`,
        stop: () => {
          if (child.exitCode === null) child.kill();
          return exited;
        },
      });
    });
    child.on('exit', () => reject(new Error(`Server exited early.\n${stdout}\n${stderr}`)));
  });
}

// Serve one HTML page (plus any extra files) from 127.0.0.1 on a free port.
export function startPageServer(pages) {
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    const body = pages[path === '/' ? '/index.html' : path];
    if (body === undefined) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      }),
    ),
  );
}

// A demo page with one card and a JS readout. `panelUrl` is the tweak server's panel.js.
export function cardPage(panelUrl, { body } = {}) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: sans-serif; }
  .card {
    position: absolute; left: 40px; top: 40px; width: 200px;
    padding: var(--dial-card-padding, 24px);
    border-radius: var(--dial-card-radius, 12px);
    background: var(--dial-card-accent, #4f46e5);
    transition: transform 1ms var(--dial-card-ease, ease);
  }
</style></head><body>
${body ?? `<article class="card" data-tweak="card">Card</article>`}
<p id="readout"></p>
<script>
  window.tweakEvents = [];
  const read = (e) => {
    if (e) window.tweakEvents.push(e.detail);
    document.getElementById('readout').textContent = String(globalThis.__tweak?.('card', 'pressMs', 120) ?? 120);
  };
  read();
  window.addEventListener('tweak', read);
</script>
<script type="module" src="${panelUrl}"></script>
</body></html>`;
}

export async function waitFor(check, { timeout = 3000, interval = 25 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, interval));
  }
}
