import { recordsDb } from '@/db/records';
import { validateRecord, normalizeWatchDate } from '@/lib/records';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  const user = request.headers.get('oai-authenticated-user-id');
  if (!user) return json({ error: '请登录后读取云端记录。' }, 401);
  const account = request.headers.get('oai-authenticated-user-email') || '';
  let accountName = request.headers.get('oai-authenticated-user-full-name') || '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { accountName = decodeURIComponent(accountName); } catch { accountName = ''; }
  }
  accountName = accountName.trim() || account.split('@')[0] || '已登录';
  try {
    const db=recordsDb();
    const { results } = await db.prepare('SELECT film_id, watched, wishlist, watch_date, rating, notes, updated_at FROM film_records WHERE user_id = ?').bind(user).all();
    const legacy=results.filter(r=>typeof r.watch_date==='string' && r.watch_date.length===10);
    if(legacy.length) {
      // Compare the old date so a concurrent save cannot be overwritten by migration.
      await db.batch(legacy.map(r=>db.prepare('UPDATE film_records SET watch_date = ? WHERE user_id = ? AND film_id = ? AND watch_date = ?').bind(normalizeWatchDate(String(r.watch_date)),user,r.film_id,r.watch_date)));
      for(const r of legacy)r.watch_date=normalizeWatchDate(String(r.watch_date));
    }
    return json({ account: account || '已登录账号', accountName, records: Object.fromEntries(results.map(r => [r.film_id, { watched: !!r.watched, wishlist: !!r.wishlist, watchDate: r.watch_date, rating: r.rating, notes: r.notes, updatedAt: r.updated_at }])) });
  } catch (e) { console.error('Load records failed', e); return json({ error: '云端记录暂时无法读取，请稍后重试。' }, 503); }
}
export async function PUT(request: Request) {
  const user = request.headers.get('oai-authenticated-user-id');
  if (!user) return json({ error: '请登录后保存云端记录。' }, 401);
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '不允许跨站写入。' }, 403);
  let entries;
  try {
    const text = await request.text();
    if (text.length > 3000000) throw new Error('备份文件过大。');
    const body = JSON.parse(text);
    if (!body.records || typeof body.records !== 'object' || Array.isArray(body.records)) throw new Error('记录格式不正确。');
    entries = Object.entries(body.records).map(([id, value]) => {
      if (!/^\d{1,12}$/.test(id)) throw new Error('电影编号不正确。');
      return [id, validateRecord(value)] as const;
    });
    if (!entries.length || entries.length > 250) throw new Error('一次可保存 1–250 部电影。');
  } catch (e) { return json({ error: e instanceof Error ? e.message : '记录格式不正确。' }, 400); }
  try {
    const db = recordsDb(); const now = new Date().toISOString();
    await db.batch(entries.map(([id, r]) => db.prepare(`INSERT INTO film_records (user_id,film_id,watched,wishlist,watch_date,rating,notes,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,film_id) DO UPDATE SET watched=excluded.watched,wishlist=excluded.wishlist,watch_date=excluded.watch_date,rating=excluded.rating,notes=excluded.notes,updated_at=excluded.updated_at`).bind(user,id,+r.watched,+r.wishlist,r.watchDate,r.rating,r.notes,now)));
    return json({ savedAt: now });
  } catch (e) { console.error('Save records failed', e); return json({ error: '保存失败，输入仍保留在页面中，请重试。' }, 503); }
}
