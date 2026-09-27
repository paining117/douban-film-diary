import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8787';
const endpoint=origin+'/api/records';
const suffix=Date.now();
const a=`qa-film-a-${suffix}`,b=`qa-film-b-${suffix}`;
let passed=0;
async function call(user,method='GET',records,extra={}){
  const response=await fetch(endpoint,{method,signal:AbortSignal.timeout(15000),headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`}:{}),...(records?{'Content-Type':'application/json'}:{}),...extra},...(records?{body:JSON.stringify({records})}:{})});
  return {status:response.status,data:await response.json()};
}
function ok(check){assert.ok(check,`Check ${passed+1} failed`);passed++;console.log(`Passed ${passed}`);}
const base={watched:true,wishlist:false,watchDate:'',rating:8,notes:'很好看。\n<script>纯文本笔记</script>'};
ok((await call(null)).status===401);
ok((await call(null,'PUT',{'1292052':base})).status===401);
ok((await call(a)).data.records && Object.keys((await call(a)).data.records).length===0);
ok((await call(a,'PUT',{'1292052':base},{Origin:origin})).status===200);
let saved=(await call(a)).data.records['1292052'];
ok(saved.watched&&saved.watchDate===''&&saved.rating===8&&saved.notes===base.notes);
ok(!(await call(b)).data.records['1292052']);
ok((await call(b,'PUT',{'1292052':{...base,rating:4,notes:'独立账号记录'}})).status===200);
ok((await call(a)).data.records['1292052'].rating===8);
ok((await call(a,'PUT',{'1292052':{...base,watched:false}})).status===200);
saved=(await call(a)).data.records['1292052'];
ok(saved.watched===false&&saved.rating===8&&saved.notes===base.notes);
ok((await call(a,'PUT',{'1292052':{...base,watchDate:'2026-02-30'}})).status===400);
ok((await call(a,'PUT',{'1292052':{...base,rating:11}})).status===400);
ok((await call(a,'PUT',{'1292052':{...base,notes:'x'.repeat(10001)}})).status===400);
ok((await call(a,'PUT',{'1292052':base},{Origin:'https://foreign.example'})).status===403);
ok((await call(a,'PUT',{'1292052':{...base,rating:9},'1291546':{...base,rating:-1}})).status===400);
ok((await call(a)).data.records['1292052'].rating===8);
ok((await call(a,'PUT',{'1292052':{...base,watchDate:'2025-06-08'},'1291546':{...base,wishlist:true,watched:false}})).status===200);
saved=(await call(a)).data.records;
ok(saved['1292052'].watchDate==='2025-06'&&saved['1291546'].wishlist);
ok((await call(b)).data.records['1292052'].notes==='独立账号记录');
console.log(JSON.stringify({passed,accounts:[a,b],scope:'Local production Worker and local D1; platform sign-in and physical cross-device access are not covered'}));
