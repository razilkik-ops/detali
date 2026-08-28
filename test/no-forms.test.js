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

test('сайт не содержит форм и ведёт на телефон', async () => {
  const paths = ['/', '/services/', '/contacts/', ...services.map((service) => `/services/${service.slug}/`)];
  for (const pagePath of paths) {
    const response = await fetch(`${origin}${pagePath}`);
    const html = await response.text();
    assert.equal(response.status, 200, pagePath);
    assert.doesNotMatch(html, /<form\b/iu, pagePath);
    assert.doesNotMatch(html, /data-(?:open-)?request|\/request\b/iu, pagePath);
    assert.match(html, new RegExp(`href="tel:${company.mobileHref.replace('+', '\\+')}"`, 'u'), pagePath);
  }
});

test('endpoint приёма заявок отсутствует', async () => {
  const response = await fetch(`${origin}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Тест', contact: '+375291234567' })
  });
  assert.equal(response.status, 404);
});
