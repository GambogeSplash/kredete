// Sign-in, boot paths and the first-run welcome (sandbox spec 4.1, 4.2; plan C2.1).
// Real Google sign-in cannot be automated: the refusals are reached through their redirects.
import { expect, test } from './fixtures.mjs';

const REASONS = {
  not_provisioned: 'You do not have access yet',
  suspended: 'Your access is paused',
  wrong_domain: 'That is not a Kredete account',
  email_not_verified: 'Google has not verified that email address',
  invalid_state: 'That sign-in expired',
  invalid_token: 'Google could not confirm who you are',
  provider_error: 'Google did not finish the sign-in',
  something_new: 'Sign-in did not work',
};

test('the sign-in screen', async ({ open, check }) => {
  const page = await open(null, '/signin');
  await expect(page.getByRole('heading', { name: 'Sign in to Kredete' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', '/v1/auth/google/start');
  await check(page, 'signin');
});

test('every sign-in refusal has its own message', async ({ open, check }) => {
  for (const [reason, message] of Object.entries(REASONS)) {
    const page = await open(null, `/signin?error=${reason}`);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page).toHaveURL(/\/signin$/); // the message stays, the query goes
    if (reason === 'not_provisioned') await check(page, 'signin-refused');
    if (reason === 'something_new') await check(page, 'signin-unknown-reason');
    await page.close();
  }
});

test('a refusal names the Google account it refused', async ({ open, check }) => {
  // The server puts the address in the fragment, which never reaches a server or a log.
  const page = await open(null, '/signin?error=not_provisioned#email=zoe.smith%2Bbrain%40kredete.com');
  await expect(page.getByRole('alert')).toContainText('You do not have access yet');
  await expect(page.getByRole('alert')).toContainText('Google account: zoe.smith+brain@kredete.com');
  await expect(page).toHaveURL(/\/signin$/); // query and fragment both go
  await check(page, 'signin-refused-account');
  await page.close();

  const marked = await open(null, '/signin?error=suspended#email=%3Cb%3Eeve%3C%2Fb%3E%40example.test');
  await expect(marked.getByRole('alert')).toContainText('Google account: <b>eve</b>@example.test');
  await expect(marked.locator('#aerr b')).toHaveCount(1); // only the heading is bold: the address is text
  await marked.close();

  const plain = await open(null, '/signin?error=not_provisioned');
  await expect(plain.getByRole('alert')).not.toContainText('Google account:');
});

test('any other page sends a signed-out visitor to sign in', async ({ open }) => {
  const page = await open(null, '/library');
  await expect(page).toHaveURL(/\/signin$/);
});

test('workspace mode: no setup endpoints, straight to sign-in', async ({ open, check }) => {
  const page = await open(null, '/', {
    before: (p) => p.route('**/v1/setup/status', (route) => route.fulfill({ status: 404, contentType: 'application/problem+json', body: '{"title":"Not found","status":404}' })),
  });
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText('Continue with your Kredete Google account.')).toBeVisible();
  await check(page, 'signin-workspace');
});

test('when Broth cannot be reached, the boot screen offers a retry', async ({ open, check }) => {
  let fail = true;
  const page = await open(null, '/', {
    before: (p) => p.route('**/v1/setup/status', (route) => (fail ? route.fulfill({ status: 502, body: 'Bad gateway' }) : route.continue())),
  });
  await expect(page.getByRole('heading', { name: 'Broth could not be reached' })).toBeVisible();
  await expect(page.getByText('Check your connection and try again.')).toBeVisible();
  await check(page, 'boot-error');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Kredete' })).toBeVisible();
});

test('when Broth answers with a problem of its own, the boot screen shows it', async ({ open }) => {
  const page = await open(null, '/', {
    before: (p) => p.route('**/v1/setup/status', (route) => route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Broth is updating. Try again in a minute.', status: 503 }),
    })),
  });
  await expect(page.getByRole('heading', { name: 'Broth could not start' })).toBeVisible();
  await expect(page.getByText('Broth is updating. Try again in a minute.')).toBeVisible();
});

test('the first-run welcome', async ({ open, check, seed }) => {
  const page = await open('compliance', '/', { welcome: true });
  await expect(page.getByRole('heading', { name: 'Is this you?' })).toBeVisible();
  await expect(page.getByText(seed.people.compliance.email)).toBeVisible();
  await check(page, 'welcome-1');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'How should it look?' })).toBeVisible();
  await check(page, 'welcome-2');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What Broth can read for you' })).toBeVisible();
  await expect(page.getByText('Confluence')).toBeVisible();
  await check(page, 'welcome-3');
  await page.getByRole('button', { name: 'Start asking' }).click();
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeVisible(); // not shown again
});
