#!/usr/bin/env node

import { watchFile } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generateCss } from '../dist/index.js';

const usage = `Usage: flutility-css --out <file> [--config <file>] [--watch]

Options:
  --config <file>  JSON config file (default: flutility.config.json)
  --out <file>     CSS output file (required)
  --watch          Regenerate when the config changes
  --help           Show this help`;

function getOptions() {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: 'flutility.config.json' },
      out: { type: 'string' },
      watch: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (!values.help && !values.out) throw new Error('Missing --out <file> (see --help)');
  return values;
}

async function readConfig(path) {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read config ${path}: ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

async function generateFile(configPath, outPath) {
  const css = generateCss(await readConfig(configPath));
  try {
    if (await readFile(outPath, 'utf8') === css) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read output ${outPath}: ${error.message}`);
  }

  try {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, css);
  } catch (error) {
    throw new Error(`Cannot write output ${outPath}: ${error.message}`);
  }
  return true;
}

async function main() {
  const options = getOptions();
  if (options.help) {
    console.log(usage);
    return;
  }

  const configPath = resolve(options.config);
  const outPath = resolve(options.out);
  if (configPath === outPath) throw new Error('--out must differ from the config file');
  const run = async () => {
    if (await generateFile(configPath, outPath)) console.log(`Wrote ${outPath}`);
  };

  if (!options.watch) {
    await run();
    return;
  }

  let pending = Promise.resolve();
  const queueRun = () => {
    pending = pending.then(run).catch((error) => {
      console.error(`flutility-css: ${error.message}`);
    });
    return pending;
  };
  watchFile(configPath, { interval: 250 }, queueRun);
  console.log(`Watching ${configPath}`);
  await queueRun();
}

main().catch((error) => {
  console.error(`flutility-css: ${error.message}`);
  process.exitCode = 1;
});
