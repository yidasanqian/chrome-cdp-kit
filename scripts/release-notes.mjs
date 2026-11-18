#!/usr/bin/env node
// Prints the CHANGELOG.md section for a version.
//
//   node scripts/release-notes.mjs        # version from package.json
//   node scripts/release-notes.mjs 1.3.0  # explicit version (CI passes the tag)
//
// CI passes the tag because the checkout it runs from is the workflow commit (main
// tip for workflow_dispatch), while the version to describe comes from the tag.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.argv[2] ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const version = raw.trim().replace(/^v/, '');

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