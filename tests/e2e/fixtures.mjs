// Shared fixtures for the browser suite.
//
// - open(person, path, options): a page signed in as a seeded person (their refresh cookie,
//   from a pool split by worker, since each token is single use), in the project's viewport and
//   theme, with the welcome tour done unless asked for. Every response from the client gets the
//   security headers from vercel.json, and any Content-Security-Policy violation fails the test.
//   Google Fonts come from tests/e2e/fonts (fetched once, then committed), so runs are hermetic.
// - check(page, name, options): waits for loading states to finish, asserts that tools/audit.js
//   finds no low-contrast text, no tap target under 24 px and no unlabelled control, then
//   compares a screenshot. Masks cover only text that changes from run to run.
import { test as base, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { BASE, ROOT, SESSIONS, STATE, WORKERS, loadSeed } from './stack.mjs';

const VERCEL = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
const HEADERS = Object.fromEntries(VERCEL.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
const AUDIT = readFileSync(resolve(ROOT, 'tools/audit.js'), 'utf8');
const FONTS = resolve(ROOT, 'tests/e2e/fonts');
const COUNTERS = resolve(STATE, 'tokens');
const ORIGIN = new URL(BASE).origin;

/** The next unused refresh token for `person` in this worker slot. */
function takeToken(seed, person, info) {
  const per = Math.floor(SESSIONS / WORKERS);
  const file = resolve(COUNTERS, `${info.project.name}-${info.parallelIndex}-${person}`);
  mkdirSync(dirname(file), { recursive: true });
  const used = existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
  if (used >= per) throw new Error(`no ${person} sessions left in worker slot ${info.parallelIndex}; raise SESSIONS`);
  writeFileSync(file, String(used + 1));
  return seed.people[person].refresh_tokens[info.parallelIndex * per + used];
}

async function serveFonts(context) {
  mkdirSync(FONTS, { recursive: true });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const url = route.request().url();
    const css = url.includes('fonts.googleapis.com');
    const file = resolve(FONTS, css ? `css-${createHash('sha256').update(url).digest('hex').slice(0, 16)}.css` : basename(new URL(url).pathname));
    if (!existsSync(file)) writeFileSync(file, await (await route.fetch()).body());
    await route.fulfill({
      status: 200,
      contentType: css ? 'text/css; charset=utf-8' : 'font/woff2',
      headers: { 'access-control-allow-origin': '*' },
      body: readFileSync(file),
    });
  });
}

async function withVercelHeaders(context) {
  await context.route((url) => url.origin === ORIGIN && !url.pathname.startsWith('/v1/'), async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...HEADERS } });
  });
}

/** Waits until fonts are in and no loading state is on screen. */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.skwrap, .skrow, .bootsplash, .thinking, .busy'), null, { timeout: 15_000 });
  await page.waitForTimeout(150);
}

export async function audit(page) {
  await page.evaluate(AUDIT);
  return page.evaluate(() => window.AUDIT());
}

export const test = base.extend({
  theme: ['light', { option: true }],
  seed: async ({}, use) => { await use(loadSeed()); },
  open: async ({ browser, theme, seed }, use, info) => {
    const contexts = [];
    const errors = [];
    const open = async (person, path = '/', options = {}) => {
      const view = options.view || {};
      const project = info.project.use;
      const context = await browser.newContext({
        baseURL: BASE,
        viewport: view.width ? { width: view.width, height: view.height } : project.viewport,
        colorScheme: (view.theme || theme) === 'dark' ? 'dark' : 'light',
        reducedMotion: 'reduce',
        locale: project.locale,
        timezoneId: project.timezoneId,
      });
      contexts.push(context);
      await serveFonts(context);
      await withVercelHeaders(context);
      await context.addInitScript(({ mode, tour }) => {
        try {
          localStorage.setItem('brain-theme', mode);
          if (tour) localStorage.setItem('brain-tour', JSON.stringify(tour));
        } catch (e) { /* storage unavailable */ }
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
      }, { mode: view.theme || theme, tour: person && !options.welcome ? [seed.people[person].id] : null });
      if (person) {
        await context.addCookies([{ name: 'broth_refresh', value: options.token || takeToken(seed, person, info), url: `${ORIGIN}/v1/auth`, httpOnly: true, secure: true, sameSite: 'Strict' }]);
      }
      if (options.setupSession) {
        await context.addCookies([{ name: 'broth_setup', value: options.setupSession, url: `${ORIGIN}/v1/setup/`, httpOnly: true, secure: true, sameSite: 'Strict' }]);
      }
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      if (options.before) await options.before(page);
      await page.goto(path);
      await settle(page);
      return page;
    };
    await use(open);
    for (const context of contexts) {
      for (const page of context.pages()) {
        const violations = await page.evaluate(() => window.__csp).catch(() => []);
        expect(violations, 'Content-Security-Policy violations').toEqual([]);
      }
      await context.close();
    }
    expect(errors, 'uncaught page errors').toEqual([]);
  },
  check: async ({}, use) => {
    await use(async (page, name, options = {}) => {
      await settle(page);
      const report = await audit(page);
      expect(report.lowTop, `${name}: low-contrast text`).toEqual([]);
      expect(report.smallTop, `${name}: tap targets under 24 px`).toEqual([]);
      expect(report.noLabel, `${name}: unlabelled controls`).toEqual([]);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        mask: (options.mask || []).map((s) => page.locator(s)),
        fullPage: !!options.fullPage,
      });
    });
  },
});
export { expect };
