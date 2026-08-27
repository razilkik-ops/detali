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
    assert.equal((html.match(/<h1(?:\s|>)/gu) || []).length, 1, pagePath);
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/u, pagePath);
  }

  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  assert.match(robots, /Sitemap:/u);
  assert.doesNotMatch(robots, /Disallow:\s*\/privacy/u);

  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.equal((sitemap.match(/<url>/gu) || []).length, 3 + services.length);
  assert.equal((sitemap.match(/<lastmod>2026-08-27<\/lastmod>/gu) || []).length, 3 + services.length);

  const renamedService = await fetch(`${origin}/services/grinding-bending/`, { redirect: 'manual' });
  assert.equal(renamedService.status, 301);
  assert.equal(renamedService.headers.get('location'), '/services/grinding-polishing/');

  const contacts = await (await fetch(`${origin}/contacts/`)).text();
  assert.ok(contacts.indexOf(`<small>${company.mobileName}</small>`) < contacts.indexOf(`<small>${company.phoneName}</small>`));
});
