import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeProject, cardManifest, startServer } from '../helpers.mjs';

const DIAL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'dial-in', 'scripts', 'dial.mjs');
const run = (root, command) => spawnSync(process.execPath, [DIAL, command, '--root', root], { encoding: 'utf8' });

let project;
beforeEach(async () => {
  project = await makeProject();
  execFileSync('git', ['init', '-q'], { cwd: project.root });
});
afterEach(() => project.cleanup());

describe('dial.mjs diff', () => {
  test('lists every knob, marks the changed ones, and gives the CSS text', async () => {
    await writeFile(project.file('card.json'), JSON.stringify({ id: 'card', values: { padding: 30, pressMs: 150, ease: [0.2, 0.8, 0.2, 1] } }));
    const out = JSON.parse(run(project.root, 'diff').stdout);
    const byKey = Object.fromEntries(out.map((k) => [k.key, k]));
    assert.equal(out.length, 5);
    assert.deepEqual(
      { changed: byKey.padding.changed, raw: byKey.padding.raw, css: byKey.padding.css, file: byKey.padding.file, line: byKey.padding.line },
      { changed: true, raw: '24px', css: '30px', file: 'index.html', line: 1 },
    );
    assert.equal(byKey.pressMs.changed, true);
    assert.equal(byKey.pressMs.value, 150);
    assert.equal(byKey.pressMs.css, undefined, 'JS knobs have no CSS text');
    assert.equal(byKey.ease.changed, false);
    assert.equal(byKey.radius.changed, false, 'a knob missing from the values file is unchanged');
  });

  test('without a values file, nothing changed', async () => {
    const out = JSON.parse(run(project.root, 'diff').stdout);
    assert.ok(out.every((k) => !k.changed));
  });
});

describe('dial.mjs teardown', () => {
  test('stops the server, deletes .tweaks/, and prints clean', async () => {
    const server = await startServer(project.root);
    const result = run(project.root, 'teardown');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /stopped tweak server/);
    assert.match(result.stdout, /clean/);
    assert.equal(existsSync(join(project.root, '.tweaks')), false);
    const { code } = await server.exited;
    assert.notEqual(code, 0, 'the server was killed, not confirmed');
  });

  test('lists leftovers and exits 1', async () => {
    await writeFile(join(project.root, 'Card.tsx'), 'const pad = "var(--dial-card-padding, 24px)"; // tweak-scaffold\n');
    const result = run(project.root, 'teardown');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Card\.tsx:1:/);
  });

  test('rejects an unknown command', () => {
    assert.equal(run(project.root, 'nope').status, 2);
  });
});

describe('dial.mjs teardown without git', () => {
  let plain;
  beforeEach(async () => { plain = await makeProject(); });   // no git init
  afterEach(() => plain.cleanup());

  test('a clean folder that is not a repo passes', () => {
    const result = run(plain.root, 'teardown');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /clean/);
    assert.doesNotMatch(result.stderr, /fatal/);
  });

  test('finds leftovers by walking the files', async () => {
    await mkdir(join(plain.root, 'src'));
    await writeFile(join(plain.root, 'src', 'Card.tsx'), 'ok\nconst pad = "var(--dial-card-padding, 24px)"; // tweak-scaffold\n');
    const result = run(plain.root, 'teardown');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /src\/Card\.tsx:2:/);
  });

  test('skips node_modules', async () => {
    await mkdir(join(plain.root, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(plain.root, 'node_modules', 'pkg', 'index.js'), '// data-tweak in a dependency\n');
    const result = run(plain.root, 'teardown');
    assert.equal(result.status, 0, result.stdout);
  });
});

describe('dial.mjs teardown ignores installed copies of the skill', () => {
  for (const withGit of [true, false]){
    test(`skill files inside the project are not leftovers (${withGit ? 'git' : 'no git'})`, async () => {
      const p = await makeProject();
      if (withGit) execFileSync('git', ['init', '-q'], { cwd: p.root });
      for (const dir of ['.claude/skills/dial-in', '.agents/skills/dial-in']){
        await mkdir(join(p.root, dir), { recursive: true });
        await writeFile(join(p.root, dir, 'SKILL.md'), 'Tag every line with tweak-scaffold and data-tweak.\n');
      }
      const result = run(p.root, 'teardown');
      await p.cleanup();
      assert.equal(result.status, 0, result.stdout);
      assert.match(result.stdout, /clean/);
    });
  }
});
