#!/usr/bin/env node
// dial-in tweak server. No dependencies.
//
// Serves the panel, reads manifests from <root>/.tweaks/, auto-saves values,
// and exits when the user clicks "Send to agent". The agent starts this
// process in the background, so the exit wakes the agent.
//
// Usage: node tweak-server.mjs [--root <project dir>] [--port 7777] [--allow-origin <origin>]...
// --port 0 picks any free port. The real port is in the DIAL_IN_READY line and .tweaks/server.json.

import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const extraOrigins = args.flatMap((a, i) => (a === '--allow-origin' && args[i + 1] ? [args[i + 1]] : []));

const root = resolve(flag('root', process.cwd()));
const tweaksDir = join(root, '.tweaks');
const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const firstPort = Number(flag('port', 7777));

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const STATIC = {
  '/panel.js': 'panel.js',
  '/core.js': 'core.js',
  '/vendor/tweakpane.min.js': 'vendor/tweakpane.min.js',
  '/vendor/tweakpane-plugin-essentials.min.js': 'vendor/tweakpane-plugin-essentials.min.js',
};

// Only local dev pages may load the panel or write values.
function originAllowed(origin) {
  if (!origin) return true;
  if (extraOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.test')
    );
  } catch {
    return false;
  }
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1_000_000) throw new Error('Body too large');
  }
  return data ? JSON.parse(data) : {};
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function listManifests() {
  if (!existsSync(tweaksDir)) return [];
  const files = (await readdir(tweaksDir)).filter((f) => f.endsWith('.manifest.json'));
  return Promise.all(files.map((f) => readJson(join(tweaksDir, f))));
}

// `signature` names the original values these tweaks belong to. The panel ignores
// saved values whose signature no longer matches the manifest.
async function saveValues(id, values, signature) {
  await writeFile(join(tweaksDir, `${id}.json`), JSON.stringify({ id, values, signature }, null, 2) + '\n');
}

let finished = false;

async function handle(req, res) {
  const origin = req.headers.origin;
  if (!originAllowed(origin)) return send(res, 403, { error: `Origin not allowed: ${origin}` });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const path = new URL(req.url, 'http://x').pathname;

  if (req.method === 'GET' && STATIC[path]) {
    const body = await readFile(join(assetsDir, STATIC[path]), 'utf8');
    return send(res, 200, body, 'text/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && path === '/manifests') {
    return send(res, 200, await listManifests());
  }

  const valuesMatch = path.match(/^\/values\/([^/]+)$/);
  if (valuesMatch) {
    const id = valuesMatch[1];
    if (!ID.test(id)) return send(res, 400, { error: 'Bad id' });
    if (req.method === 'GET') {
      const file = join(tweaksDir, `${id}.json`);
      return send(res, 200, existsSync(file) ? await readJson(file) : { id, values: null });
    }
    if (req.method === 'POST') {
      const { values, signature } = await readBody(req);
      await saveValues(id, values, signature);
      return send(res, 200, { ok: true });
    }
  }

  // "Send to agent". Body: { values: { [id]: {...} } }
  if (req.method === 'POST' && path === '/confirm') {
    if (finished) return send(res, 409, { error: 'Already sent' });
    const { values = {} } = await readBody(req);
    const status = 'apply';
    const ids = Object.keys(values).filter((id) => ID.test(id));
    for (const id of ids) await saveValues(id, values[id]);
    const result = { status, ids, at: new Date().toISOString() };
    await writeFile(join(tweaksDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    finished = true;
    send(res, 200, { ok: true });
    // Print one line for the agent, then exit so the background task ends.
    console.log(`DIAL_IN_RESULT ${JSON.stringify(result)}`);
    setTimeout(() => process.exit(0), 100);
    return;
  }

  send(res, 404, { error: 'Not found' });
}

function listen(port, triesLeft = 20) {
  const server = createServer((req, res) =>
    handle(req, res).catch((err) => send(res, 500, { error: String(err.message || err) })),
  );
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) return listen(port + 1, triesLeft - 1);
    console.error(`DIAL_IN_ERROR ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', async () => {
    port = server.address().port; // --port 0 lets the OS pick a free port.
    await writeFile(
      join(tweaksDir, 'server.json'),
      JSON.stringify({ port, pid: process.pid, root }, null, 2) + '\n',
    );
    console.log(`DIAL_IN_READY http://127.0.0.1:${port}/panel.js`);
  });
}

await mkdir(tweaksDir, { recursive: true });
listen(firstPort);
