export type FilmRecord = { watched: boolean; wishlist: boolean; watchDate: string; rating: number; notes: string; updatedAt?: string };
export const blankRecord: FilmRecord = { watched: false, wishlist: false, watchDate: '', rating: 0, notes: '' };
export function currentWatchMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
export function setWatched(record: FilmRecord, watched: boolean, now = new Date()): FilmRecord {
  return { ...record, watched, ...(watched ? { wishlist:false, watchDate:record.watchDate || currentWatchMonth(now) } : {}) };
}
export function validDate(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value) || Number(value.slice(0,4)) < 1) return false;
  const now = new Date();
  const month = currentWatchMonth(now);
  if (value.length === 4) return value <= month.slice(0,4);
  if (Number(value.slice(5,7)) < 1 || Number(value.slice(5,7)) > 12 || value.slice(0,7) > month) return false;
  if (value.length === 7) return true;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
// Retain compatibility with older backups while storing no day precision.
export function normalizeWatchDate(value: string): string { return value.length === 10 ? value.slice(0,7) : value; }
export function isWatchedInMonth(record: FilmRecord | undefined, month: string): boolean {
  return !!record?.watched && normalizeWatchDate(record.watchDate) === month;
}
export function validateRecord(value: unknown): FilmRecord {
  const r = value as FilmRecord;
  if (!r || typeof r.watched !== 'boolean' || typeof r.wishlist !== 'boolean' || !validDate(r.watchDate) || !Number.isInteger(r.rating) || r.rating < 0 || r.rating > 10 || typeof r.notes !== 'string' || r.notes.length > 10000) throw new Error('记录格式不正确，请检查日期、评分和笔记。');
  return { watched:r.watched, wishlist:r.wishlist, watchDate:normalizeWatchDate(r.watchDate), rating:r.rating, notes:r.notes };
}
