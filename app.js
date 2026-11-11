(() => {
const $ = (s, r=document) => r.querySelector(s);
const D = window.DOCS;
const EMB = new URLSearchParams(location.search).get('embed'); const KEY = EMB ? 'brain-embed-'+EMB : 'brain-proto-v2'; if(EMB){ localStorage.removeItem(KEY); document.documentElement.classList.add('embed'); }
const fresh = () => ({ role:'employee', mode:'ask', feeFixed:false, items: JSON.parse(JSON.stringify(window.SEED_ITEMS)),
  user:null, flags:{}, ext:{}, ask:{off:{},err:false,src:'all',dom:'all',when:'all',docs:false,tourDone:false}, history:[], thread:[], audit:[], surface:'app', bot:{msgs:[],offline:false,fb:{}}, selected:null, reported:false, filter:{type:'all',status:'all'}, ui:{} });
let S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}'));
/* chats are keyed by id; migrate old question-keyed state once */
const newCid=()=>'c_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
(()=>{ try{ if(!Array.isArray(S.audit)) S.audit=[]; S.qs=S.qs||{}; S.saved=S.saved||{}; S.titles=S.titles||{}; S.pins=S.pins||{}; const map={}; const hist=Array.isArray(S.history)?S.history:[];
  const idOf=q=>{ if(!map[q]) map[q]=newCid(); return map[q]; };
  S.history=hist.map(h=>{ if(typeof h==='string'&&h.slice(0,2)==='c_') return h; const q=(h&&h.q)||h; const id=idOf(q); S.qs[id]=q; return id; });
  [['saved'],['titles'],['pins']].forEach(([k])=>{ Object.keys(S[k]).forEach(key=>{ if(key.slice(0,2)==='c_'&&S.qs[key]!==undefined) return; if(key.slice(0,2)==='c_'&&k!=='saved') return; if(key.slice(0,2)==='c_') return; const id=idOf(key); S[k][id]=S[k][key]; delete S[k][key]; if(!S.qs[id]) S.qs[id]=key; if(k==='saved'&&!S.history.includes(id)) S.history.push(id); }); });
  Object.keys(S.saved).forEach(id=>{ if(!S.qs[id]&&S.saved[id]&&S.saved[id][0]) S.qs[id]=S.saved[id][0].q; });
  if(Array.isArray(S.thread)&&S.thread.length&&!S.thread[0].cid) S.thread[0].cid=idOf(S.thread[0].q);
  if(Array.isArray(S.thread)&&S.thread.length&&S.thread[0].cid&&!S.qs[S.thread[0].cid]) S.qs[S.thread[0].cid]=S.thread[0].q;
}catch(e){} })();
/* saved answers lose the document functions in JSON, so point them back at the live documents */
(S.thread||[]).forEach(t=>{ const a=t.a||{}; ['a','b'].forEach(k=>{ if(a[k]&&a[k].id&&D[a[k].id]) a[k]=D[a[k].id]; }); if(a.sources) a.sources=a.sources.map(x=>x&&x.id&&D[x.id]?D[x.id]:x); });
const save = () => { try{ if(S.thread&&S.thread.length&&S.thread[0].q&&S.thread[0].cid){ (S.saved=S.saved||{})[S.thread[0].cid]=S.thread.map((e,i)=>({cid:i?undefined:e.cid,q:e.q,fb:e.fb||null,ts:e.ts,files:e.files||[],V:e.V,c:e.c})); } }catch(e){} localStorage.setItem(KEY, JSON.stringify(S)); };
const tg=(t,c)=>`<span class="tag ${c||''}">${t}</span>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));


/* Haptics: Android via the Vibration API, iOS Safari 17.4+ via the switch-input trick. Touch devices only. */
function haptic(kind){ try{ if(!matchMedia('(pointer:coarse)').matches) return; const pat={light:8,select:6,medium:16,heavy:26,success:[10,40,14],warn:[22,40,22]}[kind||'light']; if(navigator.vibrate){ navigator.vibrate(pat); return; }
  let l=document.getElementById('hpt'); if(!l){ l=document.createElement('label'); l.id='hpt'; l.setAttribute('aria-hidden','true'); l.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none'; l.innerHTML='<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(l); } l.click(); }catch(e){} }
function toast(m){ if(/copied|connected|updated|saved|deleted|pinned|flagged/i.test(String(m))) haptic('success'); const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove('on'),2600); }

function logAudit(e){ if(!Array.isArray(S.audit)) S.audit=[]; e.id='a'+Date.now()+Math.floor(Math.random()*99); const n=new Date(); e.ts=new Date(2026,10,1,n.getHours(),n.getMinutes()).getTime(); e.time='1 Nov, '+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'); S.audit.unshift(e); }
/* ---------- answers ---------- */
const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
function dateOk(d,w){ if(w==='all') return true; const [dd,mm,yy]=d.verified.split(' '); const age=(new Date(2026,10,1)-new Date(+yy,MON[mm],+dd))/864e5; return age<=(w==='90'?90:365); }
function restrict(a){ const srcs=a.sources||(a.a?[a.a,a.b]:[]); if(!srcs.length||a.kind==='conflict') return a; const hidden=srcs.filter(d=>!canSee(d)); if(!hidden.length) return a; const vis=srcs.filter(canSee); if(!vis.length) return {kind:'restricted',hidden,topic:a.topic};
  const bad=srcs.map((d,i)=>canSee(d)?0:i+1).filter(Boolean); const keep=a.text.split(/(?<=\.)\s+/).filter(t=>!bad.some(n=>t.includes('['+n+']'))); if(!keep.length) return {kind:'restricted',hidden,topic:a.topic};
  const map={}; vis.forEach(d=>{ map[srcs.indexOf(d)+1]=vis.indexOf(d)+1; }); return Object.assign({},a,{text:keep.join(' ').replace(/\[(\d)\]/g,(m,n)=>'['+map[n]+']'),sources:vis,hidden,access:false}); }
function answerFor(q){
  const a=restrict(rawAnswer(q)); const f=S.ask; const srcs=a.sources||(a.a?[a.a,a.b]:[]);
  const ok=d=>!(f.off&&f.off[d.id])&&(f.src==='all'||d.system===f.src)&&(f.dom==='all'||d.domain===f.dom)&&dateOk(d,f.when);
  if(srcs.length && !srcs.every(ok)) return {kind:'none', owner:'the owner of this topic', person:'see the document owner', filtered:true};
  return a;
}
function topicOf(t){ if(/rate limit|requests per|429|\bapi\b.*(limit|rate|throttl)/.test(t)) return 'api'; if(/incident|sev 1|on-call|runbook/.test(t)) return 'incident'; if(/brand|colou?r|purple|typeface|design system|component|390/.test(t)) return 'brand'; if(/crypto|custody/.test(t)) return 'crypto'; if(/escalat|chargeback/.test(t)) return 'escal'; if(/fee|replac|card|deliver|waive/.test(t)) return 'fee'; if(/limit|transfer|send/.test(t)) return 'limit'; if(/interest|saving|rate/.test(t)) return 'rate'; return null; }
function rawAnswer(q){
  const t = q.toLowerCase(); let topic=topicOf(t), follow=false;
  { let md=Object.values(D).find(d=>d&&d.title&&d.owner&&t.includes(d.title.toLowerCase().replace(/\s*\(internal\)/,'')));
    if(!md&&/\b(this|it|that|the source)\b/.test(t)&&/who owns|owner of|who maintains|who is responsible|last (verified|updated|reviewed)|when was .*(verified|updated|reviewed)/.test(t)){ const le=[...S.thread].reverse().find(e=>e.a&&e.a.sources&&e.a.sources.length); if(le) md=[...le.a.sources].sort((x,y)=>rankOf(y)-rankOf(x))[0]; }
    if(md&&/who owns|owner of|who maintains|who is responsible/.test(t)) return {kind:'answered',topic:'meta',follow:false,text:`${md.title} is owned by ${md.owner}, ${md.ownerRole} [1].`,sources:[md]};
    if(md&&/last (verified|updated|reviewed)|when was .*(verified|updated|reviewed)/.test(t)) return {kind:/past/i.test(md.authority||'')?'low':'answered',topic:'meta',follow:false,text:`${md.title} was last verified on ${md.verified} [1].`,sources:[md],why:'This source is past its review date, so it may be out of date.'}; }
  const last=[...S.thread].reverse().find(e=>e.a.topic);
  if(!topic){ if(last && t.split(/\s+/).length<=8){ topic=last.a.topic; follow=true; } }
  else if(last && /^(is it|does it|and |what about|how about|how long|why|when|is there|can staff)/.test(t)) follow=true;
  const R=o=>Object.assign({topic,follow},o);
  if(topic==='api') return R({kind:'answered', text:`The public API allows 600 requests per minute per key [1]. Above that it returns 429 with a Retry-After header [1].`, sources:[D.apilimits]});
  if(topic==='incident') return R({kind:'low', text:`Page the on-call engineer within 10 minutes of a Sev 1 [1].`, sources:[D.incident], why:'This runbook is past its review date, so the steps may have changed.'});
  if(topic==='brand'){ if(/system|component|variant/.test(t)) return R({kind:'answered', text:`Use the shared button, field and table components [1]. A new look ships as a named variant, never as one-off CSS [1].`, sources:[D.dsystem]}); return R({kind:'answered', text:`Broth purple is #5A0FC8 [1]. Body text is set at 16px or larger [1].`, sources:[D.brand]}); }
  if(topic==='crypto'){ if(S.flags.gapFixed) return R({kind:'answered', text:`Broth does not hold customer crypto [1]. Staff may not accept crypto from partners [1].`, sources:[D.crypto]}); return {kind:'none', owner:'the Compliance team', person:'Priya Nair', topic}; }
  if(topic==='escal'){ if(S.flags.revoked) return {kind:'none', owner:'the Support content owner', person:'Daniel Reyes', accessLimited:true, topic}; return R({kind:'answered', text:`Escalate chargebacks over $2,000 to the Payments lead within one working day [1].`, sources:[D.escalate]}); }
  if(topic==='fee'&&!follow&&!/fee|replac|deliver|waive|cost|price|lost|arrive|how long|days|free|charge/.test(t)) return {kind:'none', owner:'the Compliance team', person:'Priya Nair'};
  if(topic==='fee'){
    const a=D.fee_schedule, b=D.cards_faq;
    if(/waive|free|lost/.test(t)) return R({kind:'answered', text:`The fee is waived once a year for lost cards reported within 24 hours [1].`, sources:[a]});
    if(/deliver|how long|days|arrive/.test(t)) return R({kind:'low', text:`Delivery takes 5 to 7 working days [1].`, sources:[b], why:'Only the older Cards FAQ mentions this, and it is not an approved policy.'});
    if(!S.feeFixed) return R({kind:'conflict', lead:'Two sources give different prices for a replacement card.', a, b});
    return R({kind:'answered', text:`A replacement card costs $${a.value} [1]. It is waived once a year for lost cards reported within 24 hours [1]. Delivery takes 5 to 7 working days [2].`, sources:[a,b]});
  }
  if(topic==='limit'){
    if(/business|verified|higher|more|raise/.test(t)) return R({kind:'answered', access:true, text:`Verified business accounts can send up to $25,000 per day [1]. Limits rise after identity verification [2].`, sources:[D.limits2,D.limits]});
    if(/standard|personal|normal/.test(t)) return R({kind:'answered', text:`Standard accounts can send up to $5,000 per day [1].`, sources:[D.limits]});
    return R({kind:'answered', access:true, text:`Standard accounts can send up to $5,000 per day [1]. Verified business accounts can send up to $25,000 per day [2].`, sources:[D.limits, D.limits2]});
  }
  if(topic==='rate'){
    if(/when|date|updated|verified|current/.test(t)) return R({kind:'low', text:`The Savings Rate Sheet was last verified on 14 Jan 2025 [1].`, sources:[D.rates], why:'This source is past its review date, so the rate may have changed.'});
    return R({kind:'low', text:`Flexible Saver paid 3.2% in January 2025 [1].`, sources:[D.rates], why:'This source is past its review date, so the rate may have changed.'});
  }
  return {kind:'none', owner:'the Compliance team', person:'Priya Nair'};
}
/* ---------- Ask ---------- */
const SRCDOCS=['fee_schedule','cards_faq','limits','limits2','rates','crypto','escalate','brand','dsystem','apilimits','incident'];
const appsOn=()=>{ const a=S.apps||{}; return ['Confluence','Google Drive','Notion'].filter(k=>a[k]===undefined?k!=='Notion':a[k]); };
const dayKey=t=>{ const d=new Date(t); return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); };
const timeStr=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const dayLabel=(t,withTime)=>{ const d=new Date(t), n=new Date(); const diff=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5); const day=diff===0?'Today':diff===1?'Yesterday':diff<7?d.toLocaleDateString([],{weekday:'long'}):d.toLocaleDateString([],{day:'numeric',month:'short',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'}); return withTime?day+', '+timeStr(t):day; };
const first=n=>String(n||'').split(' ')[0];
const grants=()=>S.grants||(S.grants={});
const myLevel=()=>{ const u=S.user; if(!u) return 0; const o=(S.levels||{})[u.email]; return o!=null?o:(u.level||0); };
const canSee=d=>{ if(d.level==null&&!d.acl) return true; if(grants()[d.id]) return true; const u=S.user; if(!u) return false; if(String(d.owner)===u.name) return true; if(d.acl&&d.acl.includes(u.team)) return true; return d.level!=null&&d.level<=myLevel(); };
const needText=d=>'needs '+window.LEVELS[d.level||0]+' access'+(d.acl?', or the '+d.acl.join(', ')+' team'+(d.acl.length>1?'s':''):'');
const VIS=()=>SRCDOCS.filter(id=>canSee(D[id]));
const reqOf=id=>(S.requests||[]).find(r=>r.doc===id&&r.by===(S.user&&S.user.name)&&(r.status||'pending')==='pending'&&!grants()[id]);
const lockedFor=()=>SRCDOCS.map(id=>D[id]).filter(d=>!canSee(d));
function lockedHtml(list){ return `<div class="lockbox">${list.map(d=>{ const r=reqOf(d.id); const g=grants()[d.id]; return `<div class="lockrow"><span class="lockic">${SRCICON(d.system,20)}</span><span class="lockt"><b>${esc(d.title)}</b><small>${esc(needText(d))}</small></span><span class="lockact">${g?`<span class="tag ok">Granted</span>`:r?`<span class="lkst"><i class="on"></i><i class="on"></i><i></i></span><span class="tag blue">Asked ${AVATAR(d.owner,'lav',16)} ${esc(first(d.owner))}</span>`:`<button class="btn sm primary lkask" data-req="${d.id}">${AVATAR(d.owner,'lav',18)}<span>Ask ${esc(first(d.owner))}</span></button>`}</span></div>`; }).join('')}</div>`; }
function cancelRequest(id){ const u=S.user; const r=reqOf(id); if(!r) return; r.status='cancelled'; S.items.forEach(i=>{ if(i.type==='access'&&i.reqDoc===id&&i.requester===(u&&u.name)&&['open','progress'].includes(i.status)) i.status='dismissed'; }); save(); toast('Request cancelled'); renderSurfaces(); route(); }
function requestAccess(id){ const d=D[id], u=S.user; if(!u||reqOf(id)) return; (S.requests||(S.requests=[])).push({doc:id,by:u.name,at:Date.now(),status:'pending'});
  S.items.unshift({id:'i'+Date.now(),type:'access',title:u.name+' requests access to '+d.title,domain:d.domain,impact:0,owner:d.owner,status:'open',age:'just now',doc:id,reqDoc:id,requester:u.name,preview:u.name+' ('+u.team+') asked to open '+d.title+'. It '+needText(d)+'; '+first(u.name)+' is at '+window.LEVELS[myLevel()]+'.',note:'Granting opens this one source for '+first(u.name)+'. Nothing else changes.'});
  save(); toast('Request sent to '+d.owner); renderSurfaces(); if(S.surface==='app') renderAsk(); else route(); }
const SRCIMG={'Notion':'src-notion','Google Cloud':'src-gcloud','Confluence':'src-confluence','Google Drive':'src-drive','Internal file system':'src-filesystem','Help centre':'src-help'};
const favDot=d=>`<img class="gfav" src="assets/svg/${SRCIMG[d.system]||'src-filesystem'}.svg" alt="" width="22" height="22">`;
function srcRows(q){ const off=S.ask.off||(S.ask.off={}); return SRCDOCS.filter(id=>canSee(D[id])&&(!q||(D[id].title+D[id].system).toLowerCase().includes(q.toLowerCase()))).map(id=>{ const d=D[id]; return `<label class="gsrc">${favDot(d)}<span class="gt"><span>${esc(d.title)}</span><small>${esc(d.system)} · ${PERSON(d.owner,14)}</small></span><input type="checkbox" class="gck" data-sd="${id}" ${off[id]?'':'checked'} aria-label="Use ${esc(d.title)}"></label>`; }).join('')||'<div class="gempty">No sources match.</div>'; }
const FT={pdf:['PDF','#e5484d'],csv:['CSV','#26a269'],tsv:['TSV','#26a269'],xlsx:['XLS','#26a269'],xls:['XLS','#26a269'],doc:['DOC','#3b82f6'],docx:['DOC','#3b82f6'],ppt:['PPT','#e2784a'],pptx:['PPT','#e2784a'],txt:['TXT','#7a7d85'],md:['MD','#7a7d85'],json:['JSON','#d4a30a'],zip:['ZIP','#7a7d85'],mp3:['AUD','#bb6bd9'],wav:['AUD','#bb6bd9'],mp4:['VID','#bb6bd9'],mov:['VID','#bb6bd9']};
const IMG_EXT=['png','jpg','jpeg','gif','webp','svg','heic','avif'];
function attInfo(x){ const ext=(String(x.name).split('.').pop()||'').toLowerCase(); const b=(window._fb||{})[x.fid]; const url=(b&&b.url)||x.data||''; const ty=(b&&b.type)||x.type||''; const isImg=/^image\//.test(ty)||/^data:image/.test(url)||IMG_EXT.includes(ext); return {ext,url,isImg,label:isImg?'Image':(FT[ext]?FT[ext][0]:(ext?ext.toUpperCase().slice(0,4):'File'))}; }
function attThumb(x){ const i=attInfo(x); if(x.lib&&D[x.id]) return `<span class="athm lib">${SRCICON(D[x.id].system,22)}</span>`; if(i.isImg&&i.url) return `<img class="athm" src="${i.url}" alt="">`; const col=(FT[i.ext]||[0,'#7a7d85'])[1]; return `<span class="athm atile" style="--c:${col}">${i.isImg?ICON('image',16):esc(i.label)}</span>`; }
function attCard(x,i,rm){ const inf=attInfo(x); const sub=x.lib?'Library':inf.label+(x.size?' · '+fmtSize(x.size):''); return `<span class="att"><button type="button" class="atb" ${x.lib?`data-pfl="${x.id}"`:`data-pf="${x.fid||''}"`} aria-label="Preview ${esc(x.name)}">${attThumb(x)}<span class="atx"><b>${esc(x.name)}</b><small>${esc(sub)}</small></span></button>${rm?`<button type="button" class="atrm" data-rmf="${i}" aria-label="Remove ${esc(x.name)}">${ICON('x',12)}</button>`:''}</span>`; }
function filesHtml(){ const f=S.ask.files||[]; return f.length?`<div class="dfiles">${f.map((x,i)=>attCard(x,i,true)).join('')}</div>`:''; }
const GREET={m:['Good morning, {n}','Morning, {n}. What are we finding?','Fresh start, {n}'],a:['Afternoon, {n}','Good afternoon, {n}','Still hunting, {n}?'],e:['Evening, {n}','Winding down, {n}?','One more thing, {n}?'],l:['Working late, {n}?','Still up, {n}?'],any:['What do you want to know, {n}?','Ask away, {n}','Looking for something, {n}?','Let\'s find it, {n}','What\'s on your mind, {n}?','Back with questions, {n}?','What can Broth dig up, {n}?']};
const GR={on:false,t:''};
function greeting(){ const d=new Date(), h=d.getHours(), day=d.getDay(); const f=S.user&&S.user.name?String(S.user.name).split(' ')[0]:''; const pool=[...(h>=5&&h<12?GREET.m:h<18&&h>=12?GREET.a:h<22&&h>=18?GREET.e:GREET.l),...GREET.any]; if(day===5) pool.push('Happy Friday, {n}'); if(day===1) pool.push('Monday questions, {n}?');
  if(!GR.on||!GR.t){ GR.t=pool[Math.floor(Math.random()*pool.length)]; GR.on=true; }
  let t=GR.t; t=f?t.replace('{n}',esc(f)):t.replace(/, \{n\}|\{n\}/,'').replace(/^\s+/,''); return t.replace(/\?\?$/,'?'); }
function openChat(id){ const sv=S.saved&&S.saved[id]; if(!sv||!sv.length){ S.surface='app'; S.mode='ask'; S.thread=[]; S._cid=id; save(); route(); ask(qOf(id)); return; } S.surface='app'; S.mode='ask'; S.thread=sv.map((e,i)=>Object.assign({},e,{a:answerFor(e.q)},i?{}:{cid:id})); S.ask.open=false;  S.ask.pt='answer'; save(); route(); window.scrollTo(0,0); }
const qOf=id=>(S.qs&&S.qs[id])||(S.saved&&S.saved[id]&&S.saved[id][0]&&S.saved[id][0].q)||'';
const titleOf=id=>(S.titles&&S.titles[id])||qOf(id);
function editTitle(el,q,done){ const cur=titleOf(q); const orig=qOf(q); const inp=document.createElement('input'); inp.className='ttin'; inp.value=cur; inp.maxLength=80; inp.setAttribute('aria-label','Chat title'); const auto=el.classList&&el.classList.contains('dtitle'); el.replaceWith(inp); if(auto){ const m=document.createElement('span'); m.style.cssText='position:absolute;visibility:hidden;white-space:pre;font:500 14px var(--font)'; document.body.appendChild(m); const fit=()=>{ m.textContent=inp.value||' '; inp.style.width=Math.min(560,Math.max(48,Math.ceil(m.getBoundingClientRect().width)+22))+'px'; }; fit(); inp.addEventListener('input',fit); inp.addEventListener('blur',()=>m.remove()); inp.classList.add('ttfit'); } inp.focus(); inp.select(); let fin=false;
  const end=(save)=>{ if(fin) return; fin=true; let changed=false; if(save){ const v=inp.value.trim(); S.titles=S.titles||{}; const before=titleOf(q); if(v&&v!==orig) S.titles[q]=v; else delete S.titles[q]; changed=titleOf(q)!==before; save_(); } done(); if(changed) renamedFx(titleOf(q)); };
  inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); end(true); } else if(e.key==='Escape'){ e.preventDefault(); end(false); } e.stopPropagation(); }; inp.onblur=()=>end(true); inp.onclick=e=>e.stopPropagation(); }
const save_=()=>save();
/* rename, subtly: the new title fades in and a thin brand line draws under it once, like a pen stroke */
function renamedFx(title){ toast('Renamed'); if(matchMedia('(prefers-reduced-motion: reduce)').matches) return; const t=String(title).trim().slice(0,30); const hits=[...document.querySelectorAll('#cxtitle,#surfaces .surf.chat,.chr .actt b')].filter(e=>e.textContent.trim().startsWith(t)); hits.forEach(e=>{ const txt=e.matches('.surf.chat')?(e.querySelector('.chn')||e.querySelector('span')||e):e; if(!txt.animate) return; txt.animate([{opacity:.25},{opacity:1}],{duration:320,easing:'ease-out'}); const cs=getComputedStyle(txt); if(cs.position==='static') txt.style.position='relative'; const ln=document.createElement('i'); ln.setAttribute('aria-hidden','true'); ln.style.cssText='position:absolute;left:0;right:0;bottom:-2px;height:1.5px;border-radius:1px;background:var(--brand,#5e6ad2);transform-origin:left center;pointer-events:none'; txt.appendChild(ln); const draw=ln.animate([{transform:'scaleX(0)',opacity:.9},{transform:'scaleX(1)',opacity:.9}],{duration:340,easing:'cubic-bezier(.3,.7,.2,1)',fill:'forwards'}); draw.finished.then(()=>ln.animate([{opacity:.9},{opacity:0}],{duration:360,easing:'ease-out',fill:'forwards'}).finished).then(()=>ln.remove()).catch(()=>ln.remove()); }); }

function chatMenu(anchor,q,o){ document.querySelectorAll('.cmenu').forEach(m=>m.remove()); const pinned=!!(S.pins&&S.pins[q]); const m=document.createElement('div'); m.className='cmenu'; m.setAttribute('role','menu');
  m.innerHTML=`<button role="menuitem" data-a="ren">${ICON('compose',15)}<span>Rename</span></button><button role="menuitem" data-a="pin">${ICON('pin',15)}<span>${pinned?'Unpin':'Pin to top'}</span></button><button role="menuitem" data-a="link">${ICON('link',15)}<span>Copy link</span></button><div class="cm-sep"></div><button role="menuitem" class="cm-del" data-a="del">${ICON('x',15)}<span>Delete chat</span></button>`;
  document.body.appendChild(m); const r=anchor.getBoundingClientRect(); const w=m.offsetWidth; m.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px'; const below=r.bottom+m.offsetHeight+10<innerHeight; m.style.top=(below?r.bottom+6:r.top-m.offsetHeight-6)+'px';
  if(m.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches) m.animate([{opacity:0,transform:'translateY('+(below?-4:4)+'px) scale(.97)'},{opacity:1,transform:'none'}],{duration:150,easing:'cubic-bezier(.2,.8,.2,1)'});
  const close=()=>{ m.remove(); document.removeEventListener('mousedown',out,true); document.removeEventListener('keydown',key,true); };
  const out=e=>{ if(!m.contains(e.target)) close(); }; const key=e=>{ if(e.key==='Escape'){ e.preventDefault(); close(); anchor.focus&&anchor.focus(); } };
  document.addEventListener('mousedown',out,true); document.addEventListener('keydown',key,true);
  m.querySelector('button').focus();
  m.onclick=e=>{ const b=e.target.closest('[data-a]'); if(!b) return; const a=b.dataset.a;
    if(a==='del'&&!b.dataset.arm){ b.dataset.arm='1'; b.querySelector('span').textContent='Confirm delete'; return; }
    close();
    if(a==='ren') o.rename&&o.rename();
    else if(a==='pin'){ S.pins=S.pins||{}; if(pinned) delete S.pins[q]; else S.pins[q]=true; save(); renderSurfaces(); if(S.surface==='chats'&&window.SURFACES.chats) window.SURFACES.chats(); toast(pinned?'Unpinned':'Pinned'); }
    else if(a==='link'){ try{navigator.clipboard.writeText(location.href.split('#')[0]).catch(()=>{});}catch(e){} toast('Link copied'); }
    else if(a==='del'){ const rowEl=anchor.closest('.surf,.chr,.lrow'); const finish=()=>{ S.history=S.history.filter(x=>x!==q); if(S.titles) delete S.titles[q]; if(S.pins) delete S.pins[q]; if(S.saved) delete S.saved[q]; if(S.qs) delete S.qs[q]; const cur=S.thread[0]&&S.thread[0].cid===q; if(cur){ S.thread=[]; S.ask.open=false; } save(); toast('Chat deleted'); if(cur){ S.surface='app'; S.mode='ask'; route(); } else { renderSurfaces(); if(S.surface==='chats'&&window.SURFACES.chats) window.SURFACES.chats(); } }; if(rowEl&&rowEl.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){ rowEl.style.pointerEvents='none'; const r=rowEl.getBoundingClientRect(); const h=r.height; rowEl.style.overflow='hidden';
      const can=document.createElement('div'); can.className='trashfx'; can.setAttribute('aria-hidden','true'); can.innerHTML=ICON('trash',22); can.style.left=(r.left+Math.min(r.width/2,60)-18)+'px'; can.style.top=(r.top+h/2-18)+'px'; document.body.appendChild(can);
      can.animate([{opacity:0,transform:'scale(.4) translateY(6px)'},{opacity:1,transform:'scale(1) translateY(0)'}],{duration:180,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
      const sink=rowEl.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateX('+(Math.min(r.width/2,60)-r.width/2)+'px) scale(.35)'}],{duration:320,delay:80,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      sink.finished.then(()=>{ can.animate([{transform:'rotate(0)'},{transform:'rotate(-12deg)'},{transform:'rotate(8deg)'},{transform:'rotate(0)'}],{duration:220}); return rowEl.animate([{height:h+'px',opacity:0},{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px'}],{duration:200,easing:'ease-out',fill:'forwards'}).finished; }).then(()=>can.animate([{opacity:1},{opacity:0,transform:'scale(.8)'}],{duration:160,fill:'forwards'}).finished).then(()=>{ can.remove(); finish(); }).catch(()=>{ can.remove(); finish(); }); } else finish(); } }; }

function composer(home,n,ph){ return `<form class="dform" id="askform"><div id="dfiles">${filesHtml()}</div><textarea id="askin" rows="${home?3:1}" placeholder="${ph}" aria-label="Ask a question" autocomplete="off"></textarea><div class="drow"><button type="button" class="dic" id="cxatt" aria-label="Attach" aria-haspopup="menu" title="Attach a file">${ICON('clip',16)}</button><button type="button" class="dic" id="cxmic" aria-label="Dictate" aria-pressed="false" title="Speak your question">${ICON('mic',16)}</button><input type="file" id="cxfile" multiple hidden accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg"><button type="button" class="dchip" id="cxsrc">${ICON('stack',14)}<span>${S.ask.stack?esc(S.ask.stack)+' · ':''}${n} sources</span>${CARET}</button><span class="lsp"></span><button class="dsend" type="submit" aria-label="Ask">${ICON('send',16)}</button></div></form>`; }
let rec=null;
function stopMic(){ if(rec){ try{ rec.stop(); }catch(e){} } }
function drawFiles(){ const d=$('#dfiles'); if(!d) return; d.innerHTML=filesHtml(); d.querySelectorAll('[data-rmf]').forEach(b=>b.onclick=()=>{ S.ask.files.splice(+b.dataset.rmf,1); save(); drawFiles(); }); }
function addFiles(list){ const f=S.ask.files||(S.ask.files=[]); window._fb=window._fb||{}; [...list].forEach(x=>{ if(f.length>=5) return; if(x.size>10*1024*1024){ toast(x.name+' is over 10 MB'); return; } const fid='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); const ent={name:x.name,size:x.size,fid,type:x.type||''}; f.push(ent); window._fb[fid]={url:URL.createObjectURL(x),type:x.type||'',name:x.name}; const ext=(x.name.split('.').pop()||'').toLowerCase(); if(['txt','md','csv','json','tsv','log'].includes(ext)&&x.size<1024*1024){ const fr=new FileReader(); fr.onload=()=>{ ent.text=String(fr.result||'').slice(0,12000); save(); }; fr.readAsText(x); } else if((/^image\//.test(x.type)||x.type==='application/pdf')&&x.size<450*1024){ const fr=new FileReader(); fr.onload=()=>{ ent.data=String(fr.result||''); try{save();}catch(e){ delete ent.data; } }; fr.readAsDataURL(x); } else ent.unreadable=!['txt','md','csv','json','tsv','log'].includes(ext); }); save(); drawFiles(); }
function pickLibrary(){ const d=$('#drawer'); const on=appsOn(); const items=Object.values(D).filter(x=>x.kind&&on.includes(x.system)&&canSee(x));
  d.innerHTML=`<button class="btn sm" id="dclose">Close</button><h3>Attach from the Library</h3><div class="glist">${items.map(x=>`<button class="gsrc plb" data-pl="${x.id}">${SRCICON(x.system,22)}<span class="gt"><span>${esc(x.title)}</span><small>${esc(x.system)} · ${esc(x.path||'')}</small></span></button>`).join('')||'<p class="sub">Connect an app to attach from it.</p>'}</div>`;
  $('#dclose').onclick=closeDrawer; d.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{ const x=D[b.dataset.pl]; const f=S.ask.files||(S.ask.files=[]); if(!f.some(y=>y.id===x.id)&&f.length<5) f.push({name:x.title,id:x.id,lib:true}); save(); closeDrawer(); drawFiles(); });
  d.classList.add('on'); $('#scrim').classList.add('on'); d.setAttribute('aria-hidden','false'); }
function attachMenu(btn){ document.querySelectorAll('.pmenu.att').forEach(x=>x.remove()); const m=document.createElement('div'); m.className='pmenu att'; m.setAttribute('role','menu'); m.innerHTML=`<button type="button" class="pm-i" role="menuitem" data-a="up">${ICON('clip',16)}<span>Upload a file</span></button><button type="button" class="pm-i" role="menuitem" data-a="lib">${ICON('library',16)}<span>From the Library</span></button><p class="pm-n">Only you can see attached files.</p>`; document.body.appendChild(m);
  const r=btn.getBoundingClientRect(); m.style.left=Math.max(8,r.left)+'px'; const up=innerHeight-r.bottom<150; m.style[up?'bottom':'top']=(up?innerHeight-r.top+6:r.bottom+6)+'px'; m.style.width='232px';
  const items=[...m.querySelectorAll('.pm-i')]; let cur=0; items[0].focus();
  const close=()=>{ m.remove(); document.removeEventListener('pointerdown',out,true); btn.focus({preventScroll:true}); }; const out=e=>{ if(!m.contains(e.target)&&!btn.contains(e.target)){ m.remove(); document.removeEventListener('pointerdown',out,true); } };
  items.forEach(b=>b.onclick=()=>{ const a=b.dataset.a; m.remove(); document.removeEventListener('pointerdown',out,true); if(a==='up') $('#cxfile').click(); else pickLibrary(); });
  m.onkeydown=e=>{ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); cur=(cur+(e.key==='ArrowDown'?1:-1)+items.length)%items.length; items[cur].focus(); } else if(e.key==='Escape'||e.key==='Tab'){ e.preventDefault(); close(); } };
  document.addEventListener('pointerdown',out,true); }
function toggleMic(btn,ta){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){ toast('Voice input is not supported in this browser.'); return; } if(rec){ stopMic(); return; }
  const r=new SR(); rec=r; r.lang=navigator.language||'en-US'; r.interimResults=true; r.continuous=true; const base=ta.value?ta.value.replace(/\s*$/,' '):''; let fin='';
  r.onresult=e=>{ let it=''; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) fin+=t; else it+=t; } ta.value=base+fin+it; ta.dispatchEvent(new Event('input')); };
  r.onerror=e=>{ toast(e.error==='not-allowed'||e.error==='service-not-allowed'?'Allow the microphone to speak your question.':'Voice input stopped.'); };
  r.onend=()=>{ rec=null; btn.classList.remove('rec'); btn.setAttribute('aria-pressed','false'); btn.setAttribute('aria-label','Dictate'); ta.focus(); };
  try{ r.start(); btn.classList.add('rec'); btn.setAttribute('aria-pressed','true'); btn.setAttribute('aria-label','Stop dictating'); toast('Listening. Speak your question.'); }catch(e){ rec=null; } }
function wireComposer(ta){ const att=$('#cxatt'), mic=$('#cxmic'), fi=$('#cxfile'), form=$('#askform'); if(!att) return;
  att.onclick=()=>attachMenu(att); mic.onclick=()=>toggleMic(mic,ta); fi.onchange=()=>{ addFiles(fi.files); fi.value=''; };
  ['dragenter','dragover'].forEach(ev=>form.addEventListener(ev,e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){ e.preventDefault(); form.classList.add('drop'); } }));
  ['dragleave','drop'].forEach(ev=>form.addEventListener(ev,e=>{ if(ev==='drop'&&e.dataTransfer&&e.dataTransfer.files.length){ e.preventDefault(); addFiles(e.dataTransfer.files); } form.classList.remove('drop'); }));
  drawFiles(); }
function renderAsk(){
  const fid=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.nxt')?document.activeElement.id:'';
  const first = !S.thread.length; if(first) S.ask.shut=false; const off=S.ask.off||(S.ask.off={});
  const n=SRCDOCS.filter(id=>!off[id]&&canSee(D[id])).length;
  const nx0=window.AUTH&&S.user&&!S.flow?window.AUTH.nextStep():null;
  const chips = [...new Set([...(S.user&&window.AUTH?[window.AUTH.example(S.user.team)]:[]),'What is the card replacement fee?','What is the daily transfer limit?','How do I request access to a source?','Show me the product tour'])].filter(c=>!(nx0&&nx0.l===c)).slice(0,4);
  $('#app').className='cxapp';
  const side='<aside class="cxside" id="rsrc" aria-label="Sources"></aside>';
  if(!first) GR.on=false;
  $('#app').innerHTML = first ? `
  <div class="cx ${panelOn()?'':'closed'}"><section class="cxmain"><div class="lhome">
    <div class="dchead"><b>New chat</b></div>
    <div class="lh-in">
      <div class="lm" id="lm" role="img" aria-label="Broth"><svg viewBox="0 0 269 244" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M0.3 242.5 C-0.7 239.8 12.3 209.2 29.5 173.5 C41.1 149.5 50.7 128.0 75.6 69.6 C99.0 15.0 100.2 12.9 112.8 6.2 C124.0 0.2 128.1 -0.2 171.0 0.3 C213.8 0.7 217.0 1.1 230.4 8.3 C264.8 26.7 270.1 80.0 240.3 108.7 L234.9 113.8L240.7 117.8 C265.8 134.8 275.1 166.9 264.1 198.0 C255.8 221.5 238.8 236.0 213.0 241.8 C206.5 243.3 198.3 243.5 149.0 243.5 L92.5 243.5L92.2 241.0 C91.8 237.5 101.6 207.6 103.7 205.9 C105.0 204.8 114.7 204.4 153.4 204.0 C200.9 203.5 201.6 203.5 207.3 201.2 C232.7 190.9 234.4 153.1 209.9 140.5 C203.4 137.1 200.2 136.7 176.0 136.1 L151.5 135.5L151.2 118.1 C151.0 106.8 151.3 100.3 152.0 99.5 C152.8 98.5 158.7 98.1 175.3 97.8 C196.1 97.5 197.8 97.3 202.8 95.1 C221.0 86.9 225.7 60.6 211.4 46.3 C203.6 38.4 201.3 38.0 167.5 38.0 C131.3 38.0 135.2 35.8 124.7 62.0 C106.0 108.9 93.7 138.0 75.6 178.3 C69.7 191.5 61.6 210.9 52.8 233.0 C48.2 244.5 49.6 244.0 23.4 244.0 C4.1 244.0 0.9 243.8 0.3 242.5 Z"/></svg></div>
      <h1 class="lh-t">${greeting()}</h1>
      ${composer(true,n,'Ask a question')}
      <div class="lh-sugs">${chips.slice(0,chips.length>=4?4:2).map((c,i)=>{ const ap=appsOn(); const ic=/access/i.test(c)?ICON('lock',16):/tour/i.test(c)?ICON('book',16):SRCICON(ap[i%Math.max(1,ap.length)]||'Confluence',18); return `<button class="lh-sug" style="--i:${i}" data-q="${esc(c)}"><span class="lh-si">${ic}</span><span class="lh-sq">${esc(c)}</span><span class="lh-go">${ICON('arrow',14)}</span></button>`; }).join('')}</div>
      <p class="lh-feed">${appsOn().map(k=>SRCICON(k,14)).join('')}<span>Reading from ${appsOn().length} connected app${appsOn().length===1?'':'s'}</span></p>
    </div>
  </div></section>${side}</div>` : `
  <div class="cx ${panelOn()?'':'closed'}">
   <section class="cxmain">
     <div class="dchead"><b class="dtitle" id="cxtitle" tabindex="0" role="button" title="Rename chat">${esc(titleOf(S.thread[0].cid))}</b><button class="lib dpen" id="cxmore" aria-label="Chat actions" aria-haspopup="menu" title="Chat actions">${ICON('more',16)}</button><span class="lsp"></span><button class="lib ctog" id="cxtog" aria-label="Sources" title="Sources">${(()=>{ const l=S.thread[S.thread.length-1]; const a=l&&l.a; const srcs=a?(a.sources||(a.a?[a.a,a.b]:[])):[]; const sy=[...new Set(srcs.map(d=>d.system))].slice(0,3); return sy.length?`<span class="ctogs">${sy.map(x=>SRCICON(x,16)).join('')}</span>`:ICON('stack',15); })()}<span class="ctogn">${(()=>{ const l=S.thread[S.thread.length-1]; const a=l&&l.a; const n=a?((a.sources&&a.sources.length)||(a.a?2:0)):0; return n?n+(n===1?' source':' sources'):''; })()}</span></button></div>
     <div class="chatscroll" id="chat"><div class="dthread"><div class="thread" id="thread"></div></div></div>
     <div class="cxcomp">${composer(false,n,'Ask a follow-up')}<p class="cxcap">Broth can be inaccurate. Check the sources.</p></div>
   </section>${side}
  </div>`;
  if(first){ S.ask.shut=false; renderPanel(); }
  const nx=window.AUTH&&S.user?window.AUTH.nextStep():null;
  const go=$('#nxgo'); if(go&&nx) go.onclick=()=>{ window.AUTH.nextDone(nx.k); if(nx.pre) nx.pre(); if(nx.k==='ask'){ renderAsk(); ask(nx.l); } else if(nx.k==='report'){ report(); } else if(nx.stay){ nx.run(); renderAsk(); } else if(nx.ask){ renderAsk(); ask(nx.ask); } else { nx.run(); save(); route(); } };
  if(window.Motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches){ const nc=$('.nxt'); if(nc){ Motion.animate(nc,{opacity:[0,1],y:[-10,0],scale:[.98,1]},{type:'spring',stiffness:420,damping:28}); } const nb=$('#nxgo'); if(nb){ nb.addEventListener('pointerdown',()=>Motion.animate(nb,{scale:.94},{duration:.1})); ['pointerup','pointerleave'].forEach(e=>nb.addEventListener(e,()=>Motion.animate(nb,{scale:1},{type:'spring',stiffness:600,damping:18}))); } } const al=$('#nxall'); if(al) al.onclick=()=>{ S.surface='flows'; save(); route(); }; const sk=$('#nxskip'); if(sk&&nx) sk.onclick=()=>{ window.AUTH.nextDone(nx.k); renderAsk(); };
  $('#cxsrc').onclick=()=>{ if(first){ pickSources(); return; } S.ask.pt='sources'; S.ask.open=true; save(); setPanelOpen(true); renderPanel(); };
  const ta=$('#askin'); if(first&&ta&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){ const ex=chips.filter(c=>!/tour|access/i.test(c)).concat(['Who owns the cards policy?','What changed this week?']); let k=0; const tick=()=>{ if(!document.body.contains(ta)) return; if(!ta.value&&document.activeElement!==ta){ k=(k+1)%ex.length; ta.classList.add('phx'); setTimeout(()=>{ ta.placeholder=ex[k]; ta.classList.remove('phx'); },180); } setTimeout(tick,3200); }; setTimeout(tick,3200); }
  ta.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); $('#askform').requestSubmit(); } }; ta.oninput=()=>{ ta.style.height='auto'; ta.style.height=Math.min(160,ta.scrollHeight)+'px'; };
  $('#askform').onsubmit = e => { e.preventDefault(); stopMic(); const v=ta.value.trim(); if(v) ask(v); };
  wireComposer(ta);
  document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>ask(b.dataset.q));
  if(!first){
    S.thread.forEach(e=>{ if(!e.ts) e.ts=Date.now(); }); save();
    const th = $('#thread'); S.thread.forEach((entry,i)=> th.appendChild(turnEl(entry,i,false)));
    { const rn=()=>{ const t=$('#cxtitle'); if(!t||!S.thread[0]) return; editTitle(t,S.thread[0].cid,()=>{ renderAsk(); renderSurfaces(); }); }; $('#cxtitle').onclick=rn; $('#cxtitle').onkeydown=e=>{ if(e.key==='Enter'||e.key==='F2'){ e.preventDefault(); rn(); } }; $('#cxmore').onclick=e=>{ e.stopPropagation(); chatMenu($('#cxmore'),S.thread[0].q,{rename:rn,cur:true}); }; }
    if($('#cxnew')) $('#cxnew').onclick=()=>{  S.thread=[]; S.ask.pt='answer'; S.ask.open=false; S.ask.stack=null; S.ask.off={}; save(); route(); };
    $('#cxtog').onclick=()=>{ const on=!panelOn(); setPanelOpen(on); S.ask.shut=!on; save(); if(on) renderPanel(); };
    renderPanel(); const ch=$('#chat'); if(ch) ch.scrollTop=ch.scrollHeight;
  }
  if(fid){ const t=$('#'+fid)||$('#askin'); if(t) t.focus({preventScroll:true}); }
}
function doNext(){ const nx=window.AUTH&&S.user?window.AUTH.nextStep():null; if(!nx) return; window.AUTH.nextDone(nx.k); const toAsk=()=>{ S.surface='app'; S.mode='ask'; save(); route(); };
  if(nx.k==='ask'){ toAsk(); ask(nx.l); } else if(nx.k==='report'){ toAsk(); report(); } else if(nx.stay){ nx.run(); toAsk(); } else if(nx.ask){ toAsk(); ask(nx.ask); } else { if(nx.pre) nx.pre(); nx.run(); save(); route(); } }
function panelOn(){ return !!S.ask.open||(innerWidth>=1200&&!S.ask.shut); }
function setPanelOpen(on){ const c=$('.cx'); if(c) c.classList.toggle('closed',!on); S.ask.open=!!on; if(on) S.ask.shut=false; }
function pickSources(){ const d=$('#drawer'); const draw=()=>{ const off=S.ask.off||(S.ask.off={}); d.innerHTML=`<button class="btn sm" id="dclose">Close</button><h3>Sources</h3><p class="sub" style="margin:0 0 12px">${SRCDOCS.filter(id=>!off[id]&&canSee(D[id])).length} of ${VIS().length} used for your next question</p><div class="glist">${srcRows('')}</div>`; $('#dclose').onclick=closeDrawer; d.querySelectorAll('[data-sd]').forEach(c=>c.onchange=()=>{ S.ask.off[c.dataset.sd]=!c.checked; save(); const k=SRCDOCS.filter(id=>!S.ask.off[id]&&canSee(D[id])).length; d.querySelector('.sub').textContent=k+' of '+VIS().length+' used for your next question'; const cx=$('#cxsrc'); if(cx) cx.innerHTML=ICON('stack',14)+' '+(S.ask.stack?esc(S.ask.stack)+' · ':'')+k+' sources'; }); }; draw(); d.classList.add('on'); $('#scrim').classList.add('on'); d.setAttribute('aria-hidden','false'); }
function fileById(fid){ const all=[...(S.ask.files||[]),...S.thread.flatMap(e=>e.files||[]),...Object.values(S.saved||{}).flatMap(t=>t.flatMap(e=>e.files||[]))]; return all.find(x=>x.fid===fid); }
function previewBody(f){ const b=(window._fb||{})[f.fid]; const url=(b&&b.url)||f.data||''; const ext=(f.name.split('.').pop()||'').toLowerCase(); const ty=(b&&b.type)||f.type||'';
  if(url&&(/^image\//.test(ty)||/^data:image/.test(url))) return `<img class="pvimg" src="${url}" alt="${esc(f.name)}">`;
  if(url&&(ty==='application/pdf'||ext==='pdf'||/^data:application\/pdf/.test(url))) return `<iframe class="pvpdf" src="${url}" title="${esc(f.name)}"></iframe>`;
  if(url&&/^video\//.test(ty)) return `<video class="pvmed" controls src="${url}"></video>`;
  if(url&&/^audio\//.test(ty)) return `<audio class="pvaud" controls src="${url}"></audio>`;
  if(f.text!=null){ if(ext==='csv'||ext==='tsv'){ const sep=ext==='tsv'?'\t':','; const rows=f.text.split(/\r?\n/).filter(Boolean).slice(0,60).map(r=>r.split(sep)); const head=rows.shift()||[]; return `<div class="pvtbl"><table><thead><tr>${head.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; } return `<pre class="pvtxt">${esc(f.text)}</pre>`; }
  return `<div class="pvnone">${ICON('clip',26)}<p>${url?'No preview for this file type.':'This file is no longer kept after a reload.'}</p>${url?`<a class="btn sm" href="${url}" download="${esc(f.name)}">Download</a>`:''}</div>`; }
function fmtSize(n){ return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' B'; }
function openPreview(fid){ const f=fileById(fid); if(!f) return; const d=$('#drawer'); d.classList.add('wide'); d.innerHTML=`<div class="sv"><div class="sv-top"><span class="sv-sys">${ICON('clip',16)}<b class="pvn">${esc(f.name)}</b><small>${fmtSize(f.size||0)}</small></span><button class="xbtn2" id="dclose" type="button" aria-label="Close">${ICON('x',16)}</button></div><div class="sv-body pvbody">${previewBody(f)}</div></div>`; $('#dclose').onclick=closeDrawer; d.classList.add('on'); $('#scrim').classList.add('on'); d.setAttribute('aria-hidden','false'); }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-pf]'); if(b&&b.dataset.pf){ e.preventDefault(); openPreview(b.dataset.pf); return; } const l=e.target.closest('[data-pfl]'); if(l){ e.preventDefault(); openSource(l.dataset.pfl); } });
function renderPanel(){ const p=$('#rsrc'); if(!p) return;
  { const c=$('.cx'); if(c) c.classList.remove('wide'); } const pt=S.ask.pt==='today'?'activity':((!S.thread.length&&(!S.ask.pt||S.ask.pt==='answer'))?'activity':(S.ask.pt||'answer')); const off=S.ask.off||(S.ask.off={});
  const last=S.thread[S.thread.length-1]; const a=last&&last.a; const used=a&&(a.sources||(a.a?[a.a,a.b]:[]));
  const quote=d=>d.text((d.id==='cards_faq'||d.id==='fee_schedule'||d.id==='public_fee')?d.value:null);
  const row=(d,i,tagHtml,best)=>`<div class="cxs ${best?'best':''}" data-rs="${d.id}" tabindex="0" role="button"><div class="cxs-h">${SRCICON(d.system,20)}<b>${esc(d.title)}</b>${i?`<span class="cite">${i}</span>`:''}</div><div class="cxs-q">${quote(d)}</div><div class="cxs-f">${tagHtml||''}<span>${PERSON(d.owner,16)} · ${d.verified}</span><span class="cxs-go">${ICON('chevr',14)}</span></div></div>`;
  let body='';
  if(pt==='answer'){
    if(!a) body=`<div class="cxnone"><span class="cxni">${ICON('stack',20)}</span><b>No sources yet</b><p>The sources behind an answer show up here.</p></div>`;
    else if(a.kind==='conflict') body=`<div class="cxh">Sources disagree</div>${row(a.a,1,tg('Best source','ok'),true)}${row(a.b,2,tg('Older FAQ','warn'))}`;
    else if(used&&used.length){ const best=[...used].sort((x,y)=>rankOf(y)-rankOf(x))[0]; body=`<div class="cxh">${used.length} ${used.length===1?'source':'sources'} used</div>${used.map((d,i)=>row(d,i+1,(rankOf(d)===2?tg('Approved','ok'):tg(esc(d.authority),'warn')),d===best&&used.length>1)).join('')}`; }
    else body=`<div class="cxnone"><span class="cxni">${ICON('search',20)}</span><b>${a.kind==='none'?'Nothing found':'Nothing to show'}</b><p>${a.kind==='none'?`No source was good enough. The likely owner is ${esc(a.owner||'the owner')}.`:'This answer did not use any sources.'}</p></div>`;
  } else if(pt==='sources'){
    const sysOpts=['Any source','Google Drive','Confluence','Internal file system'];
    body=`<div class="cxf"><input id="srcq" class="cxin" placeholder="Search sources" aria-label="Search sources"><div class="cxpills"><select id="fsrc" class="cxsel" aria-label="Source type">${sysOpts.map((o,i)=>`<option value="${i?o:'all'}" ${(S.ask.src===o||(i===0&&S.ask.src==='all'))?'selected':''}>${o}</option>`).join('')}</select><select id="fdom" class="cxsel" aria-label="Domain"><option value="all">Any domain</option>${['Cards','Payments','Savings','Credit'].map(d=>`<option ${S.ask.dom===d?'selected':''}>${d}</option>`).join('')}</select><select id="fwhen" class="cxsel" aria-label="Date"><option value="all">Any date</option><option value="90" ${S.ask.when==='90'?'selected':''}>Last 90 days</option><option value="365" ${S.ask.when==='365'?'selected':''}>Last year</option></select></div></div><div class="gall"><span>${SRCDOCS.filter(id=>!off[id]&&canSee(D[id])).length} of ${VIS().length} selected</span><button class="link" id="selall">Select all</button></div><div class="glist" id="srclist">${srcRows('')}</div>`;
  } else {
    body=S.history.length?S.history.map((h,i)=>`<button class="ghist" data-hist="${i}"><span>${esc(titleOf(h))}</span><span class="x" data-del="${i}" title="Delete" aria-label="Delete">×</span></button>`).join(''):`<div class="cxnone"><p>Only you can see your history.</p></div>`;
  }
  const f=last&&last.fb;
  const tm=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const evRow=(ic,tone,t,d,time,hist)=>{ const tag=hist!==undefined?`button data-hist="${hist}"`:'div'; return `<${tag} class="cxtd"><span class="cxtdi ${tone||''}">${ICON(ic,18)}</span><span class="cxtx"><b>${esc(t)}</b><small>${esc(d)}</small></span><em class="cxtm">${time}</em></${hist!==undefined?'button':'div'}>`; };
  const LVL=(window.LEVELS||[])[(S.user&&S.user.level)||0]||'General';
  if(pt==='activity'){ const n0=new Date(); const sod=new Date(n0.getFullYear(),n0.getMonth(),n0.getDate()).getTime();
    const mine=S.history.map((q,i)=>[q,i,(S.saved&&S.saved[q]&&S.saved[q][0]&&S.saved[q][0].ts)||0]).filter(r=>r[2]>=sod).sort((x,y)=>y[2]-x[2]);
    const sys=[['check','','Synced Confluence','13 pages checked, 2 changed','8:02'],['check','','Synced Google Drive','10 files checked, 1 changed','8:03'],['shield','warn','Found a conflict','Card replacement fee: $5.00 or $7.50','8:41'],['clock','warn','Flagged a stale policy','Transfer Limits Policy, 150 days since review','9:05']];
    body=`<div class="cxstats"><div><b>${mine.length}</b><small>asked today</small></div><div><b>2</b><small>conflicts</small></div><div><b>1</b><small>fixed</small></div></div>`+
      (S.apOpen===false?'':`<div class="cxh">Waiting for you</div><div class="cxap"><b>Tell Daniel Reyes about the fee conflict?</b><small>Cards FAQ says $7.50, Fee Schedule 2026 says $5.00.</small><div><button type="button" class="btn sm primary" data-ap="1">Approve</button><button type="button" class="btn sm" data-ap="0">Skip</button></div></div>`)+
      `<div class="cxh">Today</div>`+mine.map(r=>evRow('chat','','Answered: '+titleOf(r[0]),'Read the sources and cited them',tm(r[2]),r[1])).join('')+sys.map(s=>evRow(s[0],s[1],s[2],s[3],s[4])).join(''); }
  if(pt==='memory'){ const u=S.user||{}; S.mem=S.mem||{gone:{}}; const topics=S.history.slice(0,3).map(titleOf).join(' · ')||'Nothing yet';
    const items=[['Preferred name',u.nick||(u.name||'').split(' ')[0]],['Team',u.team||''],['Access level',LVL],['Often asks about',topics]].filter(x=>x[1]&&!S.mem.gone[x[0]]);
    body=`<div class="cxh">What Broth remembers</div>`+(items.length?items.map(([k,v])=>`<div class="cxmem"><span><small>${k}</small><b>${esc(v)}</b></span>${k==='Access level'?`<span class="tag">From your work account</span>`:`<button type="button" class="btn sm" data-forget="${k}">Forget</button>`}</div>`).join(''):`<div class="cxnone"><p>Nothing remembered.</p></div>`)+`<p class="cxfoot">Only you can see this. Forgetting removes it for good.</p>`; }
  if(pt==='sources'){ const conns=[['Confluence',13,'8:02'],['Google Drive',10,'8:03'],['Notion',6,'8:04']].filter(c=>appsOn().includes(c[0]));
    body=`<div class="cxh">Connected</div>`+(conns.length?conns.map(([n,c,t])=>`<div class="cxcn">${SRCICON(n,22)}<span class="cxtx"><b>${n}</b><small>${c} documents, synced ${t}</small></span><span class="cxok">Healthy</span></div>`).join(''):`<div class="cxnone"><p>No sources connected yet.</p></div>`)+`<div class="cxaccess">${ICON('lock',16)}<span>Reads only what you can open. Access level: <b>${LVL}</b></span></div><div class="cxh">Choose what to ask</div>`+body; }
  const conn=appsOn().length>0;
  const tabs=[['activity','clock','Activity'],['answer','quote','Answer'],['sources','stack','Sources'],['memory','user','Memory']];
  p.innerHTML=`<button type="button" class="lib cxclose" id="cxclose" aria-label="Close panel">${ICON('x',16)}</button><div class="cxpro"><div class="cxav" id="cxav"></div><b class="cxname">Broth</b><span class="cxst ${conn?'on':''}"><i></i>${conn?'Connected':'No sources connected'}</span></div><div class="cxtabs">${tabs.map(([k,ic,l])=>`<button class="ltab ic ${pt===k?'on':''}" data-pt="${k}" aria-label="${l}" data-tip="${l}">${ICON(ic,18)}<span class="ltl">${l}</span></button>`).join('')}</div><div class="cxbody">${body}</div>`;
  { const av=$('#cxav'); if(av&&window.BROTH_MASCOT) av.innerHTML=window.BROTH_MASCOT.svg(); }
  p.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{ S.ask.pt=b.dataset.pt; save(); renderPanel(); });
  p.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>{ S.apOpen=false; save(); toast(b.dataset.ap==='1'?'Sent to Daniel Reyes':'Skipped'); renderPanel(); });
  p.querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{ S.mem.gone[b.dataset.forget]=true; save(); renderPanel(); });
  (()=>{ const tabs=p.querySelector('.cxtabs'); const on=tabs.querySelector('.ltab.on'); if(!on) return; const pill=document.createElement('span'); pill.className='cxpill'; tabs.prepend(pill);
    const tr=tabs.getBoundingClientRect(), r=on.getBoundingClientRect(); const l=r.left-tr.left, w=r.width; pill.style.cssText='left:'+l+'px;width:'+w+'px;height:'+r.height+'px;top:'+(r.top-tr.top)+'px';
    const prev=window._cxPrev; window._cxPrev={pt:pt,l:l,w:w}; const calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prev&&prev.pt!==pt&&pill.animate){ const dir=pt==='sources'?1:-1; const body=p.querySelector('.cxbody');
      pill.animate([{transform:'translateX('+(prev.l-l)+'px) scaleX('+(prev.w/w)+')'},{transform:'none'}],{duration:calm?1:260,easing:'cubic-bezier(.2,.8,.2,1)'});
      if(body&&!calm) body.animate([{opacity:0,transform:'translateX('+(dir*14)+'px)'},{opacity:1,transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
      else if(body) body.animate([{opacity:0},{opacity:1}],{duration:160}); } })();
  p.querySelectorAll('[data-rs]').forEach(c=>{ c.onclick=()=>openSource(c.dataset.rs); c.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openSource(c.dataset.rs); } }; });
  $('#cxclose',p).onclick=()=>{ setPanelOpen(false); S.ask.shut=true; save(); };
  const wireSrc=()=>p.querySelectorAll('[data-sd]').forEach(c=>c.onchange=()=>{ S.ask.off[c.dataset.sd]=!c.checked; save(); const k=SRCDOCS.filter(id=>!S.ask.off[id]&&canSee(D[id])).length; const cx=$('#cxsrc'); if(cx) cx.innerHTML=ICON('stack',14)+' '+k+' sources'; const g=p.querySelector('.gall span'); if(g) g.textContent=k+' of '+VIS().length+' selected'; });
  wireSrc();
  const sq=$('#srcq',p); if(sq) sq.oninput=e=>{ $('#srclist').innerHTML=srcRows(e.target.value); wireSrc(); };
  const sa=$('#selall',p); if(sa) sa.onclick=()=>{ S.ask.off={}; save(); renderPanel(); const cx=$('#cxsrc'); if(cx) cx.innerHTML=ICON('stack',14)+' '+VIS().length+' sources'; };
  const fs=$('#fsrc',p); if(fs){ fs.onchange=e=>{S.ask.src=e.target.value;save();toast('Applies to your next question');}; $('#fdom',p).onchange=e=>{S.ask.dom=e.target.value;save();toast('Applies to your next question');}; $('#fwhen',p).onchange=e=>{S.ask.when=e.target.value;save();toast('Applies to your next question');}; }
  p.querySelectorAll('[data-hist]').forEach(b=>b.onclick=e=>{ if(e.target.dataset.del!==undefined){ S.history.splice(+e.target.dataset.del,1); save(); renderPanel(); toast('Deleted from your history'); return; } S.ask.histUsed=true; S.ask.pt='answer'; ask(qOf(S.history[+b.dataset.hist])); });
  p.querySelectorAll('[data-hist]').forEach(b=>b.onkeydown=e=>{ if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); S.history.splice(+b.dataset.hist,1); save(); renderPanel(); toast('Deleted from your history'); } });
}
function pulsePanel(id){ S.ask.pt='answer'; setPanelOpen(true); renderPanel(); const t=document.querySelector(`#rsrc [data-rs="${id}"]`); if(!t){ openSource(id); return; } t.scrollIntoView({block:'nearest',behavior:'smooth'}); t.classList.remove('pulse'); void t.offsetWidth; t.classList.add('pulse'); }

function ask(q){ if(window._gen) window._gen.stop(true); S.ask.pt='answer';
  let _nc=null; if(!S.thread.length){ _nc=S._cid||newCid(); S._cid=null; (S.qs=S.qs||{})[_nc]=S.qs[_nc]||q; S.history = [_nc, ...S.history.filter(x=>x!==_nc)].slice(0,60); }
  const a = S.ask.err ? {kind:'error'} : answerFor(q);
  S.thread.push({q, a, fb:null, files:(S.ask.files||[]).slice(), ts:Date.now()}); if(_nc) S.thread[0].cid=_nc; S.ask.files=[]; if(S.ask._pendV){ const pv=S.ask._pendV; S.ask._pendV=null; const ne=S.thread[S.thread.length-1]; ne.V=pv.V; ne.c=pv.c; }
  if(a.kind!=='error') logAudit({who:S.role==='owner'?'Daniel Reyes (Owner)':'Sam Idowu (Employee)', channel:'Ask', q, outcome:a.kind, sources:(a.sources||(a.a?[a.a,a.b]:[])).map(d=>d.id), response:a.text||a.lead||'No good source found', policies:a.access?['Access','Grounding']:['Access','Grounding','Content']});
  if(a.kind==='none'&&!a.filtered) toast('Knowledge gap logged for the owner');
  save(); renderAsk(); renderSurfaces();
  const th=$('#thread'); const old=th.lastElementChild; const ne=turnEl(S.thread[S.thread.length-1],S.thread.length-1,true); old.replaceWith(ne); ne.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function fileHtml(entry){ const fs=entry.files||[]; if(!fs.length) return ''; const STOP=new Set(['what','which','about','that','this','with','from','have','does','your','their','there','when','where','how','the','and','for','are','can','you','our','who','why','was','were','will','would','should','could']); const ws=String(entry.q).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w));
  const blocks=fs.map(x=>{ let text=x.text; if(x.lib&&D[x.id]){ try{ text=String(D[x.id].text(D[x.id].value)).replace(/<[^>]+>/g,''); }catch(e){} }
    if(!text) return `<div class="fres"><div class="fh">${ICON('clip',14)}<b>${esc(x.name)}</b></div><p>${x.unreadable?'Broth cannot read this kind of file yet. Text, Markdown and CSV files work.':'Nothing to read in this file.'}</p></div>`;
    const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean); const scored=lines.map(l=>({l,n:ws.filter(w=>l.toLowerCase().includes(w)).length})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n).slice(0,3);
    const hi=l=>{ let o=esc(l.length>200?l.slice(0,200)+'…':l); ws.forEach(w=>{ o=o.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>'); }); return o; };
    return `<div class="fres"><div class="fh">${ICON('clip',14)}<b>${x.fid?`<button type="button" class="fln" data-pf="${x.fid}">${esc(x.name)}</button>`:esc(x.name)}</b></div>${scored.length?scored.map(o=>`<p class="fl">${hi(o.l)}</p>`).join(''):`<p>Nothing in this file matches the question.</p>`}</div>`; });
  return blocks.join(''); }
function trailRows(a){ const used=a.sources||(a.a?[a.a,a.b]:[]); const best=used.length?[...used].sort((x,y)=>rankOf(y)-rankOf(x))[0]:null; const sk=lockedFor().length; const rows=[[ICON('stack',15),`Searched ${VIS().length} sources in ${appsOn().length} apps`]]; if(sk) rows.push([ICON('lock',15),`Skipped ${sk} you cannot open`]); if(used.length) rows.push([ICON('doc',15),`Used ${used.length}: ${used.map(d=>esc(String(d.title).replace(/\s*\(internal\)/,''))).join(', ')}`]); if(best&&used.length>1){ const r=rankOf(best); rows.push([ICON('check',15),`${esc(String(best.title))} won: ${r===2?'approved policy, verified '+best.verified:r===1?'approved, but past its review date':'the only source found'}`]); } return rows; }
function citeHtml(text, sources){
  return esc(text).replace(/\[(\d)\]/g,(m,n)=>`<button class="cite" data-src="${sources[n-1].id}" aria-label="Source ${n}">${n}</button>`);
}

function turnEl(entry, idx, stream){
  const {q,a} = entry; const el = document.createElement('article');
  const prevE=S.thread[idx-1]; if(!entry.ts) entry.ts=Date.now(); const dchip=(!prevE||dayKey(prevE.ts)!==dayKey(entry.ts))?`<div class="dday"><span>${dayLabel(entry.ts,!prevE)}</span></div>`:'';
  el.innerHTML = `${dchip}<div class="umsg" title="${esc(new Date(entry.ts).toLocaleString())}"><span>${esc(q)}</span>${entry.a.follow?'<em>Follow-up</em>':''}${(entry.files&&entry.files.length)?`<div class="umf">${entry.files.map((x,i)=>attCard(x,i,false)).join('')}</div>`:''}</div><div class="umrow">${entry.V&&entry.V.length>1?`<div class="uver" role="group" aria-label="Versions of this message"><button type="button" data-vp aria-label="Previous version" ${entry.c<=0?'disabled':''}>${ICON('chevr',13)}</button><span><i>${entry.c+1}</i> / ${entry.V.length}</span><button type="button" data-vn aria-label="Next version" ${entry.c>=entry.V.length-1?'disabled':''}>${ICON('chevr',13)}</button></div>`:''}<div class="umt"><button type="button" class="uedit" data-edit="${idx}" aria-label="Edit question" title="Edit and resend">${ICON('compose',14)}</button><time datetime="${new Date(entry.ts).toISOString()}">${timeStr(entry.ts)}</time></div></div><div class="ans"></div><div class="extra"></div>`;
  const ans = $('.ans',el), extra=$('.extra',el);
  let timers=[]; const T=(f,ms)=>{ const t=setTimeout(f,ms); timers.push(t); return t; };
  const sendBtn=()=>document.querySelector('.cxcomp .dsend');
  const genEnd=()=>{ const b=sendBtn(); if(b&&b.classList.contains('stop')){ b.classList.remove('stop'); b.type='submit'; b.setAttribute('aria-label','Ask'); b.innerHTML=ICON('send',16); b.onclick=null; } if(window._gen&&window._gen.el===el) window._gen=null; };
  const stop=(silent)=>{ if(el._done||el._stopped) return; el._stopped=true; timers.forEach(clearTimeout); ans.classList.remove('thinking','cursor'); ans.removeAttribute('aria-live'); if(silent){ genEnd(); return; } if(ans.querySelector('.thk')) ans.textContent='Stopped before an answer.'; extra.innerHTML=`<div class="fb arow gact"><span class="tag">Stopped</span><button class="gpill" data-regen="1">${ICON('refresh',16)} Regenerate</button></div>`; genEnd(); bind(el,entry,idx); };
  const finish = () => { el._done=true; genEnd();
    if(a.kind==='answered'||a.kind==='low'){
      ans.innerHTML = citeHtml(a.text, a.sources);
            if(a.hidden&&a.hidden.length) extra.innerHTML += lockedHtml(a.hidden);
      extra.innerHTML += `<div class="srcrow">`+pillHtml(a)+`</div>`  + fbHtml(entry,idx,{share:true}) + fuHtml(a);
    } else if(a.kind==='conflict'){
      const reported = S.reported;
      ans.textContent = a.lead;
      extra.innerHTML = `<div class="conflict"><div class="cfh">Two sources disagree</div>
        ${[a.a,a.b].map((d,i)=>`<button class="cfrow ${i?'':'best'}" data-src="${d.id}">${SRCICON(d.system,22)}<span class="cft"><b>${esc(d.title)}</b><small>${esc(d.system)} · ${d.verified}</small></span><span class="cfv">$${d.value}</span>${i?'':'<span class="tag ok" title="Broth recommends this source">Recommended</span>'}</button>`).join('')}
        <div class="cff"><button class="btn sm" id="report" ${reported?'disabled':''}>${reported?'Reported to owner':'Report to owner'}</button></div></div>` + fbHtml(entry,idx,{});
    } else if(a.kind==='restricted'){
      ans.textContent = 'I can\'t show that answer. You don\'t have access to the sources behind it.';
      extra.innerHTML = lockedHtml(a.hidden) + fbHtml(entry,idx,{});
    } else if(a.kind==='error'){
      ans.textContent = 'I could not reach Broth just now.';
      extra.innerHTML = `<div class="notice low"><span>Your question was not lost. <button class="link" id="retryq">Try again</button></span></div>`;
    } else {
      { const fn=(entry.files||[]).map(x=>x.name).filter(Boolean); ans.textContent = fn.length?`You attached ${fn.join(', ')}. This prototype cannot read file contents beyond a preview, and no source matched your question.`:`I could not find a good source for that.`; }
      extra.innerHTML = (a.accessLimited?`<div class="notice access" style="margin-bottom:10px"><span>Some content may not be visible to you.</span></div>`:'')+`<div class="notice none"><span>The likely owner is <b>${esc(a.owner)}</b> ${a.person?'('+PERSON(a.person,16)+')':''}. Your question was logged so they can see the gap.</span></div>` + fbHtml(entry,idx,{});
    }
    { const fr=fileHtml(entry); if(fr) extra.insertAdjacentHTML('afterbegin',fr); }
    bind(el, entry, idx);
    if(idx===S.thread.length-1) renderPanel();
    const ch=$('#chat'); if(ch) ch.scrollTop=ch.scrollHeight;
  };
  const go=()=>{ if(stream && (a.kind==='answered'||a.kind==='low')){
    const words = a.text.split(' '); let i=0; ans.classList.add('cursor');
    const tick = () => { ans.innerHTML = citeHtml(words.slice(0,++i).join(' '), a.sources); if(i<words.length) T(tick,45); else { ans.classList.remove('cursor'); finish(); } };
    tick();
  } else finish(); };
  if(stream&&a.kind!=='error'){ const b=sendBtn(); if(window._gen) window._gen.stop(true); window._gen={el,stop}; if(b){ b.classList.add('stop'); b.type='button'; b.setAttribute('aria-label','Stop'); b.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/></svg>'; b.onclick=()=>stop(false); } }
  const calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(stream && a.kind!=='error' && !calm){
    const ap=appsOn(); const steps=[(entry.files&&entry.files.length)?'Reading your files':'Searching your sources','Checking what you can access','Writing the answer'];
    ans.classList.add('thinking'); ans.setAttribute('aria-live','polite');
    ans.innerHTML=`<span class="thk"><span class="thk-l">${ap.map((k,j)=>`<i style="--j:${j}">${SRCICON(k,16)}</i>`).join('')}</span><span class="thk-t" id="thkt">${steps[0]}</span></span>`;
    steps.slice(1).forEach((t,j)=>T(()=>{ const n=el.querySelector('.thk-t'); if(n){ n.classList.remove('sw'); void n.offsetWidth; n.textContent=t; n.classList.add('sw'); } },(j+1)*620));
    T(()=>{ ans.classList.remove('thinking'); ans.removeAttribute('aria-live'); ans.textContent=''; go(); },620*3);
  } else go();
  return el;
}
function rankOf(d){ return /Approved/.test(d.authority)&&!/past/.test(d.authority)?2:/Approved/.test(d.authority)?1:0; }
function pillHtml(a){ return `<button class="srcpill" data-pill="1"><span class="favs">${a.sources.slice(0,3).map(d=>`<i><img src="assets/svg/${SRCIMG[d.system]||'src-filesystem'}.svg" alt="" width="14" height="14"></i>`).join('')}</span>${a.sources.length===1?'1 source':a.sources.length+' sources'} read</button>`; }
const FU={fee:['Is it waived?','How long is delivery?'],limit:['What about business accounts?','What about standard accounts?'],rate:['When was this last verified?'],crypto:['Can staff accept crypto from partners?'],escal:['Is there a deadline?']};
function fuHtml(a){ let l=(FU[a.topic]||[]).slice(0,1); if(a.sources&&a.sources[0]&&a.topic!=='meta'){ l=l.concat(['Who owns this?','When was this last verified?']); l=l.filter((x,i)=>l.indexOf(x)===i).slice(0,3); } else if(a.topic==='meta'){ l=['Who owns this?','When was this last verified?'].filter(x=>!(a.text&&((/owned by/.test(a.text)&&/owns/.test(x))||(/last verified/.test(a.text)&&/verified/.test(x))))); } return l.length?`<div class="fu"><div class="gm-sugs left" style="margin:14px 0 0">${l.map(q=>`<button class="gm-sug" data-fu="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`:''; }
function openSources(a){ const d=$('#drawer'); d.innerHTML=`<button class="btn sm" id="dclose">Close</button><h3>Sources</h3><p class="sub" style="margin:0 0 12px">${a.sources.length} used for this answer</p>${a.sources.map((s,i)=>`<div class="card" style="cursor:default"><div class="row"><span class="cite">${i+1}</span>${rankOf(s)===2?'<span class="tag ok">Approved</span>':'<span class="tag warn">'+esc(s.authority)+'</span>'}</div><div class="ttl">${esc(s.title)}</div><div class="meta">${esc(s.system)} · ${PERSON(s.owner,16)} · verified ${s.verified}</div><div class="passage" style="margin:10px 0 6px">${s.text((s.id==='cards_faq'||s.id==='fee_schedule')?s.value:null)}</div><button class="link" data-src="${s.id}">Open source panel</button></div>`).join('')}`; $('#dclose').onclick=closeDrawer; d.querySelectorAll('[data-src]').forEach(b=>b.onclick=()=>openSource(b.dataset.src)); d.classList.add('on'); $('#scrim').classList.add('on'); }
function fbHtml(entry,idx,o){ o=o||{};
  const f = entry.fb; const reasons = ['Wrong','Outdated','Incomplete','Could not check'];
  return `<div class="fb arow gact" data-fb="${idx}">
    ${o.share?`<button class="gic" data-copy="1" aria-label="Copy">${ICON('copy',18)}</button><button class="gic" data-regen="1" aria-label="Regenerate" title="Regenerate">${ICON('refresh',18)}</button>`:''}
    ${o.share?`<button class="gic" data-save="1" aria-pressed="${window.SAVED&&window.SAVED.has(entry.q)}" aria-label="Save answer" title="Save answer">${ICON('bookmark',18)}</button>`:''}
    <button class="gic" aria-pressed="${f&&f.v==='up'}" data-v="up" aria-label="Helpful">${ICON('thumbup',18)}</button>
    <button class="gic" aria-pressed="${f&&f.v==='down'}" data-v="down" aria-label="Not helpful">${ICON('thumbdown',18)}</button>
    ${f&&f.v==='down'&&!f.r?`<div class="reasons">${reasons.map(r=>`<button class="chip" data-r="${r}">${r}</button>`).join('')}</div>`:''}
    ${f&&f.r?`<span class="tag">${esc(f.r)}, thanks</span>`:''}
    ${f&&f.v==='up'?`<span class="tag ok">Thanks</span>`:''}
  </div>`; }
function bind(el, entry, idx){
  el.querySelectorAll('[data-hia]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const ex=document.querySelector('.hiapop'); if(ex){ ex.remove(); if(ex._for===b) return; }
    const pop=document.createElement('div'); pop.className='hiapop'; pop.setAttribute('role','dialog'); pop._for=b; pop.innerHTML=`<div class="hh">How I answered</div>${trailRows(entry.a).map(r=>`<div class="hr"><span>${r[0]}</span><p>${r[1]}</p></div>`).join('')}`; document.body.appendChild(pop);
    const r=b.getBoundingClientRect(); const w=pop.offsetWidth; pop.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left))+'px'; const below=r.bottom+pop.offsetHeight+12<innerHeight; pop.style.top=(below?r.bottom+8:r.top-pop.offsetHeight-8)+'px';
    if(pop.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches) pop.animate([{opacity:0,transform:'translateY('+(below?-6:6)+'px) scale(.97)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
    const close=()=>{ pop.remove(); document.removeEventListener('mousedown',out,true); document.removeEventListener('keydown',key,true); }; const out=ev=>{ if(!pop.contains(ev.target)&&!b.contains(ev.target)) close(); }; const key=ev=>{ if(ev.key==='Escape') close(); }; document.addEventListener('mousedown',out,true); document.addEventListener('keydown',key,true); });
  el.querySelectorAll('[data-flag]').forEach(b=>b.onclick=()=>{ (S.flagged=S.flagged||{})[b.dataset.flag]=true; save(); const w=b.parentElement; b.replaceWith(Object.assign(document.createElement('span'),{className:'tag ok',textContent:'Flagged'})); toast('Flagged to '+first((D[b.dataset.flag]||{}).owner)); });
  el.querySelectorAll('.cite[data-src]').forEach(b=>b.onclick=()=>pulsePanel(b.dataset.src));
  el.querySelectorAll('[data-src]:not(.cite)').forEach(b=>b.onclick=()=>openSource(b.dataset.src));
  { const go=d=>{ const V=entry.V.slice(); const k=entry.c+d; if(k<0||k>=V.length) return; if(window._gen) window._gen.stop(true); V[entry.c]=S.thread.slice(idx).map(e=>({q:e.q,fb:e.fb||null,ts:e.ts,files:e.files||[]})); const tail=(V[k]||[]).map(e=>Object.assign({},e,{a:answerFor(e.q)})); if(!tail.length) return;
      const calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches; const ease='cubic-bezier(.2,.8,.2,1)';
      const th0=document.getElementById('thread'); const keepH=th0?th0.offsetHeight:0;
      const swap=()=>{ tail[0].V=V; tail[0].c=k; { const c0=S.thread[0]&&S.thread[0].cid; S.thread=S.thread.slice(0,idx).concat(tail); if(c0) S.thread[0].cid=c0; } save(); renderAsk(); renderSurfaces(); const th=document.getElementById('thread'); if(th&&keepH){ th.style.minHeight=keepH+'px'; setTimeout(()=>{ th.style.minHeight=''; },400); }
        if(calm) return; [...document.querySelectorAll('#thread article')].slice(idx).forEach(a=>{ const um=a.querySelector('.umsg'), num=a.querySelector('.uver i'); const rest=[...a.children].filter(c=>c!==um&&!c.classList.contains('umrow')&&!c.classList.contains('dday'));
          if(um&&um.animate) um.animate([{opacity:.25},{opacity:1}],{duration:200,easing:'ease-out'});
          if(num&&num.animate) num.animate([{opacity:0,transform:'translateY('+(d*5)+'px)'},{opacity:1,transform:'none'}],{duration:180,easing:ease});
          rest.forEach(r=>{ if(r.animate) r.animate([{opacity:.2,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:220,easing:ease}); }); }); };
      swap(); };
        const pv=el.querySelector('[data-vp]'), nx=el.querySelector('[data-vn]'); if(pv) pv.onclick=()=>go(-1); if(nx) nx.onclick=()=>go(1); }
  el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{ const um=el.querySelector('.umsg'); if(!um||um.classList.contains('editing')) return; if(window._gen) window._gen.stop(true); const q=entry.q; um.classList.add('editing'); const row=el.querySelector('.umt'); if(row) row.style.visibility='hidden';
    const keep=um.innerHTML; um.innerHTML=`<textarea class="uedta" rows="1" aria-label="Edit your question">${esc(q)}</textarea>`; const act=document.createElement('div'); act.className='uedact'; act.innerHTML=`<button type="button" class="btn sm" data-uc>Cancel</button><button type="button" class="btn sm primary" data-us>Send</button>`; um.appendChild(act);
    if(um.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches) um.animate([{opacity:.55,transform:'scale(.96)',transformOrigin:'100% 100%'},{opacity:1,transform:'none'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
    const ta=um.querySelector('textarea'); const fit=()=>{ ta.style.height='auto'; ta.style.height=Math.min(200,ta.scrollHeight)+'px'; }; fit(); ta.focus(); ta.setSelectionRange(q.length,q.length); ta.oninput=fit;
    const cancel=()=>{ act.remove(); um.classList.remove('editing'); um.innerHTML=keep; if(um.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches) um.animate([{opacity:.6,transform:'scale(1.03)',transformOrigin:'100% 100%'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'}); if(row) row.style.visibility=''; const nb=um.parentElement.querySelector('[data-edit]'); if(nb) nb.onclick=b.onclick; };
    const send=()=>{ const v=ta.value.trim(); if(!v||v===q){ cancel(); return; } const mn=e=>({q:e.q,fb:e.fb||null,ts:e.ts,files:e.files||[]}); const cur=S.thread.slice(idx).map(mn); const V=entry.V?entry.V.slice():[cur]; const c0=entry.V?entry.c:0; V[c0]=cur; V.push(null); S.ask._pendV={V,c:V.length-1}; if(idx===0){ S._cid=S.thread[0].cid; if(S.qs&&S._cid) S.qs[S._cid]=v; } S.thread=S.thread.slice(0,idx); save(); ask(v); };
    act.querySelector('[data-uc]').onclick=cancel; act.querySelector('[data-us]').onclick=send;
    ta.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } else if(e.key==='Escape'){ e.preventDefault(); cancel(); } }; });
  el.querySelectorAll('[data-regen]').forEach(b=>b.onclick=()=>{ const q=entry.q; if(idx===0) S._cid=S.thread[0].cid; S.thread=S.thread.slice(0,idx); save(); ask(q); });
  el.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{ try{navigator.clipboard.writeText(String(entry.a.text||'').replace(/<[^>]+>/g,''));}catch(e){} if(!b.dataset.orig) b.dataset.orig=b.innerHTML; b.innerHTML=ICON('check',18); b.classList.add('done'); b.setAttribute('aria-label','Copied'); toast('Copied'); clearTimeout(b._t); b._t=setTimeout(()=>{ b.innerHTML=b.dataset.orig; b.classList.remove('done'); b.setAttribute('aria-label','Copy'); },1800); });
  el.querySelectorAll('[data-req]').forEach(b=>b.onclick=()=>requestAccess(b.dataset.req));
  el.querySelectorAll('[data-owner]').forEach(b=>b.onclick=()=>toast('Message sent to '+D[b.dataset.owner].owner));
  el.querySelectorAll('[data-pill]').forEach(b=>b.onclick=()=>{ if(innerWidth>860) { const f=entry.a.sources[0]; pulsePanel(f.id); } else openSources(entry.a); });
  el.querySelectorAll('[data-fu]').forEach(b=>b.onclick=()=>ask(b.dataset.fu));
  const r = $('#report',el); if(r) r.onclick=()=>report();
  const rq=$('#retryq',el); if(rq) rq.onclick=()=>{ S.ask.err=false; S.thread.pop(); save(); ask(entry.q); };
  el.querySelectorAll('.fb [data-save]').forEach(b=>b.onclick=()=>{ if(window.SAVED.has(entry.q)){ window.SAVED.drop(entry.q); b.setAttribute('aria-pressed','false'); toast('Removed from Saved'); } else { window.SAVED.add(entry.q,String((entry.a&&entry.a.text)||'').replace(/<[^>]*>/g,'').slice(0,160),((entry.a&&entry.a.sources)||[]).map(s=>s.system).filter((v,i,a2)=>v&&a2.indexOf(v)===i)); b.setAttribute('aria-pressed','true'); toast('Saved. Broth will tell you if it changes.'); } });
  el.querySelectorAll('.fb [data-v]').forEach(b=>b.onclick=()=>{ entry.fb={v:b.dataset.v}; save(); rerender(el,entry,idx); });
  el.querySelectorAll('.fb [data-r]').forEach(b=>b.onclick=()=>{ entry.fb={v:'down',r:b.dataset.r}; save(); rerender(el,entry,idx); });
}
function rerender(el,entry,idx){ const n=turnEl(entry,idx,false); el.replaceWith(n); renderPanel(); }

function report(){
  S.reported = true;
  if(!S.items.find(i=>i.id==='i0')) S.items.unshift({id:'i0', type:'contradiction', title:'Replacement card fee differs between two documents', domain:'Cards', impact:23, owner:'Daniel Reyes', status:'open', age:'just now',
    docs:['fee_schedule','cards_faq'], note:'Found while answering a staff question. 23 questions affected this month.'});
  save(); toast('Sent to Daniel Reyes.'); renderAsk(); renderSurfaces();
}

function openSource(id){
  const d = D[id]; const v = (id==='cards_faq'||id==='fee_schedule') ? (d.value) : null;
  const team=(window.DOC_TEAM&&window.DOC_TEAM[d.id])||(window.OWNER_TEAM&&window.OWNER_TEAM[d.owner])||'Team'; const members=Object.values(window.DIRECTORY||{}).filter(p=>p.team===team); const lvl=d.level||0; const good=/Approved/.test(d.authority)&&!/past/.test(d.authority);
  $('#drawer').innerHTML = `<div class="sv"><div class="sv-top"><span class="sv-sys">${SRCICON(d.system,20)}${esc(d.system)}</span><button class="xbtn2" id="dclose" aria-label="Close">${ICON('x',16)}</button></div>
    <div class="sv-body"><h2>${esc(d.title)}</h2>
    <div class="sv-tags"><span class="sv-team"><b>${esc(team)}</b><span class="sv-stack">${members.slice(0,5).map(m=>window.AVATAR(m.name,'lav',22)).join('')}${members.length>5?`<em>+${members.length-5}</em>`:''}</span></span>${good?'':`<span class="tag warn">${esc(d.authority)}</span>`}</div>
    <blockquote class="sv-q">${d.text(v)}</blockquote>
    <div class="sv-own">${window.AVATAR(d.owner,'lav',40)}<div><b>${esc(d.owner)}</b><small>${esc(d.ownerRole)}</small></div><span class="sv-ver"><small>Verified</small>${d.verified}</span></div>
    </div>
    <div class="sv-act"><button class="btn primary" id="dopen">${SRCICON(d.system,16)}Open in ${esc(d.system)}</button><button class="btn" id="ddet">Details and lineage</button></div></div>`;
  $('#dclose').onclick=closeDrawer; $('#dopen').onclick=()=>{ closeDrawer(); sourceEditor(id, false); }; $('#ddet').onclick=()=>{ closeDrawer(); window.DOCDETAIL&&window.DOCDETAIL(id); };
  const inLib=S.surface==='library'; if(inLib){ $('#drawer').classList.add('shell'); document.body.classList.add('dsopen'); } else { $('#drawer').classList.remove('shell'); document.body.classList.remove('dsopen'); } $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden','false');
}
function closeDrawer(){ $('#drawer').classList.remove('on'); $('#drawer').classList.remove('wide'); $('#scrim').classList.remove('on'); document.body.classList.remove('dsopen'); setTimeout(()=>{ if(!$('#drawer').classList.contains('on')) $('#drawer').classList.remove('shell'); },320); }
$('#scrim').onclick = closeDrawer;
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeDrawer(); closeModal(); } });

/* simulated source system, where the owner edits */
function sourceEditor(id, canEdit){
  const d = D[id]; const editable = ['cards_faq','pricing','public_fee'].includes(id);
  const body = id==='cards_faq' ? `A replacement card costs $<input class="edit" id="newval" value="${d.value}" aria-label="Fee"> . Delivery takes 5 to 7 working days.`
    : id==='pricing' ? `Partner rates and volume tiers for 2026.<br><br>Sharing: <select id="newval" class="edit" style="width:auto" aria-label="Sharing"><option>${S.flags.pricingNarrowed?'Compliance only':'Anyone in Broth'}</option><option>Compliance only</option><option>Anyone in Broth</option></select>`
    : id==='public_fee' ? `The first replacement card is <input class="edit" id="newval" style="width:240px" value="${esc(d.value)}" aria-label="Wording">.`
    : d.text(d.value);
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-label="${esc(d.system)}"><div class="bar"><span>${esc(d.system)} · ${esc(d.title)}</span><button class="link" id="mclose">Close</button></div>
    <div class="body"><h2>${esc(d.title)}</h2><p>${body}</p>
    <p style="color:var(--mute);font-size:13px">This is a stand-in for the real ${esc(d.system)} page. Broth never edits here.</p>
    <div class="actions">${editable?`<button class="btn blue" id="msave">Save in ${esc(d.system)}</button>`:''}<button class="btn" id="mclose2">Close</button></div></div></div>`;
  $('#modal').classList.add('on'); $('#mclose').onclick=$('#mclose2').onclick=closeModal;
  const sv=$('#msave'); if(sv) sv.onclick=()=>{ const v=$('#newval').value.trim();
    if(id==='pricing'){ S.flags.pricingNarrowed=(v==='Compliance only'); }
    else if(id==='public_fee'){ D.public_fee.value=v; S.flags.publicFixed=/\$5/.test(v); S.flags.publicText=v; }
    else { D.cards_faq.value=v; D.cards_faq.verified='1 Nov 2026'; D.cards_faq.authority='FAQ, reviewed'; localStorage.setItem(KEY+'-faq',v); } save(); closeModal(); toast('Saved in '+d.system); };
}
function closeModal(){ $('#modal').classList.remove('on'); }
const faq = localStorage.getItem(KEY+'-faq'); if(faq){ D.cards_faq.value=faq; }
if(S.flags&&S.flags.publicText) D.public_fee.value=S.flags.publicText;

/* ---------- shell ---------- */
const NAVI={library:'book',inbox:'inbox',saved:'bookmark',connectors:'grid'};
function navBtn(k,label,cur,badge){ return `<button class="surf" data-s="${k}" ${badge?`data-badge="${badge}"`:''} aria-current="${cur?'page':'false'}">${ICON(NAVI[k],16)}<span>${label}</span></button>`; }
const CARET='<svg class="car" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.75L5 6.25l2.5-2.5"/></svg>';
function renderSurfaces(){
  if(!Array.isArray(S.thread)) S.thread=[];
  const sf=S.surface||'app';
  const inAsk=sf==='app';
  document.body.classList.toggle('nochats',!inAsk);
  const nb=(attr,icon,label,cur,extra,cls)=>`<button class="surf ${cls||''}" ${attr} aria-current="${cur?'page':'false'}">${icon}<span>${label}</span>${extra||''}</button>`;
    let h='';
  h+=nb('data-home="1"',ICON('compose',16),'New chat',inAsk&&!S.thread.length&&!S.ask.stack,'','newchat-nav');
  h+=nb('data-search="1"',ICON('search',16),'Search',false,'<kbd class="skbd">⌘K</kbd>','');
  h+=navBtn('library','Library',sf==='library')+navBtn('inbox','Inbox',sf==='inbox',(window.INBOX&&window.INBOX.open())||0)+navBtn('saved','Saved',sf==='saved');
  { const tsOf=q=>(S.saved&&S.saved[q]&&S.saved[q][0]&&S.saved[q][0].ts)||0; const now=new Date(); const sod=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); const cur=S.thread[0]&&S.thread[0].cid;
    const grp=q=>{ if(S.pins&&S.pins[q]) return 'Pinned'; const t=tsOf(q); if(!t) return 'Earlier'; if(t>=sod) return 'Today'; if(t>=sod-864e5) return 'Yesterday'; if(t>=sod-6*864e5) return 'Previous 7 days'; return 'Earlier'; };
    const order=['Pinned','Today','Yesterday','Previous 7 days','Earlier']; const by={}; S.history.forEach((q,i)=>{ (by[grp(q)]=by[grp(q)]||[]).push([q,i]); });
    const row=([q,i])=>`<button class="surf chat" data-chat="${i}" title="${esc(titleOf(q))}" aria-current="${cur===q?'page':'false'}"><span class="chn">${esc(titleOf(q))}</span><span class="chedit" data-ren="${i}" role="button" tabindex="0" aria-label="Chat actions" aria-haspopup="menu">${ICON('more',16)}</span></button>`;
    h=`<div class="snav">${h}</div>`;
    h+=S.history.length?`<div class="srec" role="list" aria-label="Chats">${order.filter(k=>by[k]).map(k=>`<div class="sgl">${k}</div>${by[k].map(row).join('')}`).join('')}</div>`:`<div class="srec"><p class="sempty">Your chats show up here.</p></div>`; }
  $('#surfaces').innerHTML=h; if(window.BROTH_RAIL) window.BROTH_RAIL();
  document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{S.surface=b.dataset.s; if(b.dataset.clr){ S.ask.team=null; S.selected=null; } save(); route(); window.scrollTo(0,0);});
  const goHome=()=>{ S.surface='app'; S.mode='ask'; S.thread=[]; S.ask.stack=null; S.ask.off={}; S.ask.open=false; save(); route(); };
  document.querySelectorAll('[data-home]').forEach(b=>b.onclick=goHome);
  document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true})));
  const ws=$('#newchat'); if(ws) ws.onclick=goHome;
  const fd=$('#findbtn'); if(fd) fd.onclick=()=>{ const k=document.querySelector('.top-right .kbtn:not(#bell)'); if(k) k.click(); };
  document.querySelectorAll('[data-ren]').forEach(p=>{ const go=e=>{ e.stopPropagation(); e.preventDefault(); const row=p.closest('.surf'); const q=S.history[+p.dataset.ren]; chatMenu(p,q,{rename:()=>{ const n=row.querySelector('.chn'); row.dataset.editing='1'; editTitle(n,q,()=>{ renderSurfaces(); if(S.thread[0]) renderAsk(); }); }}); }; p.onclick=go; p.onkeydown=e=>{ if(e.key==='Enter'||e.key===' ') go(e); }; });
  document.querySelectorAll('[data-chat]').forEach(b=>b.onclick=(e)=>{ if(e.target.closest('.ttin,.chedit')||b.dataset.editing) return; openChat(S.history[+b.dataset.chat]); });
}
const CRUMB={article:['Workspace','Help'],chats:['Workspace','Chats'],library:['Workspace','Library'],connectors:['Workspace','Connectors'],inbox:['Workspace','Inbox'],docs:['Help','Docs and support'],saved:['Workspace','Saved'],account:['Account',''],app:['Workspace','New chat'],bot:['Workspace','Support agent']};
function setCrumb(){ const sf=S.surface||'app'; let c=CRUMB[sf]||['Workspace',''];
  $('#crumb').innerHTML=`<span>${c[0]}</span><i>›</i><span class="cur">${c[1]}</span><span class="lsp"></span><button class="lib" id="ccopy" aria-label="Copy link">${ICON('link',16)}</button>`; const cb=$('#ccopy'); if(cb) cb.onclick=()=>{ try{navigator.clipboard.writeText(location.href).catch(()=>{});}catch(e){} toast('Link copied'); }; }
function signin(){ if(window.AUTH) window.AUTH.signin(); }
function mbTitle(){ const t=document.getElementById('mbtitle'); if(!t) return; const sf=S.surface||'app'; const M={library:'Library',docs:'Docs and support',inbox:'Inbox',saved:'Saved',connectors:'Connectors',account:'Account',chats:'Chats',bot:'Support agent',article:'Help'}; t.textContent=M[sf]||(S.thread.length?titleOf(S.thread[0].q):'New chat'); }
function setTheme(){ mbTitle(); document.body.classList.remove('navopen'); const nt=$('#navtog'); if(nt) nt.setAttribute('aria-expanded','false'); document.body.dataset.theme='lin'; document.body.dataset.sf=S.surface||'app'; setCrumb(); }
let _rk=null;
function route(){
  const rk=(S.surface||'app')+'|'+(S.mode||'')+'|'+(S.bot&&S.bot.view)+'|'+(S.selected||'')+'|'+(S.user?1:0)+(S.user&&S.user.team?1:0);
  const moved=_rk!==null&&rk!==_rk; if(moved&&(S.surface||'app')!=='app') GR.on=false; _rk=rk; route0();
  if(moved&&!document.querySelector('#modal.on,#drawer.on,#cmdk.on')){ const a=document.activeElement; const m=document.getElementById('app'); if(m&&(!a||a===document.body||!document.contains(a)||(a!==m&&!m.contains(a)&&!a.closest('.top,#coach')))){ m.setAttribute('tabindex','-1'); m.focus({preventScroll:true}); } }
}
function route0(){
  S.mode='ask'; $('#app').className='';
  if((S.surface||'app')!=='app'&&!window.SURFACES[S.surface]) S.surface='app';
  if(S.user&&window.DIRECTORY&&window.DIRECTORY[S.user.email]){ const dr=window.DIRECTORY[S.user.email].roles; if(dr&&JSON.stringify(dr)!==JSON.stringify(S.user.roles)){ S.user.roles=dr.slice(); save(); } }
  { const hasOwner=!!(S.user&&S.user.roles&&(S.user.roles.includes('owner')||S.user.roles.includes('domain'))); S.role=hasOwner?'owner':'employee'; }
  const sf=S.surface||'app'; renderSurfaces(); setCrumb();
  const isApp=sf==='app';
  closeDrawer(); closeModal();
  document.body.classList.toggle('noauth',(!S.user&&sf==='app')||(S.user&&S.user.welcomed===false));
  if(!S.user && sf==='app'){ signin(); return; }
  if(S.user && S.user.welcomed===false){ window.AUTH.welcome(); return; }
  if(S.user && !S.user.team && sf==='app'){ window.AUTH.picker(); return; }
  if(!isApp){ window.SURFACES[sf](); window.AUTH&&window.AUTH.after(); setTheme(); return; }
  renderAsk();
  window.AUTH&&window.AUTH.after(); setTheme();
}
window.SURFACES={};
window.BRAIN={haptic,qOf,openChat,chatMenu,titleOf,editTitle,cancelRequest,appsOn,renderSurfaces,ICON:window.ICON,doNext,myLevel,canSee,requestAccess,lockedFor,get S(){return S},save,toast,esc,D,logAudit,route,openSource,answerFor,openSources,closeModal,closeDrawer,ask,start(){ route(); }};
{ const setSb=(c,anim)=>{ document.body.classList.toggle('sbc',c); try{localStorage.setItem('brain-sbc',c?'1':'0');}catch(e){} const t=document.getElementById('sbtog'); if(t){ t.setAttribute('aria-label',c?'Expand sidebar':'Collapse sidebar'); t.title=c?'Expand sidebar':'Collapse sidebar'; } const o=document.getElementById('sbopen'); if(o&&c){ o.animate&&o.animate([{opacity:0,transform:'scale(.7)'},{opacity:1,transform:'none'}],{duration:240,delay:140,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}); } };
  try{ if(localStorage.getItem('brain-sbc')==='1') document.body.classList.add('sbc'); }catch(e){}
  $('#sbtog').onclick=()=>setSb(true); $('#sbcol').onclick=()=>setSb(true); $('#sbopen').onclick=()=>setSb(false);
  document.addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='\\'){ e.preventDefault(); setSb(!document.body.classList.contains('sbc')); } }); }
{ const nav=o=>{ document.body.classList.toggle('navopen',o); const m=document.getElementById('mbmenu'); if(m) m.setAttribute('aria-expanded',o); };
  document.getElementById('mbmenu').onclick=()=>nav(!document.body.classList.contains('navopen'));
  document.getElementById('navscrim').onclick=()=>nav(false);
  document.getElementById('mbclose').onclick=()=>nav(false);
  document.getElementById('mbnew').onclick=()=>{ nav(false); S.surface='app'; S.mode='ask'; S.thread=[]; S.ask.stack=null; S.ask.off={}; S.ask.open=false;   save(); route(); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') nav(false); }); }
$('#navtog').onclick=()=>{ const o=document.body.classList.toggle('navopen'); $('#navtog').setAttribute('aria-expanded',o); };
})();
