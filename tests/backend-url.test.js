import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBackend} from '../src/backend-url.js';

test('login resolves the entered laptop backend, including whitespace and trailing slash', () => {
  assert.equal(normalizeBackend(' https://laptop.example.com/ '), 'https://laptop.example.com');
  assert.equal(normalizeBackend('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
});
test('reject credentials, paths and insecure remote endpoints before sending a password', () => {
  for (const url of ['https://user:pass@example.com','https://example.com/api','http://example.com','javascript:alert(1)','https://example.com?key=x']) {
    assert.throws(() => normalizeBackend(url));
  }
});
