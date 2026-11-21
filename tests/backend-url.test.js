import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBackend, selectBackend, readApiJson} from '../src/backend-url.js';

test('login resolves the entered laptop backend, including whitespace and trailing slash', () => {
  assert.equal(normalizeBackend(' https://laptop.example.com/ '), 'https://laptop.example.com');
  assert.equal(normalizeBackend('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
});
test('laptop-hosted dashboard uses its current origin rather than a stored expired tunnel',()=>{
  assert.equal(selectBackend('https://live.trycloudflare.com','https://expired.trycloudflare.com'), 'https://live.trycloudflare.com');
  assert.equal(selectBackend('http://127.0.0.1:8080','https://expired.trycloudflare.com'), 'http://127.0.0.1:8080');
  assert.equal(selectBackend('https://rhremote.vercel.app','https://live.trycloudflare.com'), 'https://live.trycloudflare.com');
});
test('HTML errors are reported as an unavailable backend instead of a JSON parse error',async()=>{
  for(const status of [200,502])await assert.rejects(readApiJson(new Response('<!doctype html><title>Unavailable</title>',{status,headers:{'content-type':'text/html'}})),/alamat tunnel sudah berubah/);
  assert.deepEqual(await readApiJson(new Response('{"ahkBlocked":false}',{headers:{'content-type':'application/json'}})),{ahkBlocked:false});
  await assert.rejects(readApiJson(new Response('broken',{headers:{'content-type':'application/json'}})),/Respons backend rusak/);
});
test('reject credentials, paths and insecure remote endpoints before sending a password', () => {
  for (const url of ['https://user:pass@example.com','https://example.com/api','http://example.com','javascript:alert(1)','https://example.com?key=x']) {
    assert.throws(() => normalizeBackend(url));
  }
});
