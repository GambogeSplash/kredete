(() => {
const M = window.Motion; const B = window.BRAIN; if(!M||!B) return;
const {animate, stagger, scroll, spring} = M;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const EASE=[.22,1,.36,1];
const app=$('#app');

/* ---------- entrance system ---------- */
const SEL='h1,.sub,.stat,.cell,.panel,.card,.audrow,.optcard,.tgl,tbody tr,table tr,.chunk,.stg,.banner,.notice,.conflict,.tour,.entry button,.dnav button,.thread>article,.state-list li,.hist button,.cellm,.detail,.slack .sm,.phone,.doc>p,.doc>h2,.doc>ul,.doc>pre,.doc>table,.toolbar,.askbox,.form,.side,.step,.swatch,.docs-side,.empty,.flt,.chips,.ans';
const viewKey=()=>{ const S=B.S; return [S.route.surface,S.route.path||S.route.params.id||'',S.me?1:0].join('|'); };
let lastKey='', seen=new Set();
const sig=el=>{ if(el.matches('.m,.ans')) return el.tagName+'.'+el.className.replace(/\s*cursor/,'')+'|'+[...el.parentNode.children].indexOf(el); return el.tagName+'.'+(el.className||'')+'|'+(el.textContent||'').trim().slice(0,70); };
function enter(nodes, full){
  if(RM||!nodes.length||window.__entering) return;
  const top=nodes.filter(n=>!nodes.some(o=>o!==n&&o.contains(n))&&!n.closest('.si-in'));
  top.slice(0,60).forEach((el,i)=>{
    el.style.opacity='0';
    const d=Math.min(i,8)*0.018;
    animate(el,{opacity:[0,1],y:[full?8:6,0]},{duration:.22,delay:d,ease:EASE}).finished.then(()=>{el.style.opacity='';el.style.transform='';}).catch(()=>{el.style.opacity='';});
  });
  // bars and counters
  top.forEach(el=>{ $$('.bar i',el).concat(el.matches('.bar i')?[el]:[]).forEach(b=>{ if(b.style.width){ b.style.transformOrigin='left'; animate(b,{scaleX:[0,1]},{duration:.4,delay:.08,ease:EASE}); } });
    $$('.stat .n',el).concat(el.matches('.stat .n')?[el]:[]).forEach(n=>countUp(n)); if(el.classList&&el.classList.contains('stat')){ const n=$('.n',el); if(n) countUp(n);} });
}
function countUp(n){ if(n._cu) return; const t=n.textContent.trim(); const m=t.match(/^(\d[\d,]*)(%?)$/); if(!m) return; n._cu=1; const to=+m[1].replace(/,/g,''); animate(0,to,{duration:.5,ease:EASE,onUpdate:v=>{n.textContent=Math.round(v).toLocaleString('en-US')+m[2];}}); }
const isInd=n=>n.nodeType===1&&(n.classList.contains('ind-pill')||n.classList.contains('ind-line')||n.classList.contains('snav-pill'));
const real=ms=>ms.filter(r=>![...r.addedNodes,...r.removedNodes].every(isInd)||(!r.addedNodes.length&&!r.removedNodes.length));
/* A route change eases the whole page area in (opacity only, the cards and rows rise on their own below),
   while the page that was there eases out as a copy (app.js pageGhost). On a phone main#app>* already rises in CSS. */
function pageIn(){ if(RM||window.__entering||!app.animate) return; const f=app.firstElementChild; if(f&&getComputedStyle(f).animationName==='pgIn') return;
  animate(app,{opacity:[0,1]},{duration:.26,ease:EASE}).finished.then(()=>{ app.style.opacity=''; }).catch(()=>{ app.style.opacity=''; }); }
const SKEL='.skwrap,.dcload,.dcsk,.dcskl,.sksug,.sktturn,.skgsrc,.pvsk';
function collect(muts0){
  const muts=real(muts0); if(!muts.length) return;
  const key=viewKey(); const full=key!==lastKey; if(full){ seen=new Set(); lastKey=key; pageIn(); }
  const out=[];
  /* content arriving where a skeleton was fades in, instead of popping */
  muts.forEach(m=>{ if(![...m.removedNodes].some(n=>n.nodeType===1&&(n.matches(SKEL)||n.querySelector(SKEL)))) return; m.addedNodes.forEach(n=>{ if(n.nodeType===1&&!n.matches(SKEL)&&!out.includes(n)){ out.push(n); n.dataset.skin='1'; } }); });
  muts.forEach(m=>m.addedNodes.forEach(n=>{ if(n.nodeType!==1) return; if(n.matches(SEL)) out.push(n); $$(SEL,n).forEach(c=>out.push(c)); }));
  const fresh=[...new Set(out)].filter(el=>{ if(el.dataset&&el.dataset.skin){ delete el.dataset.skin; return true; } const s=sig(el); if(!full&&seen.has(s)) return false; seen.add(s); return true; });
  enter(fresh,full); indicators();
}
new MutationObserver(collect).observe(app,{childList:true,subtree:true});

/* ---------- sliding indicators ---------- */
const last={};
function slide(container,btnSel,cls,id){
  if(!container) return; let ind=$('.'+cls,container); const cur=$(btnSel+'[aria-current=page]',container); if(ind) ind.remove(); if(!cur) return;
  ind=document.createElement('span'); ind.className=cls; container.prepend(ind);
  const c=container.getBoundingClientRect(), b=cur.getBoundingClientRect(); const to={left:b.left-c.left+container.scrollLeft,width:b.width};
  const from=last[id]; last[id]=to;
  ind.style.left=to.left+'px'; ind.style.width=to.width+'px';
  if(from&&!RM&&(from.left!==to.left)) animate(ind,{left:[from.left+'px',to.left+'px'],width:[from.width+'px',to.width+'px']},{type:'spring',stiffness:420,damping:34});
}
function indicators(){ slide($('#surfaces'),'.surf','ind-pill','surf'); slide($('#app .tabs'),'.tab','ind-line','tab-'+B.S.surface); }
new MutationObserver(ms=>{ if(real(ms).length) indicators(); }).observe($('#surfaces'),{childList:true});
document.fonts&&document.fonts.ready.then(indicators); addEventListener('resize',()=>{Object.keys(last).forEach(k=>delete last[k]);indicators();});

/* ---------- overlays ---------- */
new MutationObserver(()=>{ const m=$('#modal'); if(m.classList.contains('on')&&!RM){ const box=$('.modal',m); if(getComputedStyle(m).animationName==='none') m.animate([{opacity:0},{opacity:1}],{duration:160,easing:'ease-out'}); if(box) animate(box,{opacity:[0,1],scale:[.94,1],y:[24,0]},{type:'spring',stiffness:380,damping:30}); } }).observe($('#modal'),{attributes:true,attributeFilter:['class']});
new MutationObserver(()=>{ const d=$('#drawer'); if(d.classList.contains('on')&&!RM) animate(d.children,{opacity:[0,1],y:[14,0]},{delay:stagger(.03,{startDelay:.06}),duration:.22,ease:EASE}); }).observe($('#drawer'),{attributes:true,attributeFilter:['class']});
new MutationObserver(()=>{ const t=$('#toast'); if(t.classList.contains('on')&&!RM) animate(t,{scale:[.9,1]},{type:'spring',stiffness:500,damping:22}); }).observe($('#toast'),{attributes:true,attributeFilter:['class']});
// pipeline stage dots
new MutationObserver(ms=>ms.forEach(m=>{ const el=m.target; if(el.classList&&el.classList.contains('stg')&&/ok|bad/.test(el.className)&&!RM){ const d=$('.dot',el); if(d) animate(d,{scale:[.4,1.35,1]},{duration:.45}); animate(el,{x:[-6,0]},{duration:.35,ease:EASE}); } })).observe(app,{attributes:true,attributeFilter:['class'],subtree:true});

/* ---------- press and hover feel ---------- */
const PRESS='.btn,.chip,.cite,.tab,.surf,.ic,.kbtn,.entry button,.state-list button,.link';
document.addEventListener('pointerdown',e=>{ if(RM) return; const t=e.target.closest(PRESS); if(!t||t.disabled) return; animate(t,{scale:.94},{duration:.12}); const up=()=>{ animate(t,{scale:1},{type:'spring',stiffness:600,damping:16}); removeEventListener('pointerup',up); removeEventListener('pointercancel',up); }; addEventListener('pointerup',up); addEventListener('pointercancel',up); });
const LIFT='.entry button';
document.addEventListener('mouseover',e=>{ if(RM) return; const t=e.target.closest(LIFT); if(!t||t.contains(e.relatedTarget)) return; animate(t,{y:-3},{type:'spring',stiffness:420,damping:24}); });
document.addEventListener('mouseout',e=>{ if(RM) return; const t=e.target.closest(LIFT); if(!t||t.contains(e.relatedTarget)) return; animate(t,{y:0},{type:'spring',stiffness:420,damping:24}); });

/* ---------- phone tilt ---------- */
document.addEventListener('pointermove',e=>{ if(RM) return; const p=e.target.closest&&e.target.closest('.phone'); if(!p||e.pointerType==='touch') return; const r=p.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5; p.style.transform=`perspective(900px) rotateY(${x*7}deg) rotateX(${-y*5}deg)`; });
document.addEventListener('pointerout',e=>{ const p=e.target.closest&&e.target.closest('.phone'); if(p&&!p.contains(e.relatedTarget)&&!RM) animate(p,{transform:'perspective(900px) rotateY(0deg) rotateX(0deg)'},{type:'spring',stiffness:200,damping:18}); });

/* ---------- hover cards: one shared card for citations and the Docs links ---------- */
/** hoverCard(anchor, html, opts) floats `html` in a card beside `anchor`, above or below so it stays on screen.
 *  opts: {cls, width}. The card enters with a spring and leaves with the shared exit animation. */
let pop=null;
function hoverCard(anchor,html,opts){ opts=opts||{}; closePop(true); pop=document.createElement('div'); pop.className='pop'+(opts.cls?' '+opts.cls:''); pop.innerHTML=html;
  document.body.appendChild(pop); const w=opts.width||280; const r=anchor.getBoundingClientRect(); pop.style.left=Math.max(8,Math.min(innerWidth-w-16,r.left-20))+'px'; const below=r.bottom+pop.offsetHeight+12<innerHeight; pop.dataset.below=below?'1':'0'; pop.style.top=(below?r.bottom+8:r.top-pop.offsetHeight-8)+'px';
  if(!RM) animate(pop,{opacity:[0,1],y:[below?8:-8,0],scale:[.96,1]},{type:'spring',stiffness:500,damping:30}); return pop; }
B.hoverCard={ open:hoverCard, close:()=>closePop(), current:()=>pop };
/* the citation card: the quote, its source and its owner */
document.addEventListener('mouseover',e=>{ const c=e.target.closest('.cite[data-cite]'); if(!c||c.contains(e.relatedTarget)||!window.ASK) return; const d=window.ASK.citation(c); if(!d) return;
  hoverCard(c,`<div class="pt">${B.srcIcon(d.system,18)}<b>${B.esc(d.title)}</b></div>${d.quote?`<div class="pq">${B.esc(d.quote)}</div>`:'<div class="pq pqgone">This passage is no longer available.</div>'}<div class="pf">${d.owner?window.AVATAR(d.owner.name,'lav',22):''}<span class="pw"><b>${B.esc(d.owner?d.owner.name:B.systemName(d.system))}</b><small>${d.last_verified_at?'Verified '+B.when(d.last_verified_at,B.fmtDate(d.last_verified_at)):''}</small></span></div>`); });
document.addEventListener('mouseout',e=>{ const c=e.target.closest('.cite[data-cite]'); if(c&&!c.contains(e.relatedTarget)) closePop(); });
function closePop(now){ if(pop){ const p=pop; pop=null; if(now){ p.remove(); return; } if(B.leaveFx) B.leaveFx(p,{opacity:0,transform:'translateY('+(p.dataset.below==='1'?8:-8)+'px) scale(.96)'},110); else p.remove(); } }

/* ---------- scroll progress ---------- */
const bar=document.createElement('div'); bar.className='scrollbar'; document.body.appendChild(bar);
if(!RM) scroll(animate(bar,{scaleX:[0,1]},{ease:'linear'}));

/* ---------- graph node drag ---------- */
let gd=null;
app.addEventListener('pointerdown',e=>{ const n=e.target.closest('svg.graph .n'); if(!n) return; const svg=n.ownerSVGElement; const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const p=pt.matrixTransform(svg.getScreenCTM().inverse()); const c=$('circle',n); gd={n,svg,sx:p.x,sy:p.y,bx:+c.getAttribute('cx'),by:+c.getAttribute('cy'),moved:false}; n.setPointerCapture(e.pointerId); });
app.addEventListener('pointermove',e=>{ if(!gd) return; const pt=gd.svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const p=pt.matrixTransform(gd.svg.getScreenCTM().inverse()); const dx=p.x-gd.sx, dy=p.y-gd.sy; if(Math.hypot(dx,dy)>3) gd.moved=true; if(!gd.moved) return;
  gd.n.setAttribute('transform',`translate(${dx} ${dy})`); const id=gd.n.dataset.n;
  $$('line[data-e]',gd.svg).forEach(l=>{ const [a,b]=l.dataset.e.split('-'); if(a===id){ l.setAttribute('x1',gd.bx+dx); l.setAttribute('y1',gd.by+dy);} if(b===id){ l.setAttribute('x2',gd.bx+dx); l.setAttribute('y2',gd.by+dy);} }); });
app.addEventListener('pointerup',()=>{ if(gd&&gd.moved){ const n=gd.n; n._dragged=true; setTimeout(()=>n._dragged=false,0);} gd=null; });
app.addEventListener('click',e=>{ const n=e.target.closest('svg.graph .n'); if(n&&n._dragged){ e.stopImmediatePropagation(); e.preventDefault(); } },true);
// neighbour highlight on hover
app.addEventListener('mouseover',e=>{ const n=e.target.closest('svg.graph .n'); if(!n) return; const id=n.dataset.n; const near=new Set([id]); $$('svg.graph line[data-e]').forEach(l=>{ const [a,b]=l.dataset.e.split('-'); if(a===id)near.add(b); if(b===id)near.add(a); animate(l,{opacity:(a===id||b===id)?1:.15},{duration:.2}); }); $$('svg.graph .n').forEach(x=>animate(x,{opacity:near.has(x.dataset.n)?1:.25},{duration:.2})); });
app.addEventListener('mouseout',e=>{ const n=e.target.closest('svg.graph .n'); if(!n||n.contains(e.relatedTarget)) return; $$('svg.graph .n,svg.graph line').forEach(x=>animate(x,{opacity:1},{duration:.2})); });

/* ---------- search palette: asking, chats and Library documents (no page list) ---------- */
const esc=B.esc;
let libCache=null; let found={q:'',conversations:[],documents:[],lib:null}; let timer=0, seq=0, libSeq=0;
const docRow=d=>({ic:B.srcIcon(d.system,18),t:d.title,s:d.path||B.systemName(d.system),f:()=>window.DOCUMENTS.openDocument(d.id)});
const build=()=>{ const raw=$('#kq').value.trim(); const g=[];
  if(raw) g.push(['Ask',[{ic:B.ICON('arrow',16),t:'Ask Broth: '+raw,ask:true,f:()=>window.ASK&&window.ASK.askFresh(raw)}]]);
  const chats=(raw?(found.q===raw?found.conversations:[]):B.S.chats.items).slice(0,raw?6:4).map(c=>({ic:'<img class="kface" src="/assets/brand/mascot-head.png" alt="" aria-hidden="true" width="18" height="18" draggable="false">',t:B.chatTitle(c),f:()=>B.go('/c/'+c.id)}));
  if(chats.length) g.push([raw?'Chats':'Recent chats',chats]);
  const docs=(raw?(found.q===raw?found.documents:[]):(found.lib||[])).slice(0,raw?6:8).map(docRow);
  if(docs.length) g.push(['Library',docs]);
  return g; };
// "Nothing found" shows above the Ask row once a search has come back empty, or before typing when there is nothing to list
const nothing=()=>{ const raw=$('#kq').value.trim(); const g=build(); const rows=g.filter(x=>x[0]!=='Ask').reduce((n,x)=>n+x[1].length,0); if(rows) return false; return raw?found.q===raw:found.lib!==null; };
const search=()=>{ const raw=$('#kq').value.trim(); clearTimeout(timer); draw(); if(!raw||!B.S.me) return;
  timer=setTimeout(async()=>{ const mine=++seq; let r={conversations:[],documents:[]}; try{ r=await B.api.get('/search',{q:raw}); }catch(e){ /* the palette still offers pages and asking */ } if(mine!==seq) return; found={q:raw,conversations:B.arr(r&&r.conversations),documents:B.arr(r&&r.documents)}; draw(); },180); };
const k=document.createElement('div'); k.id='cmdk'; k.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-label="Search"><div class="kin">'+B.ICON('search',16)+'<input id="kq" placeholder="Search or ask" aria-label="Search" autocomplete="off"><button type="button" class="kx" id="kx" aria-label="Close search">'+B.ICON('x',16)+'</button></div><div id="kl" role="listbox"></div><div class="kfoot"><span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>↵</kbd> Open</span><span><kbd>esc</kbd> Close</span></div></div>'; document.body.appendChild(k);
let sel=0, list=[];
const draw=()=>{ const g=build(); list=g.flatMap(x=>x[1]); sel=Math.min(sel,Math.max(0,list.length-1)); let n=0;
  const empty=nothing()?'<div class="ds-empty kempty"><span class="ds-empty-ic">'+B.ICON('search',20)+'</span><b>Nothing found</b></div>':'';
  $('#kl').innerHTML=(list.length||empty)?empty+g.map(([h,items])=>`<div class="kg"><div class="kh">${h}</div>${items.map(i=>{ const idx=n++; return `<div class="kr ${i.ask?'kask':''}" role="option" aria-selected="${idx===sel}" data-n="${idx}"><span class="ki">${i.ic}</span><span class="kt">${esc(i.t)}</span>${i.s?`<small>${esc(i.s)}</small>`:''}</div>`; }).join('')}</div>`).join(''):'';
  $$('#kl .kr').forEach(li=>{ li.onclick=()=>run(+li.dataset.n); li.onmousemove=()=>{ if(sel===+li.dataset.n) return; sel=+li.dataset.n; $$('#kl .kr').forEach((x,i)=>x.setAttribute('aria-selected',i===sel)); }; }); };
const loadLib=async()=>{ const mine=++libSeq; let items=null; try{ items=B.rows(await B.api.get('/documents',{limit:8})); }catch(e){ /* the palette still offers asking and chats */ } if(mine!==libSeq) return; libCache=items||libCache||[]; if(found.q===''&&k.classList.contains('on')){ found.lib=libCache; draw(); } };
const open=()=>{ if(!B.S.me) return; if(kx){ kx.cancel(); kx=null; k.classList.remove('on'); void k.offsetWidth; } found={q:'',conversations:[],documents:[],lib:libCache}; loadLib(); k._op=document.activeElement; k.classList.add('on'); $('#kq').value=''; sel=0; draw(); $('#kq').focus(); if(!RM){ animate($('.box',k),{opacity:[0,1],scale:[.96,1],y:[-8,0]},{duration:.18,ease:[.2,.8,.2,1]}); animate(k,{opacity:[0,1]},{duration:.14}); } };
let kx=null;
const kdone=()=>{ k.classList.remove('on'); k.getAnimations().forEach(a=>a.cancel()); const bx=$('.box',k); if(bx) bx.getAnimations().forEach(a=>a.cancel()); };
const close=()=>{ if(!k.classList.contains('on')||kx) return; const o=k._op; if(o&&o!==document.body&&document.contains(o)&&o.focus) o.focus({preventScroll:true});
  const bx=$('.box',k); if(RM||!B.exitFx||!bx){ kdone(); return; }
  const c1=B.exitFx(bx,{opacity:0,transform:'translateY(-8px) scale(.96)'},120), c2=B.exitFx(k,{opacity:0},120,'ease-in'); const mine={cancel(){ c1.cancel(); c2.cancel(); }}; kx=mine;
  Promise.all([c1.done,c2.done]).then(()=>{ if(kx!==mine) return; kx=null; kdone(); }); };
const run=n=>{ const i=list[n]; if(!i) return; const typed=$('#kq').value.trim(); $('#kq').dataset.last=typed; close(); i.f(); };
$('#kq').oninput=()=>{sel=0;search();}; $('#kx').onclick=close;
$('#kq').onkeydown=e=>{ if(e.key==='Tab'){ e.preventDefault(); return; } if(e.key==='ArrowDown'){sel=Math.min(list.length-1,sel+1);e.preventDefault();} else if(e.key==='ArrowUp'){sel=Math.max(0,sel-1);e.preventDefault();} else if(e.key==='Enter'){ e.preventDefault(); run(sel); return;} else if(e.key==='Escape'){close();return;} else return; $$('#kl .kr').forEach((x,n)=>x.setAttribute('aria-selected',n===sel)); const a=$('#kl .kr[aria-selected=true]'); if(a) a.scrollIntoView({block:'nearest'}); };
k.addEventListener('click',e=>{ if(e.target===k) close(); });
document.addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); k.classList.contains('on')?close():open(); } else if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); open(); } });
const kb=document.createElement('button'); kb.className='kbtn'; kb.innerHTML='Jump to<kbd>⌘K</kbd>'; kb.onclick=open; $('.top-right').prepend(kb);
})();
