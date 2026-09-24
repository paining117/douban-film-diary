import { env } from 'cloudflare:workers';
export function recordsDb() {
  if (!env.DB) throw new Error('Cloud storage unavailable');
  return env.DB;
}
