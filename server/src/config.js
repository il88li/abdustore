import { createHash } from 'node:crypto';
const weak = value => !value || value.length < 32 || /CHANGE|GENERATE|YOUR_/i.test(value);
export function getJwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!weak(value)) return value;
  // Fallback so the app works with only DATABASE_URL set: derived from the private database URL.
  if (process.env.DATABASE_URL) return createHash('sha256').update('hipe-store-jwt:' + process.env.DATABASE_URL).digest('hex');
  throw new Error('JWT_SECRET is not configured');
}
