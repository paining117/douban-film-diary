import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const values=new Map();let writes=0;
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{writes++;values.set(k,v);}};
function compile(file,imports={}) {
  const exports={};
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,{exports,require:name=>imports[name],localStorage,Date,JSON,Error,Object,Array,Number,RegExp,Response,URL,console});
  return exports;
}
const records=compile('lib/records.ts');
const base={watched:true,wishlist:false,watchDate:'',rating:8,notes:'Preserve my notes'};
// Use local calendar dates, including midnight when UTC is in a different month.
const checkedAt=new Date(2024,2,1,0,5);
const unchecked={...base,watched:false,wishlist:true};
const autoDated=records.setWatched(unchecked,true,checkedAt);
assert.equal(autoDated.watchDate,'2024-03');
assert.equal(autoDated.wishlist,false);
assert.equal(autoDated.notes,base.notes);assert.equal(autoDated.rating,8);
assert.equal(unchecked.watchDate,'','Do not mutate the previous record');
assert.equal(records.isWatchedInMonth(autoDated,'2024-03'),true);
for(const date of ['2022','2024-02'])assert.equal(records.setWatched({...unchecked,watchDate:date},true,checkedAt).watchDate,date);
assert.equal(records.setWatched(autoDated,false,checkedAt).watchDate,'2024-03');
assert.equal(records.validateRecord({...autoDated,watchDate:''}).watchDate,'','Manually clearing an optional date must survive saving');
assert.equal(records.currentWatchMonth(new Date(2024,11,31,23,59)),'2024-12');
assert.equal(records.currentWatchMonth(new Date(2025,0,1,0,1)),'2025-01');
for(const date of ['', '1999','2024-02','2024-02-29'])assert.equal(records.validDate(date),true,date);
for(const date of ['0000','24','2024-2','2024-00','2024-13','2023-02-29','2024-02-30','9999','9999-01'])assert.equal(records.validDate(date),false,date);
assert.equal(records.validateRecord({...base,watchDate:'2024-02-29'}).watchDate,'2024-02');
assert.equal(records.validateRecord({...base,watchDate:'2024'}).watchDate,'2024');
assert.equal(records.isWatchedInMonth({...base,watchDate:'2024'},'2024-02'),false);
assert.equal(records.isWatchedInMonth({...base,watchDate:'2024-02'},'2024-02'),true);
assert.equal(records.isWatchedInMonth({...base,watchDate:'2024-02-29'},'2024-02'),true);
assert.equal(records.isWatchedInMonth({...base,watched:false,watchDate:'2024-02'},'2024-02'),false);
assert.equal(records.isWatchedInMonth({...base,watchDate:'2024-01'},'2024-02'),false);
assert.equal(records.isWatchedInMonth(undefined,'2024-02'),false);

const guest=compile('lib/guest-records.ts',{'./records':records});
const legacy={...base,watchDate:'2024-02-29',updatedAt:'2024-03-01T00:00:00Z'};
values.set(guest.guestKey,JSON.stringify({'1292052':legacy}));
assert.equal(guest.readGuestRecords()['1292052'].watchDate,'2024-02');
assert.deepEqual(JSON.parse(values.get(guest.guestKey))['1292052'],{...legacy,watchDate:'2024-02'});
guest.readGuestRecords();assert.equal(writes,1,'Migration must be idempotent');

// Exercise the actual API handlers and SQL against SQLite, with a D1-shaped adapter.
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('drizzle/0000_colossal_vector.sql','utf8'));
let beforeBatch=null;
const db={prepare(sql){return {bind(...args){return {sql,args,async all(){return {results:sqlite.prepare(sql).all(...args)};}};}};},async batch(statements){if(beforeBatch){const action=beforeBatch;beforeBatch=null;action();}return statements.map(s=>sqlite.prepare(s.sql).run(...s.args));}};
const api=compile('app/api/records/route.ts',{'@/lib/records':records,'@/db/records':{recordsDb:()=>db}});
const insert=sqlite.prepare('INSERT INTO film_records VALUES (?,?,?,?,?,?,?,?)');
for(const user of ['a','b'])insert.run(user,'1292052',1,0,legacy.watchDate,8,legacy.notes,legacy.updatedAt);
const read=user=>sqlite.prepare('SELECT * FROM film_records WHERE user_id=?').get(user);
function request(user,body){return new Request('https://example.test/api/records',{method:body?'PUT':'GET',headers:user?{'oai-authenticated-user-id':user,'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});}
assert.equal((await api.GET(request(null))).status,401);
const got=await (await api.GET(request('a'))).json();
assert.equal(got.records['1292052'].watchDate,'2024-02');
assert.equal(read('a').watch_date,'2024-02');assert.equal(read('b').watch_date,'2024-02-29');
assert.equal(read('a').notes,legacy.notes);assert.equal(read('a').rating,8);assert.equal(read('a').updated_at,legacy.updatedAt);
// Another save occurring after SELECT must survive the conditional migration.
beforeBatch=()=>sqlite.prepare('UPDATE film_records SET watch_date=? WHERE user_id=?').run('2023','b');
await api.GET(request('b'));assert.equal(read('b').watch_date,'2023');
for(const [input,expected] of [['2022','2022'],['2024-02','2024-02'],['2024-02-29','2024-02']]){
  const put=await api.PUT(request('a',{records:{'1292052':{...base,watchDate:input}}}));
  assert.equal(put.status,200);assert.equal(read('a').watch_date,expected);
}
const before=read('a');
assert.equal((await api.PUT(request('a',{records:{'1292052':{...base,watchDate:'2024-02-30'}}}))).status,400);
assert.deepEqual(read('a'),before);
sqlite.close();
console.log('Date checks passed: year/month precision, legacy backups, monthly inclusion, guest migration, API roundtrips, SQLite migration isolation and concurrent-save preservation.');
