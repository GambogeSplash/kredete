// Static checks run by `npm run check` after the type check (sandbox spec 4.5).
//
// 1. Every inline <script> in a served HTML page has its hash in the Content-Security-Policy
//    in vercel.json, and the policy allows no hash that is not used.
// 2. The policy and the other security headers match the spec exactly.
// 3. types.d.ts matches the OpenAPI document, when the document is available.
// 4. No em dash and no old product name ("Brain") anywhere in the client's own text files, and no inline event handler
//    attributes (the policy would block them).
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes, openapiAvailable, openapiPath } from './openapi-types.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** @type {string[]} */
const failures = [];
/** @type {string[]} */
const notes = [];

/** @param {string} path */
const read = (path) => readFile(join(ROOT, path), 'utf8');

/** Files under the repository root, minus dependencies, tool output and binary assets. */
async function textFiles(dir = ROOT) {
  const skip = new Set(['node_modules', '.git', '.vercel', 'test-results', 'playwright-report', 'vendor']);
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await textFiles(full)));
    else if (/\.(js|mjs|html|css|json|md|ts)$/.test(entry.name) && entry.name !== 'package-lock.json') {
      out.push(relative(ROOT, full));
    }
  }
  return out;
}

/** @param {string} html */
function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

/** @param {string} text */
const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

async function checkSecurityHeaders() {
  const vercel = JSON.parse(await read('vercel.json'));
  const rule = (vercel.headers || []).find((/** @type {any} */ r) => r.source === '/(.*)');
  if (!rule) {
    failures.push('vercel.json: no header rule for every response ("source": "/(.*)")');
    return;
  }
  /** @type {Record<string, string>} */
  const headers = Object.fromEntries(rule.headers.map((/** @type {any} */ h) => [h.key, h.value]));

  const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  const hashes = new Set();
  for (const page of pages) {
    for (const script of inlineScripts(await read(page))) hashes.add(sha256(script));
  }
  const expected =
    "default-src 'self'; " +
    `script-src 'self' ${[...hashes].sort().join(' ')}; ` +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    'font-src https://fonts.gstatic.com; ' +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'none'; " +
    "form-action 'self'";
  if (headers['Content-Security-Policy'] !== expected) {
    failures.push(
      'vercel.json: Content-Security-Policy does not match the inline scripts in ' +
        `${pages.join(', ')}.\n  Expected: ${expected}\n  Found:    ${headers['Content-Security-Policy']}`,
    );
  }
  /** @type {Record<string, string>} */
  const fixed = {
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
  for (const [key, value] of Object.entries(fixed)) {
    if (headers[key] !== value) failures.push(`vercel.json: ${key} must be "${value}", found "${headers[key]}"`);
  }

  const api = (vercel.rewrites || []).find((/** @type {any} */ r) => r.source === '/v1/:path*');
  if (!api) failures.push('vercel.json: no rewrite for /v1/:path*');
  else if (/\.invalid\//.test(api.destination)) {
    notes.push('vercel.json: /v1 still points at a placeholder host; set the tunnel URL before deploying.');
  }
}

async function checkTypes() {
  if (!openapiAvailable()) {
    notes.push(`types.d.ts drift not checked: ${openapiPath()} is missing (set BROTH_OPENAPI).`);
    return;
  }
  const current = await read('types.d.ts').catch(() => '');
  if (current !== (await generateTypes(openapiPath()))) {
    failures.push('types.d.ts is out of date with the OpenAPI document: run `npm run types`.');
  }
}

async function checkText() {
  for (const file of await textFiles()) {
    const text = await read(file);
    if (text.includes('\u2014')) failures.push(`${file}: contains an em dash; use "-"`);
    // The product is Broth; "Brain" was its old name (identifiers such as BRAIN and brain-* keys are not names).
    if (file !== 'tools/check.mjs' && /\bBrain\b/.test(text)) failures.push(`${file}: says "Brain"; the product is called Broth`);
    if (/\.(html|js)$/.test(file) && !file.startsWith('tests/') && !file.startsWith('tools/')) {
      const handler = text.match(/<[a-z][^>]*\son[a-z]+\s*=\s*["']/i);
      if (handler) failures.push(`${file}: inline event handler attribute "${handler[0]}" is blocked by the CSP`);
    }
  }
}

await checkSecurityHeaders();
await checkTypes();
await checkText();
for (const note of notes) console.log(`note: ${note}`);
if (failures.length) {
  for (const failure of failures) console.error(`check failed: ${failure}`);
  process.exit(1);
}
console.log('check passed');
