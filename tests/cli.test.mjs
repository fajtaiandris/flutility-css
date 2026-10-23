import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateCss } from '../dist/index.js';

const cli = fileURLToPath(new URL('../bin/flutility-css.mjs', import.meta.url));
const config = (positiveSteps = 2) => ({
  type: {
    minWidth: 320,
    maxWidth: 1240,
    minFontSize: 18,
    maxFontSize: 20,
    minTypeScale: 1.2,
    maxTypeScale: 1.25,
    positiveSteps,
  },
});

async function sampleProject(t) {
  const directory = await mkdtemp(join(tmpdir(), 'flutility-css-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function run(cwd, args = ['--out', 'styles/generated.css']) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

async function waitFor(check) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail('Timed out waiting for the CLI to regenerate CSS');
}

test('generates CSS from a sample project and skips unchanged output', async (t) => {
  const cwd = await sampleProject(t);
  await writeFile(join(cwd, 'flutility.config.json'), JSON.stringify(config()));

  const first = run(cwd);
  assert.equal(first.status, 0, first.stderr);
  const output = join(cwd, 'styles/generated.css');
  assert.equal(await readFile(output, 'utf8'), generateCss(config()));
  assert.match(first.stdout, /Wrote /);

  const before = (await stat(output)).mtimeMs;
  const second = run(cwd);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, '');
  assert.equal((await stat(output)).mtimeMs, before);
});

test('reports bad config and output errors', async (t) => {
  const cwd = await sampleProject(t);
  const path = join(cwd, 'flutility.config.json');
  await writeFile(path, '{');
  const invalidJson = run(cwd);
  assert.equal(invalidJson.status, 1);
  assert.match(invalidJson.stderr, /Invalid JSON/);

  await writeFile(path, JSON.stringify(config([1, 2])));
  const invalidSchema = run(cwd);
  assert.equal(invalidSchema.status, 1);
  assert.match(invalidSchema.stderr, /type\.positiveSteps/);

  await writeFile(path, JSON.stringify(config()));
  const cannotWrite = run(cwd, ['--out', '.']);
  assert.equal(cannotWrite.status, 1);
  assert.match(cannotWrite.stderr, /Cannot read output|Cannot write output/);

  const samePath = run(cwd, ['--out', 'flutility.config.json']);
  assert.equal(samePath.status, 1);
  assert.match(samePath.stderr, /--out must differ from the config file/);
});

test('accepts an explicit config path', async (t) => {
  const cwd = await sampleProject(t);
  await writeFile(join(cwd, 'fluid.json'), JSON.stringify(config(3)));
  const result = run(cwd, ['--config', 'fluid.json', '--out', 'styles/generated.css']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(join(cwd, 'styles/generated.css'), 'utf8'), /--flutility-step-3:/);
});

test('reads a colors-only config with a dark theme', async (t) => {
  const cwd = await sampleProject(t);
  const colors = {
    colors: { surface: '#fff', brand: { primary: '#6246ea' } },
    themes: { dark: { colors: { surface: '#111' } } },
  };
  await writeFile(join(cwd, 'flutility.config.json'), JSON.stringify(colors));
  const result = run(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(cwd, 'styles/generated.css'), 'utf8'), generateCss(colors));
});

test('shows help and rejects unknown options', async (t) => {
  const cwd = await sampleProject(t);
  const help = run(cwd, ['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: flutility-css/);

  const unknown = run(cwd, ['--out', 'style.css', '--bogus']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown option/);
});

test('watch mode regenerates after an atomic config replacement and recovers from invalid config', async (t) => {
  const cwd = await sampleProject(t);
  const path = join(cwd, 'flutility.config.json');
  const output = join(cwd, 'styles/generated.css');
  await writeFile(path, JSON.stringify(config()));

  const child = spawn(process.execPath, [cli, '--out', 'styles/generated.css', '--watch'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  await waitFor(async () => (await readFile(output, 'utf8').catch(() => '')).includes('--flutility-step-2:'));

  await writeFile(path, JSON.stringify(config([1, 2])));
  try {
    await waitFor(() => stderr.includes('type.positiveSteps'));
  } catch (error) {
    assert.fail(`${error.message}; stderr: ${stderr}; exit: ${child.exitCode}`);
  }
  assert.match(await readFile(output, 'utf8'), /--flutility-step-2:/);

  await writeFile(join(cwd, 'replacement.json'), JSON.stringify(config(3)));
  await rename(join(cwd, 'replacement.json'), path);
  await waitFor(async () => (await readFile(output, 'utf8')).includes('--flutility-step-3:'));
  assert.equal(child.exitCode, null);
});
