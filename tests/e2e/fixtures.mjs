// Shared fixtures for the browser suite.
//
// - open(person, path, options): a page signed in as a seeded person (their refresh cookie,
//   from a pool split by worker, since each token is single use), in the project's viewport and
//   theme, with the welcome tour done unless asked for. Every response from the client gets the
//   security headers from vercel.json, and any Content-Security-Policy violation fails the test.
//   Google Fonts come from tests/e2e/fonts (fetched once, then committed), so runs are hermetic.
// - check(page, name, options): waits for loading states to finish, asserts that the page does
//   not scroll sideways and that tools/audit.js finds no low-contrast text, no tap target under 24 px and no unlabelled control, then
//   compares a screenshot. Masks cover only what changes from run to run: every rendered date
//   is a <time> and always masked, and so is the sidebar's chat list (scenarios add chats in
//   parallel, and its day groups move with the clock) unless `chats: true` says the test made it
//   fixed. Toasts are asserted by the tests that raise them and hidden from the comparison.
//   `loading: true` is for screens meant to show a loading state.
import { test as base, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { BASE, ROOT, SESSIONS, STATE, WORKERS, loadSeed } from './stack.mjs';

const VERCEL = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
const HEADERS = Object.fromEntries(VERCEL.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
const AUDIT = readFileSync(resolve(ROOT, 'tools/audit.js'), 'utf8');
const SCREENSHOT_CSS = resolve(ROOT, 'tests/e2e/screenshot.css');
const FONTS = resolve(ROOT, 'tests/e2e/fonts');
const COUNTERS = resolve(STATE, 'tokens');
const ORIGIN = new URL(BASE).origin;
const HOST = new URL(BASE).hostname;

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

/** A request the page dropped (it reloaded or closed) while a route was answering it. */
const gone = (error) => /disposed|has been closed|Request context|Route is already handled/i.test(String(error && error.message));
/** Runs a route handler, ignoring only a request that went away under it. */
const handle = (fn) => async (route) => {
  try { await fn(route); } catch (error) { if (!gone(error)) throw error; }
};

async function serveFonts(context) {
  mkdirSync(FONTS, { recursive: true });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handle(async (route) => {
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
  }));
}

async function withVercelHeaders(context) {
  await context.route((url) => url.origin === ORIGIN && !url.pathname.startsWith('/v1/'), handle(async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...HEADERS } });
  }));
}

/** Waits until fonts are in and, unless the screen is meant to show one, no loading state is on screen. */
export async function settle(page, { loading = false } = {}) {
  await page.evaluate(() => document.fonts.ready);
  // Data that fills in after the first render (source counts, names, the chat list) has arrived.
  if (!loading) await page.waitForLoadState('networkidle', { timeout: 15_000 });
  if (!loading) await page.waitForFunction(() => !document.querySelector('.skwrap, .skrow, .bootsplash, .thinking, .busy'), null, { timeout: 15_000 });
  await page.waitForTimeout(150);
}

export async function audit(page) {
  await page.evaluate(AUDIT);
  return page.evaluate(() => window.AUDIT());
}

/**
 * Marks the elements to mask: only those that show. A mask paints over an element's whole
 * box, even where something covers it, so it would hide the menu, drawer or page on top. An
 * element shows if at least half of it is on screen across and nothing opaque covers its
 * middle; a see-through backdrop does not hide what is under it.
 */
function markMasks(page, selectors) {
  return page.evaluate((list) => {
    document.querySelectorAll('[data-e2e-mask]').forEach((e) => e.removeAttribute('data-e2e-mask'));
    const opaque = (e) => {
      const cs = getComputedStyle(e);
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      const alpha = m ? Number(m[1].split(',')[3] ?? 1) : 0;
      return alpha > 0.9 || cs.backgroundImage !== 'none';
    };
    const shows = (el) => {
      const r = el.getBoundingClientRect();
      const across = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
      if (!r.width || !r.height || across < r.width / 2) return false;
      if (r.bottom <= 0 || r.top >= innerHeight) return false;
      const x = (Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2;
      const y = (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return true;
      for (let e = hit; e && !e.contains(el); e = e.parentElement) if (opaque(e)) return false;
      return true;
    };
    for (const el of list.flatMap((s) => [...document.querySelectorAll(s)])) if (shows(el)) el.setAttribute('data-e2e-mask', '');
  }, selectors);
}

/** Text and controls that are partly outside the viewport, unless they sit in something that scrolls sideways. */
export function clipped(page) {
  return page.evaluate(() => {
    const W = innerWidth;
    const scrollsSideways = (el) => {
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth) return true;
      }
      return false;
    };
    const readable = (el) => /^(INPUT|BUTTON|SELECT|TEXTAREA|A)$/.test(el.tagName) || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    /** On top where it shows: a closed phone menu tucked under the page is covered, not cut off. */
    const onTop = (el, r) => {
      const x = (Math.max(r.left, 0) + Math.min(r.right, W)) / 2;
      const y = Math.min(Math.max((r.top + r.bottom) / 2, 0), innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      return !!hit && (el === hit || el.contains(hit));
    };
    return [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.right <= 0 || r.left >= W) return false; // empty or wholly off screen (closed drawers)
      if (r.left >= -0.5 && r.right <= W + 0.5) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0' && readable(el) && !scrollsSideways(el) && onTop(el, r);
    }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)} "${(el.textContent || '').trim().slice(0, 24)}"`);
  });
}

export const test = base.extend({
  theme: ['light', { option: true }],
  seed: async ({}, use) => { await use(loadSeed()); },
  // The seed is read when a page opens, not when the test starts: the wizard seeds its own states.
  open: async ({ browser, theme }, use, info) => {
    const contexts = [];
    const errors = [];
    const open = async (person, path = '/', options = {}) => {
      const seed = person ? loadSeed() : null;
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
        // The exact path the API sets: with another path the browser would keep both after rotation.
        await context.addCookies([{ name: 'broth_refresh', value: options.token || takeToken(seed, person, info), domain: HOST, path: '/v1/auth', httpOnly: true, secure: true, sameSite: 'Strict' }]);
      }
      if (options.setupSession) {
        await context.addCookies([{ name: 'broth_setup', value: options.setupSession, domain: HOST, path: '/v1/setup/', httpOnly: true, secure: true, sameSite: 'Strict' }]);
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
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
    }
    expect(errors, 'uncaught page errors').toEqual([]);
  },
  check: async ({}, use) => {
    await use(async (page, name, options = {}) => {
      await settle(page, { loading: !!options.loading });
      const report = await audit(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${name}: horizontal scroll`).toBeLessThanOrEqual(0);
      expect(await clipped(page), `${name}: text or controls cut off at the screen edge`).toEqual([]);
      expect(report.lowTop, `${name}: low-contrast text`).toEqual([]);
      expect(report.smallTop, `${name}: tap targets under 24 px`).toEqual([]);
      expect(report.noLabel, `${name}: unlabelled controls`).toEqual([]);
      await markMasks(page, ['time', ...(options.chats ? [] : ['#srec']), ...(options.mask || [])]);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        mask: [page.locator('[data-e2e-mask]')],
        stylePath: SCREENSHOT_CSS,
      });
    });
  },
});
export { expect };
