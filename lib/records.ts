export type FilmRecord = { watched: boolean; wishlist: boolean; watchDate: string; rating: number; notes: string; updatedAt?: string };
export const blankRecord: FilmRecord = { watched: false, wishlist: false, watchDate: '', rating: 0, notes: '' };
export function validDate(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}
export function validateRecord(value: unknown): FilmRecord {
  const r = value as FilmRecord;
  if (!r || typeof r.watched !== 'boolean' || typeof r.wishlist !== 'boolean' || !validDate(r.watchDate) || !Number.isInteger(r.rating) || r.rating < 0 || r.rating > 10 || typeof r.notes !== 'string' || r.notes.length > 10000) throw new Error('记录格式不正确，请检查日期、评分和笔记。');
  return { watched:r.watched, wishlist:r.wishlist, watchDate:r.watchDate, rating:r.rating, notes:r.notes };
}
