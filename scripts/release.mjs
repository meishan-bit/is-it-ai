#!/usr/bin/env node
// Version helper.
//   npm run release -- patch "Fix button size on small phones"
//   npm run release -- minor "Add progress dashboard"
//   npm run release -- content-minor "Reworded S06 and S13"
// App bumps change package.json; content bumps change content/meta.json. Both write to CHANGELOG.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [kindArg, ...rest] = process.argv.slice(2);
const summary = rest.join(' ').trim();
const kinds = ['patch', 'minor', 'major', 'content-patch', 'content-minor', 'content-major'];
if (!kinds.includes(kindArg) || !summary) {
  console.error(`Usage: npm run release -- <${kinds.join('|')}> "what changed"`);
  process.exit(1);
}
const bump = (v, level) => {
  const [a, b, c] = v.split('.').map(Number);
  return level === 'major' ? `${a + 1}.0.0` : level === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
};
const today = new Date().toISOString().slice(0, 10);
const isContent = kindArg.startsWith('content-');
const level = kindArg.replace('content-', '');

let next;
if (isContent) {
  const p = join(root, 'content/meta.json');
  const meta = JSON.parse(readFileSync(p, 'utf8'));
  next = bump(meta.content_version, level);
  meta.content_version = next;
  meta.updated = today;
  meta.history.unshift({ version: next, date: today, summary });
  writeFileSync(p, JSON.stringify(meta, null, 2) + '\n');
} else {
  const p = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  next = bump(pkg.version, level);
  pkg.version = next;
  writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
}

const cl = join(root, 'CHANGELOG.md');
let text = readFileSync(cl, 'utf8');
const label = isContent ? `content ${next}` : `app ${next}`;
const entry = `## [${label}] - ${today}\n- ${summary}\n\n`;
const marker = text.indexOf('\n## ');
text = marker === -1 ? text + '\n' + entry : text.slice(0, marker + 1) + entry + text.slice(marker + 1);
writeFileSync(cl, text);

const tag = isContent ? `content-v${next}` : `v${next}`;
console.log(`${isContent ? 'Content' : 'App'} version is now ${next}. CHANGELOG.md updated.`);
console.log(`Next:\n  git add -A && git commit -m "${label}: ${summary}"\n  git tag ${tag}\n  git push && git push --tags`);
