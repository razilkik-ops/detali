const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../server');

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

async function post(body, contentType = 'application/json') {
  return fetch(`${origin}/request`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Accept: 'application/json' },
    body
  });
}

test('endpoint заявки принимает корректные данные и отсекает злоупотребления', async () => {
  const validJson = await post(JSON.stringify({
    name: 'Алексей',
    contact: 'test@example.com',
    message: 'Нужен расчёт шестерни',
    consent: true
  }));
  assert.equal(validJson.status, 200);
  assert.equal((await validJson.json()).ok, true);

  const validForm = await post(
    new URLSearchParams({ name: 'Евгений', contact: '+375 44 784-41-93', consent: 'on' }),
    'application/x-www-form-urlencoded'
  );
  assert.equal(validForm.status, 200);

  const unsupported = await post('name=test', 'text/plain');
  assert.equal(unsupported.status, 415);
  assert.match(unsupported.headers.get('content-type'), /^application\/json/);

  const invalidContact = await post(JSON.stringify({ name: 'Тест', contact: '<script>', consent: true }));
  assert.equal(invalidContact.status, 422);

  const structuredField = await post(JSON.stringify({ name: { value: 'Тест' }, contact: 'test@example.com', consent: true }));
  assert.equal(structuredField.status, 422);

  const malformed = await post('{"name":', 'application/json');
  assert.equal(malformed.status, 400);

  const oversized = await post(JSON.stringify({
    name: 'Тест',
    contact: 'test@example.com',
    message: 'x'.repeat(40 * 1024),
    consent: true
  }));
  assert.equal(oversized.status, 413);

  const statuses = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await post(JSON.stringify({ name: 'Тест', contact: 'test@example.com', consent: true }));
    statuses.push(response.status);
  }
  assert.ok(statuses.includes(200), 'легитимная заявка должна проходить до исчерпания лимита');
  assert.ok(statuses.includes(429), 'после исчерпания лимита должен возвращаться HTTP 429');
});
