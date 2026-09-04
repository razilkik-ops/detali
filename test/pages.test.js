const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../server');
const { services } = require('../data/services');
const company = require('../data/company');

let server;
let origin;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('динамические страницы и SEO-файлы отдаются без ошибок', async () => {
  const paths = ['/', '/services/', '/contacts/', '/privacy/', ...services.map((service) => `/services/${service.slug}/`)];
  for (const pagePath of paths) {
    const response = await fetch(`${origin}${pagePath}`);
    const html = await response.text();
    assert.equal(response.status, 200, pagePath);
    assert.match(html, /<title>[^<]+<\/title>/u, pagePath);
    assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/u, pagePath);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" sizes="180x180">/u, pagePath);
    assert.match(html, /<link rel="manifest" href="\/site\.webmanifest">/u, pagePath);
    assert.equal((html.match(/<h1(?:\s|>)/gu) || []).length, 1, pagePath);
    const contentSecurityPolicy = response.headers.get('content-security-policy') || '';
    assert.match(contentSecurityPolicy, /default-src 'self'/u, pagePath);
    assert.match(contentSecurityPolicy, /form-action 'self' https:\/\/spetstehosnastka\.by/u, pagePath);
  }

  for (const assetPath of ['/favicon.ico', '/apple-touch-icon.png', '/images/favicon-16x16.png', '/images/favicon-32x32.png', '/images/android-chrome-192x192.png', '/images/android-chrome-512x512.png', '/site.webmanifest', '/browserconfig.xml']) {
    const asset = await fetch(`${origin}${assetPath}`);
    assert.equal(asset.status, 200, assetPath);
  }

  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  assert.match(robots, /Sitemap:/u);
  assert.doesNotMatch(robots, /Disallow:\s*\/privacy/u);

  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.equal((sitemap.match(/<url>/gu) || []).length, 3 + services.length);
  assert.equal((sitemap.match(/<lastmod>2026-09-03<\/lastmod>/gu) || []).length, 3 + services.length);

  const renamedService = await fetch(`${origin}/services/grinding-bending/`, { redirect: 'manual' });
  assert.equal(renamedService.status, 301);
  assert.equal(renamedService.headers.get('location'), '/services/grinding-polishing/');

  const contacts = await (await fetch(`${origin}/contacts/`)).text();
  assert.ok(contacts.indexOf(`<small>${company.mobileName}</small>`) < contacts.indexOf(`<small>${company.phoneName}</small>`));

  for (const token of ['e8ef4bca1be3bbc5', '533d69dd42471b38', 'db77f3e3f2bc0312']) {
    const yandexVerification = await fetch(`${origin}/yandex_${token}.html`);
    assert.equal(yandexVerification.status, 200);
    assert.match(await yandexVerification.text(), new RegExp(`<body>Verification: ${token}<\\/body>`, 'u'));
  }
});
