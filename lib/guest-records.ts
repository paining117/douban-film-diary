import { validateRecord, type FilmRecord } from './records';
export const guestKey='frame250.guest.v1';
export function readGuestRecords(): Record<string,FilmRecord> {
  const raw=localStorage.getItem(guestKey);
  if(!raw)return {};
  const data=JSON.parse(raw);
  if(!data || Array.isArray(data) || typeof data!=='object' || Object.keys(data).length>250)throw Error('游客记录格式异常，请先导出浏览器数据后再处理。');
  return Object.fromEntries(Object.entries(data).map(([id,value])=>{
    if(!/^\d{1,12}$/.test(id))throw Error('游客记录格式异常');
    return [id,validateRecord(value)];
  }));
}
export function writeGuestRecords(records:Record<string,FilmRecord>) {
  try { localStorage.setItem(guestKey,JSON.stringify(records)); }
  catch { throw Error('此浏览器无法保存游客记录，可能存储空间不足或被禁用。请导出备份或登录使用云端保存。'); }
}
