'use client';

import { useEffect, useRef, useState } from 'react';
import { Film, Search, Bookmark, Check, ArrowUpRight, Shuffle, Download, Upload, Cloud, BookOpen, X, Star, SlidersHorizontal, RotateCw, CalendarDays, UserRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster, toast } from 'sonner';
import { blankRecord, validateRecord, isWatchedInMonth, currentWatchMonth, setWatched, type FilmRecord } from '@/lib/records';
import { readGuestRecords, writeGuestRecords, guestKey } from '@/lib/guest-records';

type Movie = { id:string; rank:number; title:string; originalTitle:string; year:string; countries:string; genres:string[]; credits:string; rating:number; ratingCount:number; poster:string; url:string };
type Records = Record<string,FilmRecord>;
type Tab = 'all'|'watched'|'wishlist';
const labels: Record<Tab,string> = { all:'电影榜单', watched:'我的已看', wishlist:'想看清单' };
function Picker({ value, change, label, options, disabled=false }: { value:string; change:(v:string)=>void; label:string; options:[string,string][]; disabled?:boolean }) {
  return <Select value={value} onValueChange={change} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v,t])=><SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent></Select>;
}
function Poster({ movie, eager=false }: { movie:Movie; eager?:boolean }) {
  const [failed,setFailed]=useState(false);
  return failed ? <div className="poster-failed"><Film/><span>{movie.title}</span><small>海报暂不可用</small></div> : <img src={movie.poster} alt={`${movie.title}电影海报`} loading={eager?'eager':'lazy'} onError={()=>setFailed(true)}/>;
}
export default function FilmDiary() {
  const [movies,setMovies]=useState<Movie[]>([]), [sourceDate,setSourceDate]=useState('');
  const [records,setRecords]=useState<Records>({}), [ready,setReady]=useState(false), [loading,setLoading]=useState(true);
  const [account,setAccount]=useState(''), [accountOpen,setAccountOpen]=useState(false);
  const [accountName,setAccountName]=useState('');
  const [mode,setMode]=useState<'loading'|'guest'|'cloud'>('loading');
  const [monthOpen,setMonthOpen]=useState(false);
  const monthTrigger=useRef<HTMLButtonElement>(null);
  const [error,setError]=useState(''), [authRequired,setAuthRequired]=useState(false), [dataError,setDataError]=useState(false);
  const [tab,setTab]=useState<Tab>('all'), [query,setQuery]=useState(''), [range,setRange]=useState('250'), [genre,setGenre]=useState('all'), [status,setStatus]=useState('all'), [sort,setSort]=useState('rank'), [limit,setLimit]=useState(30);
  const [selected,setSelected]=useState<Movie|null>(null), [draft,setDraft]=useState<FilmRecord>(blankRecord), [saving,setSaving]=useState(false), [dirty,setDirty]=useState(false);
  const [pending,setPending]=useState<Set<string>>(new Set()), [backup,setBackup]=useState(false), [imported,setImported]=useState<Records|null>(null), [discard,setDiscard]=useState(false);
  const busy=useRef(false), pendingIds=useRef(new Set<string>()), fileInput=useRef<HTMLInputElement>(null), recordsRef=useRef(records);
  recordsRef.current=records;
  async function loadRecords() {
    if(busy.current || pendingIds.current.size) return;
    try {
      const r=await fetch('/api/records',{cache:'no-store'}); const data=await r.json() as { records:Records; account:string; accountName?:string; error?:string };
      if(r.status===401) {
        const guest=readGuestRecords();setRecords(guest);setMode('guest');setAccount('');setAccountName('');setReady(true);setError('');setAuthRequired(false);return;
      }
      if(!r.ok) { setAuthRequired(false); throw new Error(data.error || '无法读取云端记录'); }
      if(busy.current || pendingIds.current.size) return;
      setRecords(data.records); setMode('cloud'); setAccount(data.account); setAccountName(data.accountName||data.account.split('@')[0]||'已登录'); setReady(true); setError(''); setAuthRequired(false);
    } catch(e) { setError(e instanceof Error?e.message:'无法连接云端'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{
    fetch('/movies.json').then(r=>{if(!r.ok)throw Error(); return r.json() as Promise<{movies:Movie[];fetchedAt:string}>;}).then(data=>{setMovies(data.movies);setSourceDate(data.fetchedAt.slice(0,10));}).catch(()=>setDataError(true));
    void loadRecords();
    const refresh=()=>{if(document.visibilityState==='visible')void loadRecords();};
    const storageRefresh=(e:StorageEvent)=>{if(e.key===guestKey)refresh();};
    window.addEventListener('storage',storageRefresh);
    document.addEventListener('visibilitychange',refresh); window.addEventListener('focus',refresh);
    return ()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('storage',storageRefresh);};
  },[]);
  useEffect(()=>{setLimit(30);},[tab,query,range,genre,status,sort]);
  useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty||saving){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,saving]);
  async function persist(changes:Records) {
    changes=Object.fromEntries(Object.entries(changes).map(([id,r])=>[id,validateRecord(r)]));
    if(mode==='guest') {
      const now=new Date().toISOString();
      const saved=Object.fromEntries(Object.entries(changes).map(([id,v])=>[id,{...v,updatedAt:now}]));
      const merged={...readGuestRecords(),...saved};
      writeGuestRecords(merged);setRecords(merged);return;
    }
    const r=await fetch('/api/records',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:changes})});
    const data=await r.json() as { savedAt:string; error?:string }; if(!r.ok) throw new Error(data.error || '保存失败，请重试');
    const saved=Object.fromEntries(Object.entries(changes).map(([id,v])=>[id,{...v,updatedAt:data.savedAt}]));
    setRecords(prev=>({...prev,...saved}));
  }
  async function toggle(movie:Movie,field:'watched'|'wishlist') {
    if(!ready || pendingIds.current.has(movie.id) || busy.current)return;
    pendingIds.current.add(movie.id);setPending(new Set(pendingIds.current));
    const old=recordsRef.current[movie.id]||blankRecord;
    const value=field==='watched'?setWatched(old,!old.watched):{...old,wishlist:!old.wishlist};
    try { await persist({[movie.id]:value}); toast.success(field==='watched'?(value.watched?'已标记看过 · 可以修改观看日期与感受':'已取消看过，原有笔记和评分已保留'):(value.wishlist?'已加入想看清单':'已移出想看清单')); }
    catch(e){toast.error(e instanceof Error?e.message:'保存失败，请重试');}
    finally{pendingIds.current.delete(movie.id);setPending(new Set(pendingIds.current));}
  }
  function openMovie(m:Movie){setSelected(m);setDraft({...blankRecord,...recordsRef.current[m.id]});setDirty(false);}
  function changeDraft(p:Partial<FilmRecord>){setDraft(d=>({...d,...p}));setDirty(true);}
  function changeWatchedDraft(watched:boolean){setDraft(d=>setWatched(d,watched));setDirty(true);}
  async function saveDraft(){
    if(!selected||saving||!ready)return;
    try { const value=validateRecord(draft);busy.current=true;setSaving(true);await persist({[selected.id]:value});setDirty(false);setSelected(null);toast.success(mode==='guest'?'观影记录已保存在当前浏览器':'观影记录已保存到云端'); }
    catch(e){toast.error(e instanceof Error?e.message:'保存失败，输入已保留');}
    finally{busy.current=false;setSaving(false);}
  }
  function closeMovie(){if(saving)return;if(dirty)setDiscard(true);else setSelected(null);}
  const watched=movies.filter(m=>records[m.id]?.watched), wished=movies.filter(m=>records[m.id]?.wishlist), top100=watched.filter(m=>m.rank<=100).length, top50=watched.filter(m=>m.rank<=50).length;
  const month=currentWatchMonth();
  const monthlyMovies=watched.filter(m=>isWatchedInMonth(records[m.id],month)).sort((a,b)=>a.rank-b.rank), monthly=monthlyMovies.length;
  const filtered=movies.filter(m=>{
    const r=records[m.id]||blankRecord;
    return (tab==='all'||(tab==='watched'?r.watched:r.wishlist)) && m.rank<=Number(range) && (genre==='all'||m.genres.includes(genre)) && (status==='all'||(status==='watched'?r.watched:!r.watched)) && `${m.title} ${m.originalTitle} ${m.credits} ${m.year}`.toLowerCase().includes(query.toLowerCase().trim());
  }).sort((a,b)=>sort==='rating'?b.rating-a.rating||a.rank-b.rank:sort==='date'?(records[b.id]?.watchDate||'').localeCompare(records[a.id]?.watchDate||'')||a.rank-b.rank:sort==='personal'?(records[b.id]?.rating||0)-(records[a.id]?.rating||0)||a.rank-b.rank:a.rank-b.rank);
  function randomMovie(){const pool=movies.filter(m=>!records[m.id]?.watched&&m.rank<=Number(range)&&(genre==='all'||m.genres.includes(genre)));if(!pool.length){toast('这个范围的电影已经全部看过啦');return;}openMovie(pool[Math.floor(Math.random()*pool.length)]);}
  function exportRecords(){const blob=new Blob([JSON.stringify({app:'film-diary-250',version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`片刻观影备份-${new Date().toLocaleDateString('sv-SE')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function readBackup(file?:File){if(!file)return;try{if(file.size>3000000)throw Error('文件不能超过 3 MB');const data=JSON.parse(await file.text());if(data.app!=='film-diary-250'||data.version!==1||!data.records||Array.isArray(data.records))throw Error('请选择片刻导出的 JSON 备份');const entries=Object.entries(data.records);if(entries.length>250||!entries.length)throw Error('备份为空或超过 250 条');const known=new Set(movies.map(m=>m.id));const clean=Object.fromEntries(entries.map(([id,r])=>{if(!known.has(id))throw Error('备份包含当前榜单以外的电影，暂不支持导入');return [id,validateRecord(r)];}));setImported(clean);}catch(e){toast.error(e instanceof Error?e.message:'无法读取备份');}finally{if(fileInput.current)fileInput.current.value='';}}
  async function importRecords(){if(!imported)return;if(pendingIds.current.size){toast('请等待正在保存的记录完成');return;}busy.current=true;setSaving(true);try{await persist(imported);setImported(null);setBackup(false);toast.success(mode==='guest'?'备份已合并到当前浏览器':'备份已合并到云端');}catch(e){toast.error(e instanceof Error?e.message:'导入失败');}finally{busy.current=false;setSaving(false);}}
  function importGuest(){try{const guest=readGuestRecords();if(!Object.keys(guest).length){toast('当前浏览器没有游客记录');return;}setAccountOpen(false);setImported(guest);setBackup(true);}catch(e){toast.error(e instanceof Error?e.message:'读取游客记录失败');}}
  const genres=Array.from(new Set(movies.flatMap(m=>m.genres))).sort((a,b)=>a.localeCompare(b,'zh'));
  return <div className="app-shell">
    <Toaster position="top-center" theme="dark" richColors />
    <header className="site-header"><a className="brand" href="/"><span className="brand-icon"><Film size={24}/></span><span>片刻<span className="brand-en">FRAME / 250</span></span></a><div className="header-right"><span className="cloud-state"><Cloud size={16}/>{loading?'读取记录中':error?'连接暂不可用':mode==='guest'?'游客 · 本机保存':'云端已同步'}</span><button className="quiet-button" onClick={()=>setBackup(true)} aria-label="备份记录"><Download size={16}/><span>备份记录</span></button>{mode==='cloud'?<button className="account-button" onClick={()=>setAccountOpen(true)} aria-label={`管理账号：${accountName}`} title={accountName}><UserRound size={18}/><span>{accountName}</span></button>:mode==='guest'?<a className="account-button" href="/signin-with-chatgpt?return_to=%2F" target="_top" aria-label="未登录，点击登录"><UserRound size={18}/><span>未登录</span></a>:<button className="account-button" onClick={()=>void loadRecords()} disabled={loading}><UserRound size={18}/><span>{loading?'识别中…':'重试登录状态'}</span></button>}</div></header>
    <main>
      <section className="intro"><div><h1>我的观影手记</h1><p>250 部电影，慢慢看。</p></div><button className="primary-button" disabled={!ready||!movies.length} onClick={randomMovie}><Shuffle size={17}/>今晚看什么</button></section>
      {error&&<div className="connection-message" role="status"><Cloud size={18}/><span>{error} 榜单仍可浏览，连接后即可打卡。</span>{authRequired?<a href="/signin-with-chatgpt?return_to=%2F" target="_top">登录</a>:<button onClick={()=>void loadRecords()}>重试连接</button>}</div>}
      {mode==='guest'&&<div className="guest-banner"><UserRound size={17}/><span>正在以游客身份记录 · 仅保存在当前浏览器，清除网站数据会丢失记录。<strong>登录后可跨设备同步。</strong></span><a href="/signin-with-chatgpt?return_to=%2F" target="_top">登录账号 <ArrowUpRight size={14}/></a></div>}
      <section className="stats" aria-label="我的观影统计">
        <div className="stat stat-main"><div className="stat-label"><span>TOP 250</span><span>{ready?`${(watched.length/250*100).toFixed(1)}%`:'—'}</span></div><div className="stat-number">{ready?watched.length:'—'}<span>/ 250 <small>部</small></span></div><Progress value={ready?watched.length/250*100:0} aria-label="Top250观影率"/></div>
        <div className="stat"><div className="stat-label"><span>TOP 100</span><span>{ready?`${top100}%`:"—"}</span></div><div className="stat-number">{ready?top100:'—'}<span>/ 100 <small>部</small></span></div><Progress value={ready?top100:0} aria-label="Top100观影率"/></div>
        <div className="stat"><div className="stat-label"><span>TOP 50</span><span>{ready?`${(top50/50*100).toFixed(0)}%`:"—"}</span></div><div className="stat-number">{ready?top50:'—'}<span>/ 50 <small>部</small></span></div><Progress value={ready?top50/50*100:0} aria-label="Top50观影率"/></div>
        <button type="button" className="stat monthly-stat" ref={monthTrigger} onClick={()=>setMonthOpen(true)} disabled={!ready} aria-label={`查看本月观影：${monthly}部`} aria-haspopup="dialog" aria-expanded={monthOpen} aria-controls={monthOpen?"monthly-movies-dialog":undefined}><span className="stat-label"><span>本月观影</span><CalendarDays size={16}/></span><span className="stat-number">{ready?monthly:'—'}<span>部</span></span><span className="stat-hint">查看本月已看影片 <ArrowUpRight size={14}/></span></button>
      </section>
      <Tabs value={tab} onValueChange={v=>{setTab(v as Tab);setStatus('all');}} className="collection" id="movie-collection">
        <div className="collection-nav"><TabsList variant="line"><TabsTrigger value="all"><Film/>电影榜单<span>{movies.length||250}</span></TabsTrigger><TabsTrigger value="watched"><Check/>我的已看<span>{ready?watched.length:'—'}</span></TabsTrigger><TabsTrigger value="wishlist"><Bookmark/>想看清单<span>{ready?wished.length:'—'}</span></TabsTrigger></TabsList><span className="collection-note">榜单快照 · {sourceDate||'—'}</span></div>
        <div className="toolbar"><label className="search"><Search size={18}/><input aria-label="搜索电影" placeholder="搜索片名、导演、年份…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><X size={16}/></button>}</label><div className="filters"><SlidersHorizontal size={16}/><Picker label="榜单范围" value={range} change={setRange} options={[["250","Top 250"],["100","Top 100"],["50","Top 50"]]}/><Picker label="电影类型" value={genre} change={setGenre} options={[["all","所有类型"],...genres.map(g=>[g,g] as [string,string])]}/>{tab==='all'&&<Picker label="观看状态" value={status} change={setStatus} options={[["all","全部状态"],["unwatched","还没看过"],["watched","已经看过"]]}/>}<Picker label="排序方式" value={sort} change={setSort} options={[["rank","按榜单排名"],["rating","按豆瓣评分"],["date","按观看日期"],["personal","按我的评分"]]}/></div></div>
        <div className="results-heading"><h2>{labels[tab]} <span>{filtered.length} 部</span></h2><span>{sort==='rank'?'按豆瓣榜单排名排列':'使用当前排序'}<span className="source-date"> · 榜单采集于 {sourceDate||'—'}</span></span></div>
        {(['all','watched','wishlist'] as Tab[]).map(t=><TabsContent key={t} value={t}>
          {dataError?<div className="empty-state"><Film/><h3>榜单暂时没有加载成功</h3><button onClick={()=>window.location.reload()}>重新加载</button></div>:!movies.length?<div className="movie-grid">{Array.from({length:6},(_,i)=><Skeleton key={i} className="h-96 w-full"/>)}</div>:tab!=='all'&&!ready?<div className="empty-state"><Cloud/><h3>连接云端后查看你的记录</h3><p>电影榜单可随时浏览。</p><button onClick={()=>setTab('all')}>去看电影榜单</button></div>:!filtered.length?<div className="empty-state"><BookOpen/><h3>{query||genre!=='all'||range!=='250'||status!=='all'?'没有找到匹配的电影':tab==='watched'?'你的第一部电影，值得被记住':tab==='wishlist'?'把下一部期待，放在这里':'没有找到电影'}</h3><p>{tab==='watched'?'勾选电影下方的「看过」，就能开始你的观影记录。':'试试其他筛选，或者回到完整榜单。'}</p><button onClick={()=>{setQuery('');setGenre('all');setRange('250');setStatus('all');setTab('all');}}>浏览全部电影</button></div>:<>
            <div className="movie-grid">{filtered.slice(0,limit).map((m,i)=>{const r=records[m.id]||blankRecord;return <article className={`movie-card ${r.watched?'is-watched':''}`} key={m.id}>
              <div className="poster-wrap"><button className="poster-button" onClick={()=>openMovie(m)} aria-label={`查看${m.title}及观影记录`}><Poster movie={m} eager={i<6}/><span className="poster-shade"/><span className="poster-open">查看电影 <ArrowUpRight size={16}/></span></button><span className={`rank ${m.rank<=3?'rank-gold':''}`}>{String(m.rank).padStart(2,'0')}</span><button className={`wishlist-button ${r.wishlist?'active':''}`} disabled={!ready||pending.has(m.id)||saving} onClick={()=>void toggle(m,'wishlist')} aria-label={`${r.wishlist?'取消想看':'加入想看'}${m.title}`} aria-pressed={r.wishlist}><Bookmark size={17} fill={r.wishlist?'currentColor':'none'}/></button>{r.watched&&<span className="watched-badge"><Check size={16} strokeWidth={2.5} aria-hidden="true"/>已看</span>}</div>
              <div className="movie-info"><button className="movie-title" onClick={()=>openMovie(m)}>{m.title}</button><p className="original-title" title={m.originalTitle}>{m.originalTitle||m.title}</p><div className="movie-meta-row"><p className="movie-meta">{m.year} <span>·</span> {m.genres.slice(0,2).join(' / ')}</p><span className="douban-score" aria-label={`豆瓣评分 ${m.rating.toFixed(1)}`}><Star size={13} fill="currentColor"/>{m.rating.toFixed(1)}</span></div><div className="card-actions"><label className={r.watched?'checked-label':''}><Checkbox aria-label={`看过${m.title}`} checked={r.watched} disabled={!ready||pending.has(m.id)||saving} onCheckedChange={()=>void toggle(m,'watched')}/>{pending.has(m.id)?'保存中':r.watched?'已看':'看过'}</label><button onClick={()=>openMovie(m)}><BookOpen size={14}/>{r.notes?'我的笔记':r.watched?'写感受':'详情'}</button></div>{r.watched&&<div className="personal-meta"><span>{r.watchDate||'未填写观看日期'}</span>{r.rating>0&&<span><Star size={12} fill="currentColor"/>{r.rating}/10</span>}</div>}{tab==='watched'&&r.notes&&<p className="note-preview">{r.notes}</p>}</div>
            </article>;})}</div>
            {filtered.length>limit&&<div className="load-more"><button className="quiet-button" onClick={()=>setLimit(n=>n+30)}>继续探索 · 加载更多 <span>{Math.min(limit,filtered.length)} / {filtered.length}</span></button></div>}
          </>}
        </TabsContent>)}
      </Tabs>
      <footer><span className="footer-brand">片刻 <span>FRAME / 250</span></span><p>榜单、评分及海报来自 <a href="https://movie.douban.com/top250" target="_blank" rel="noreferrer">豆瓣电影 <ArrowUpRight size={12}/></a> · 非豆瓣官方产品<br/>排名与评分为 {sourceDate||'当前'} 采集快照，海报版权归原权利人。</p><span className="footer-last">电影会落幕，感受被留下。</span></footer>
    </main>
    <Dialog open={monthOpen} onOpenChange={setMonthOpen}><DialogContent id="monthly-movies-dialog" className="monthly-dialog" showCloseButton={false} onCloseAutoFocus={e=>{e.preventDefault();monthTrigger.current?.focus({preventScroll:true});}}>
      <div className="monthly-dialog-heading"><DialogTitle>本月已看</DialogTitle><DialogDescription>{month} · {monthly} 部电影 · 按榜单排名排列</DialogDescription></div>
      <DialogClose className="monthly-dialog-close" aria-label="关闭本月已看"><X size={20}/></DialogClose>
      <div className="monthly-dialog-body">{monthlyMovies.length?<ul className="monthly-movies">{monthlyMovies.map(m=>{const r=records[m.id];return <li key={m.id}><div className="monthly-poster"><Poster movie={m}/></div><div className="monthly-movie-info"><span className="monthly-rank">NO. {String(m.rank).padStart(3,'0')}</span><h3>{m.title}</h3><p>{m.year} · {m.genres.join(' / ')}</p><p>观看于 {r.watchDate}{r.rating>0?' · 我的评分 '+r.rating+'/10':''}</p></div><span className="monthly-watched"><Check size={14}/>已看</span></li>;})}</ul>:<div className="monthly-empty"><CalendarDays size={30}/><h3>本月还没有观影记录</h3><p>标记已看并填写本月的观看年月，即可在这里看到。只填年份不计入本月。</p></div>}</div>
    </DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={open=>{if(!open)closeMovie();}}><DialogContent className="film-dialog" onEscapeKeyDown={e=>{e.preventDefault();closeMovie();}}>{selected&&<>
      <div className="detail-heading"><div className="detail-poster"><Poster movie={selected}/></div><div><span className="detail-rank">豆瓣 TOP 250 / NO. {selected.rank}</span><DialogTitle className="detail-title">{selected.title}</DialogTitle><DialogDescription>{selected.originalTitle}</DialogDescription><p>{selected.year} · {selected.countries}<br/>{selected.genres.join(' / ')}</p><div className="detail-score"><Star size={17} fill="currentColor"/>{selected.rating}<small>{Number(selected.ratingCount).toLocaleString()} 人评价</small></div><a href={selected.url} target="_blank" rel="noreferrer">在豆瓣查看 <ArrowUpRight size={14}/></a></div></div><p className="credits">{selected.credits}</p>
      <div className="record-editor"><h3>我的观影手记 <span>{mode==='guest'?'当前浏览器保存':'仅此账号可见'}</span></h3><label className="watched-toggle"><Checkbox checked={draft.watched} disabled={!ready||saving} onCheckedChange={v=>changeWatchedDraft(v===true)}/>我看过这部电影</label><p className="editor-hint">取消已看会保留日期、评分和笔记，但不计入观影统计。</p><div className="record-fields"><div className="watch-date-field"><label htmlFor="watch-year">观看日期 <span>选填</span></label><div className="watch-date-controls"><input id="watch-year" aria-label="观看年份" aria-describedby="watch-date-hint" inputMode="numeric" placeholder="年份，如 2024" maxLength={4} value={draft.watchDate.split('-')[0]} onChange={e=>{const year=e.target.value.replace(/[^0-9]/g,'');const month=draft.watchDate.split('-')[1];changeDraft({watchDate:year?year+(month?'-'+month:''):''});}} disabled={!ready||saving}/><Picker label="观看月份" value={draft.watchDate.split('-')[1]||'unknown'} change={v=>changeDraft({watchDate:draft.watchDate.split('-')[0]+(v==='unknown'?'':'-'+v)})} disabled={!ready||saving||draft.watchDate.split('-')[0].length!==4} options={[["unknown","月份不详"],...Array.from({length:12},(_,i)=>[String(i+1).padStart(2,'0'),(i+1)+' 月'] as [string,string])]}/></div><p id="watch-date-hint">可以只填年份；月份不详时不计入本月观影。</p></div><label>我的评分 <span>选填 · 10 分制</span><Picker label="我的评分" value={String(draft.rating)} change={v=>changeDraft({rating:Number(v)})} options={[["0","暂不评分"],...Array.from({length:10},(_,i)=>[String(i+1),`${i+1} 分`] as [string,string])]}/></label></div><label className="notes-label" htmlFor="film-notes">观影感受 <span>选填</span></label><textarea id="film-notes" placeholder="哪个瞬间打动了你？写下此刻的感受…" value={draft.notes} maxLength={10000} disabled={!ready||saving} onChange={e=>changeDraft({notes:e.target.value})}/><div className="editor-bottom"><span>{draft.notes.length} / 10000</span><span><Cloud size={13}/>{mode==='guest'?'仅保存到当前浏览器':'保存后同步到其他设备'}</span></div><div className="dialog-actions"><button className="quiet-button" onClick={closeMovie} disabled={saving}>关闭</button><button className="primary-button" onClick={()=>void saveDraft()} disabled={!ready||saving||pending.has(selected.id)}>{saving?<RotateCw className="spin" size={16}/>:<Check size={16}/>}保存记录</button></div></div>
    </>}</DialogContent></Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}><DialogContent><DialogTitle>放弃这次编辑？</DialogTitle><DialogDescription>尚未保存的修改会丢失，已保存的记录不受影响。</DialogDescription><div className="dialog-actions"><button className="quiet-button" onClick={()=>setDiscard(false)}>继续编辑</button><button className="primary-button" onClick={()=>{setDiscard(false);setDirty(false);setSelected(null);}}>放弃修改</button></div></DialogContent></Dialog>
    <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent><DialogTitle>{mode==='guest'?'游客模式':'我的账号'}</DialogTitle><DialogDescription>游客记录仅保存在当前浏览器。使用同一个 ChatGPT 账号登录后，可在手机、平板和电脑上读取该账号的云端记录；不同账号的数据分别保存。</DialogDescription><div className="account-detail"><UserRound/><div><strong>{account||(mode==='guest'?'当前正在使用游客模式':'尚未连接账号')}</strong><p>{mode==='cloud'?'观影记录已关联此账号':mode==='guest'?'不会自动上传游客记录，建议定期备份':'请重试连接'}</p></div></div><p className="account-note">登录后可选择导入当前浏览器的游客记录；导入前会告知覆盖范围。游客记录仍保留在本机，云端数据不会下载到游客模式。</p><div className="dialog-actions">{mode==='cloud'?<><button className="quiet-button" onClick={importGuest}>导入游客记录</button><button className="quiet-button" onClick={()=>{void loadRecords();setAccountOpen(false);}}>刷新记录</button><a className="quiet-button" href="/signout-with-chatgpt?return_to=%2F" target="_top">退出账号</a></>:<a className="primary-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">使用 ChatGPT 登录</a>}</div></DialogContent></Dialog>
    <Dialog open={backup} onOpenChange={v=>{if(!saving){setBackup(v);if(!v)setImported(null);}}}><DialogContent><DialogTitle>给观影记录留一份备份</DialogTitle><DialogDescription>导出包含已看状态、观看日期、想看清单、评分和笔记。导入会覆盖备份中相同电影的记录，其他电影不变。</DialogDescription><button className="backup-option" disabled={!ready||saving} onClick={exportRecords}><Download/><span>导出我的记录<small>下载 JSON 文件，自己妥善保管</small></span><ArrowUpRight/></button><button className="backup-option" disabled={!ready||saving} onClick={()=>fileInput.current?.click()}><Upload/><span>从备份恢复<small>选择之前导出的 JSON 文件</small></span><ArrowUpRight/></button><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={e=>void readBackup(e.target.files?.[0])}/>{imported&&<div className="import-confirm"><p>已检查 {Object.keys(imported).length} 条记录，其中 {Object.keys(imported).filter(id=>records[id]).length} 条会覆盖现有记录。确认合并？</p><button className="primary-button" disabled={saving} onClick={()=>void importRecords()}>{saving?'正在合并…':mode==='guest'?'确认合并到本机':'确认合并到云端'}</button></div>}</DialogContent></Dialog>
  </div>;
}
