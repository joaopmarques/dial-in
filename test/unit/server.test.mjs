import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { makeProject, startServer, cardManifest } from '../helpers.mjs';

let project;
let server;

beforeEach(async () => {
  project = await makeProject([cardManifest(), cardManifest({ id: 'hero', target: '#hero' })]);
  server = await startServer(project.root);
});

afterEach(async () => {
  await server?.stop();
  await project.cleanup();
});

const get = (path, headers = {}) => fetch(`${server.url}${path}`, { headers });
const post = (path, body, headers = {}) =>
  fetch(`${server.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('startup', () => {
  test('writes the port and pid to .tweaks/server.json', async () => {
    const info = await project.readJson('server.json');
    assert.equal(info.port, server.port);
    assert.equal(info.pid, server.child.pid);
    assert.equal(info.root, project.root);
  });

  test('moves to the next port when the first one is busy', async () => {
    const blocker = createServer();
    await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
    const busy = blocker.address().port;
    const second = await startServer(project.root, ['--port', String(busy)]).catch((e) => e);
    blocker.close();
    assert.ok(!(second instanceof Error), String(second));
    assert.notEqual(second.port, busy);
    await second.stop();
  });
});

describe('static files', () => {
  for (const path of ['/panel.js', '/core.js', '/vendor/tweakpane.min.js', '/vendor/tweakpane-plugin-essentials.min.js']) {
    test(`serves ${path} as JavaScript`, async () => {
      const res = await get(path);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/javascript/);
      assert.ok((await res.text()).length > 100);
    });
  }

  test('serves nothing outside the allow list', async () => {
    assert.equal((await get('/scripts/tweak-server.mjs')).status, 404);
    assert.equal((await get('/../package.json')).status, 404);
    assert.equal((await get('/vendor/README.md')).status, 404);
  });
});

describe('manifests and values', () => {
  test('lists every manifest', async () => {
    const list = await (await get('/manifests')).json();
    assert.deepEqual(list.map((m) => m.id).sort(), ['card', 'hero']);
  });

  test('returns null values before anything is saved', async () => {
    assert.deepEqual(await (await get('/values/card')).json(), { id: 'card', values: null });
  });

  test('saves values to .tweaks/<id>.json and reads them back', async () => {
    const res = await post('/values/card', { values: { padding: 30 } });
    assert.equal(res.status, 200);
    assert.deepEqual(await project.readJson('card.json'), { id: 'card', values: { padding: 30 } });
    assert.deepEqual(await (await get('/values/card')).json(), { id: 'card', values: { padding: 30 } });
  });

  test('keeps the originals signature with the values', async () => {
    await post('/values/card', { values: { padding: 31 }, signature: 'sig' });
    assert.deepEqual(await (await get('/values/card')).json(), { id: 'card', values: { padding: 31 }, signature: 'sig' });
  });

  test('rejects ids that could escape .tweaks/', async () => {
    for (const id of ['..%2F..%2Fescape', 'UPPER', '-lead', 'a.b']) {
      const res = await post(`/values/${id}`, { values: {} });
      assert.equal(res.status, 400, id);
    }
  });

  test('answers 500 with a message on broken JSON', async () => {
    const res = await fetch(`${server.url}/values/card`, { method: 'POST', body: '{nope' });
    assert.equal(res.status, 500);
    assert.ok((await res.json()).error);
  });
});

describe('origins', () => {
  test('allows local dev origins and echoes them for CORS', async () => {
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:5173', 'http://app.localhost', 'https://shop.test']) {
      const res = await get('/manifests', { Origin: origin });
      assert.equal(res.status, 200, origin);
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
    }
  });

  test('blocks other origins', async () => {
    for (const origin of ['https://evil.example', 'null', 'http://localhost.evil.com']) {
      const res = await post('/values/card', { values: { padding: 1 } }, { Origin: origin });
      assert.equal(res.status, 403, origin);
    }
    assert.equal(project.has('card.json'), false);
  });

  test('allows extra origins passed with --allow-origin', async () => {
    const extra = await startServer(project.root, ['--allow-origin', 'https://staging.example.com']);
    const res = await fetch(`${extra.url}/manifests`, { headers: { Origin: 'https://staging.example.com' } });
    assert.equal(res.status, 200);
    await extra.stop();
  });

  test('answers CORS preflight', async () => {
    const res = await fetch(`${server.url}/values/card`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
  });
});

describe('send to agent', () => {
  test('saves every panel, writes result.json, prints the result, and exits 0', async () => {
    const res = await post('/confirm', { values: { card: { padding: 40 }, hero: { size: 2 } } });
    assert.equal(res.status, 200);
    const { code, stdout } = await server.exited;
    assert.equal(code, 0);
    const line = stdout.split('\n').find((l) => l.startsWith('DIAL_IN_RESULT '));
    const printed = JSON.parse(line.slice('DIAL_IN_RESULT '.length));
    assert.equal(printed.status, 'apply');
    assert.deepEqual(printed.ids.sort(), ['card', 'hero']);
    assert.deepEqual(await project.readJson('result.json'), printed);
    assert.deepEqual((await project.readJson('card.json')).values, { padding: 40 });
    assert.deepEqual((await project.readJson('hero.json')).values, { size: 2 });
  });

  test('works with an empty body', async () => {
    await post('/confirm', {});
    const { code, stdout } = await server.exited;
    assert.equal(code, 0);
    assert.match(stdout, /DIAL_IN_RESULT \{"status":"apply","ids":\[\]/);
  });

  test('skips bad ids in the body', async () => {
    await post('/confirm', { values: { card: { a: 1 }, '../x': { a: 2 } } });
    await server.exited;
    assert.deepEqual((await project.readJson('result.json')).ids, ['card']);
  });
});
