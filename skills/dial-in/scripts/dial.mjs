#!/usr/bin/env node
// dial-in helper for the mechanical steps, so the agent runs one command instead of reasoning through them.
//
//   node dial.mjs diff --root <project>       Changed knobs: file:line, raw text, new value. JSON on stdout.
//   node dial.mjs teardown --root <project>   Stop the server, delete .tweaks/ state, list scaffold leftovers.
//                                             Exit 1 while leftovers remain.

import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cssValue, same } from '../assets/core.js';

const [command, ...args] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const root = resolve(flag('root', process.cwd()));
const tweaksDir = join(root, '.tweaks');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

async function manifests() {
  if (!existsSync(tweaksDir)) return [];
  const files = (await readdir(tweaksDir)).filter((f) => f.endsWith('.manifest.json'));
  return Promise.all(files.map((f) => readJson(join(tweaksDir, f))));
}

// For each knob: unchanged ones only need their raw text back; changed ones need a write.
async function diff() {
  const out = [];
  for (const manifest of await manifests()) {
    const file = join(tweaksDir, `${manifest.id}.json`);
    const values = existsSync(file) ? (await readJson(file)).values ?? {} : {};
    for (const control of manifest.controls) {
      const value = values[control.key] ?? control.value;
      const changed = !same(value, control.value);
      out.push({
        id: manifest.id,
        key: control.key,
        changed,
        file: control.source?.file,
        line: control.source?.line,
        raw: control.source?.raw,
        original: control.value,
        value,
        // The CSS text for the new value. For JS knobs, write `value` in the line's own idiom.
        css: control.kind === 'js' ? undefined : cssValue(control, value),
      });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

async function teardown() {
  // 1. Stop the server if it still runs.
  const serverFile = join(tweaksDir, 'server.json');
  if (existsSync(serverFile)) {
    const { pid } = await readJson(serverFile);
    try {
      process.kill(pid);
      console.log(`stopped tweak server (pid ${pid})`);
    } catch {
      // Already gone.
    }
  }
  // 2. Delete the state, then .tweaks/ itself.
  await rm(tweaksDir, { recursive: true, force: true });
  console.log('deleted .tweaks/');

  // 3. Search the project for leftovers: git grep in a repo, a plain file walk otherwise.
  // The skill's own files mention the markers; skip any installed copy (.claude/skills/dial-in, .agents/skills/dial-in…).
  const hits = (gitGrep() ?? (await walkGrep(root))).split('\n').filter((l) => l && !OWN_FILES.test(l)).join('\n');
  if (hits.trim()) {
    console.log(`leftovers to remove:\n${hits.trim()}`);
    process.exit(1);
  }
  console.log('clean: no scaffold left');
}

const LEFTOVER = /tweak-scaffold|--dial-|__tweak|data-tweak/;
const OWN_FILES = /^(?:.*\/)?skills\/dial-in\//;

// Leftover lines as "file:line:text", or null when git cannot search here (not a repo, or git missing).
function gitGrep(){
  try {
    return execFileSync('git', ['grep', '-n', '--untracked', '-E', LEFTOVER.source, '--', '.', ':!node_modules'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    return err.status === 1 ? '' : null;   // 1 = searched, no matches
  }
}

// The same search without git: every text file under root, skipping dependency and build folders.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.output', 'coverage', '.tweaks']);
async function walkGrep(dir, out = []){
  for (const entry of await readdir(dir, { withFileTypes: true })){
    const path = join(dir, entry.name);
    if (entry.isDirectory()){
      if (!SKIP_DIRS.has(entry.name)) await walkGrep(path, out);
      continue;
    }
    if (!entry.isFile() || (await stat(path)).size > 2_000_000) continue;
    const text = await readFile(path, 'utf8');
    if (text.includes('\0')) continue;   // binary
    text.split('\n').forEach((line, i) => {
      if (LEFTOVER.test(line)) out.push(`${path.slice(root.length + 1)}:${i + 1}:${line}`);
    });
  }
  return out.join('\n');
}

const commands = { diff, teardown };
if (!commands[command]) {
  console.error('usage: node dial.mjs <diff|teardown> --root <project>');
  process.exit(2);
}
await commands[command]();
