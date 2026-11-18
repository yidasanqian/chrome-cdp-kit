#!/usr/bin/env node
// Prints the CHANGELOG.md section for the version in package.json.
// Used by .github/workflows/release.yml to build GitHub Release notes, and
// runnable locally: `node scripts/release-notes.mjs`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lines = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split('\n');

const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) throw new Error(`CHANGELOG.md has no "## [${version}]" section`);

let end = lines.length;
for (let index = start + 1; index < lines.length; index += 1) {
  if (lines[index].startsWith('## ')) {
    end = index;
    break;
  }
}

process.stdout.write(`${lines.slice(start, end).join('\n').trimEnd()}\n`);