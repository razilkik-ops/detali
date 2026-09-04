const fs = require('node:fs');
const path = require('node:path');
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

test('на страницах есть защищённая форма заявки и кнопка звонка', async () => {
  const paths = ['/', '/services/', '/contacts/', ...services.map((service) => `/services/${service.slug}/`)];
  for (const pagePath of paths) {
    const response = await fetch(`${origin}${pagePath}`);
    const html = await response.text();
    assert.equal(response.status, 200, pagePath);
    assert.match(html, /<form\b[^>]*data-request-form/iu, pagePath);
    assert.match(html, /enctype="multipart\/form-data"/iu, pagePath);
    assert.match(html, /type="file"[^>]*name="attachment"/iu, pagePath);
    assert.match(html, /data-attachment-preview/iu, pagePath);
    assert.match(html, /action="https:\/\/spetstehosnastka\.by\/api\/submit\.php"/iu, pagePath);
    assert.match(html, /data-request-open/iu, pagePath);
    assert.match(html, new RegExp(`href="tel:${company.mobileHref.replace('+', '\\+')}"`, 'u'), pagePath);
  }
});

test('PHP-обработчик не содержит секретов и загружает их вне public_html', () => {
  const handler = fs.readFileSync(path.join(__dirname, '../hosting/api/submit.php'), 'utf8');
  assert.match(handler, /getenv\('TELEGRAM_BOT_TOKEN'\)/u);
  assert.match(handler, /getenv\('TELEGRAM_CHAT_ID'\)/u);
  assert.match(handler, /dirname\(__DIR__, 2\).*telegram\.env/u);
  assert.match(handler, /parseEnvironmentFile/u);
  assert.match(handler, /MAX_ATTACHMENT_BYTES\s*=\s*15\s*\*\s*1024\s*\*\s*1024/u);
  assert.match(handler, /is_uploaded_file/u);
  assert.match(handler, /finfo_file/u);
  assert.match(handler, /new CURLFile/u);
  assert.match(handler, /sendTelegramAttachment/u);
  assert.doesNotMatch(handler, /\b\d{6,}:[A-Za-z0-9_-]{30,}\b/u);
  assert.doesNotMatch(handler, /bot_token'\s*=>\s*'[^']{30,}'/u);
});
