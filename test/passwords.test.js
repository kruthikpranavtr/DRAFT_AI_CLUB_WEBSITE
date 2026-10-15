import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword,verifyPassword } from '../server/passwords.js';

test('passwords use salted scrypt hashes and verify without plaintext storage',async () => {
  const password = 'A-long-temporary-password-42!';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first,/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.notEqual(first,second);
  assert.equal(first.includes(password),false);
  assert.equal(await verifyPassword(password,first),true);
  assert.equal(await verifyPassword('wrong-password',first),false);
  assert.equal(await verifyPassword(password,'malformed'),false);
});
