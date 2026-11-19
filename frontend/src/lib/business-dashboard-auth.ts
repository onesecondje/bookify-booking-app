import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

export function canViewBusinessDashboard(authorization: string | null): boolean {
  const password = process.env.BOOKIFY_DASHBOARD_PASSWORD;
  const supplied = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization ?? '')?.[1];
  if (!password || password.length < 32 || !supplied) return false;

  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = Buffer.from(`business:${password}`).toString('base64');
  return timingSafeEqual(digest(supplied), digest(expected));
}
