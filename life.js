/* Life: motion for the newer screens, built on the Motion library (motion.dev). Respects reduced motion. */
(() => {
const M=window.Motion, B=window.BRAIN; if(!M||!B) return;
const {animate,stagger}=M; const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const EASE=[.22,1,.36,1]; const SPRING={type:'spring',stiffness:420,damping:30};
const app=$('#app'); if(!app) return;

/* 1. entrances: new cards, rows and groups rise in with a stagger (not while typing, not inside folders) */
const NEW='.actr,.gcard,.lrow,.cnsec,.dt-r:not(.dt-h),.frow,.acid,.astat,.agstep,.hcb,.hrel,.fhead,.lvs,.agr,.acard,.obcard,.obopt,.obapp,.obid,.lh-sug,.dday,.libs,.atabs,.libchips,.stkl-main';
let pending=[], raf=0, lastBatch=0;
function flush(){ raf=0; const els=pending.filter(e=>e.isConnected); pending=[]; if(!els.length) return;
  const set=new Set(els); const leaf=els.filter(e=>![...set].some(o=>o!==e&&e.contains(o))).slice(0,50);
  const done=()=>els.forEach(e=>{ e.style.opacity=''; e.style.transform=''; });
  els.filter(e=>!leaf.includes(e)).forEach(e=>{ e.style.opacity=''; });
  animate(leaf,{opacity:[0,1],y:[12,0]},{delay:stagger(.028),duration:.4,ease:EASE}).finished.then(done).catch(done); }
function queue(nodes){ if(RM||window.__entering) return; const ae=document.activeElement; if(ae&&/INPUT|TEXTAREA/.test(ae.tagName)&&app.contains(ae)) return; if(performance.now()-lastBatch<120&&pending.length===0&&false) return;
  const fresh=nodes.filter(e=>!e.dataset.lf&&!e.closest('.fin,.stkl-side,#drawer,#modal')&&e.style.opacity!=='0'); if(!fresh.length) return;
  fresh.forEach(e=>{ e.dataset.lf='1'; e.style.opacity='0'; }); pending.push(...fresh); lastBatch=performance.now(); if(!raf) raf=requestAnimationFrame(flush); }

/* 2. chat: your message slides in, answer parts follow one after another */
function chat(added){ added.forEach(n=>{ if(n.matches&&n.matches('#thread article')&&n.parentNode.children.length>0){ const idx=[...n.parentNode.children].indexOf(n); if(idx===n.parentNode.children.length-1&&!n.dataset.lc){ n.dataset.lc='1'; const u=$('.umsg',n); if(u&&!RM) animate(u,{opacity:[0,1],x:[28,0]},SPRING); } }
  if(n.parentNode&&n.parentNode.classList&&n.parentNode.classList.contains('extra')&&!RM&&!n.dataset.lc){ n.dataset.lc='1'; n.style.opacity='0'; const i=[...n.parentNode.children].indexOf(n); animate(n,{opacity:[0,1],y:[10,0]},{delay:.05*i,duration:.34,ease:EASE}).finished.then(()=>{ n.style.opacity=''; n.style.transform=''; }); } }); }

/* 3. home orb floats; composer breathes on focus */
function orb(added){ added.forEach(n=>{ const o=n.matches&&n.matches('.lh-mark')?n:(n.querySelector&&n.querySelector('.lh-mark')); if(o&&!o.dataset.fl&&!RM){ o.dataset.fl='1'; animate(o,{y:[0,-7]},{duration:3.4,repeat:Infinity,repeatType:'mirror',ease:'easeInOut'}); } }); }
document.addEventListener('focusin',e=>{ const f=e.target.closest&&e.target.closest('.dform'); if(f&&!RM) animate(f,{scale:1.012},SPRING); });
document.addEventListener('focusout',e=>{ const f=e.target.closest&&e.target.closest('.dform'); if(f&&!RM) animate(f,{scale:1},SPRING); });

/* 4. onboarding: steps rise in one by one; the preview reacts when it learns who you are */
let pvLast={g:'',u:''};
function onboarding(added){ if(RM||window.__entering) return; added.forEach(n=>{
  if(n.id==='sin'||(n.parentNode&&n.parentNode.id==='sin')) return; /* the sign-in page eases in as one piece (broth-signin.css); no per-child stagger */
  if(n.id==='sin'||(n.parentNode&&n.parentNode.id==='sin')){ const box=n.id==='sin'?n:n.parentNode; if(box._ob) return; box._ob=1; setTimeout(()=>{ box._ob=0; },60); const kids=[...box.children]; kids.forEach(k=>k.style.opacity='0'); animate(kids,{opacity:[0,1],y:[16,0]},{delay:stagger(.05),duration:.42,ease:EASE}).finished.then(()=>kids.forEach(k=>{ k.style.opacity=''; k.style.transform=''; })).catch(()=>kids.forEach(k=>k.style.opacity='')); }
  const pv=n.id==='sipv'?n:(n.parentNode&&n.parentNode.id==='sipv'?n.parentNode:null);
  if(pv){ const g=($('.pvg',pv)||{}).textContent||'', u=(($('.pvu b',pv)||{}).textContent)||''; if(!pv.dataset.first){ pv.dataset.first='1'; const w=$('.pvw',pv); if(w) animate(w,{opacity:[0,1],y:[26,0],scale:[.97,1]},{type:'spring',stiffness:260,damping:26}); }
   else { if(u&&u!==pvLast.u){ $$('.pvu,.pvg,.pvl',pv).forEach((el,i)=>animate(el,{opacity:[0,1],y:[8,0],scale:[.92,1]},{type:'spring',stiffness:520,damping:24,delay:i*.06})); } else if(g&&g!==pvLast.g&&u){ const el=$('.pvg',pv); if(el) animate(el,{y:[4,0]},{duration:.18}); } }
   pvLast={g,u}; } }); }

/* 5. sidebar: one highlight glides to the page you are on */
let lastP=null;
function pill(){ const c=$('#surfaces'); if(!c) return; const old=$('.snav-pill',c); if(old) old.remove(); const cur=$('.surf[aria-current=page]',c); if(!cur){ lastP=null; return; }
  const p=document.createElement('span'); p.className='snav-pill'; c.prepend(p); const cr=c.getBoundingClientRect(), br=cur.getBoundingClientRect(); const to={top:br.top-cr.top+c.scrollTop,height:br.height}; p.style.top=to.top+'px'; p.style.height=to.height+'px';
  if(lastP&&!RM&&Math.abs(lastP.top-to.top)>1) animate(p,{top:[lastP.top+'px',to.top+'px'],height:[lastP.height+'px',to.height+'px']},{type:'spring',stiffness:420,damping:34}); lastP=to; }
const isMine=n=>n.nodeType!==1||(n.classList&&(n.classList.contains('snav-pill')||n.classList.contains('ind-pill')||n.classList.contains('ind-line')));
const sn=$('#surfaces'); if(sn){ let busy=false; new MutationObserver(ms=>{ if(busy) return; if(ms.every(m=>[...m.addedNodes,...m.removedNodes].every(isMine))) return; busy=true; requestAnimationFrame(()=>{ pill(); busy=false; }); }).observe(sn,{childList:true,subtree:true}); pill(); } // subtree: the chat list redraws inside #srec (paging, chat search)

/* 6. the observer */
new MutationObserver(ms=>{ const added=[]; ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.nodeType===1) added.push(n); }));
  if(!added.length) return; const hits=[]; added.forEach(n=>{ if(n.matches(NEW)) hits.push(n); $$(NEW,n).forEach(c=>hits.push(c)); });
  chat(added); orb(added); onboarding(added); queue([...new Set(hits)].filter(n=>!n.closest('.si-in'))); }).observe(app,{childList:true,subtree:true});
orb([app]);

/* 7. press feel for the newer controls, and rows leave gracefully when you act on them */
const PRESS='.dsend,.dic,.dchip,.lchip,.hcard,.gcard,.obcard,.obopt,.hrel,.acct,.lh-sug,.emchip,.atab,.segb,.pm-i,.ssel-btn';
document.addEventListener('pointerdown',e=>{ if(RM) return; const t=e.target.closest&&e.target.closest(PRESS); if(!t||t.disabled) return; animate(t,{scale:.965},{duration:.1}); const up=()=>{ animate(t,{scale:1},{type:'spring',stiffness:560,damping:18}); removeEventListener('pointerup',up); removeEventListener('pointercancel',up); }; addEventListener('pointerup',up); addEventListener('pointercancel',up); });
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-ia],[data-cn]'); if(!b||b.dataset.done||RM) return; const row=b.closest('.actr'); if(!row) return;
  e.stopImmediatePropagation(); e.preventDefault(); b.dataset.done='1'; animate(row,{opacity:[1,0],x:[0,28]},{duration:.24,ease:EASE}).finished.then(()=>b.click()).catch(()=>b.click()); },true);
})();
