import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password,salt,64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm,salt,expectedHex] = String(stored).split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const derived = Buffer.from(await scrypt(password,salt,64));
  const expected = Buffer.from(expectedHex,'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived,expected);
}
