/* Mascot: Broth, the fuzzy indigo character with a steam crown. Used on the new chat page and as the agent avatar.
 * Idle bob, a drop-in landing, a squish on press, and a small tilt towards the pointer.
 * Built on the Motion library (motion.dev). Respects reduced motion: it then sits still. */
(() => {
const M = window.Motion;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FULL = 'assets/brand/mascot.png';
const HEAD = 'assets/brand/mascot-head.png';

function svg(kind) {
  return `<img class="bm-img" src="${kind === 'full' ? FULL : HEAD}" alt="Broth" draggable="false">`;
}

function mount(host) {
  if (!host || host.dataset.bm) return null;
  host.dataset.bm = '1';
  host.classList.add('bm');
  host.innerHTML = svg('full');
  const img = host.querySelector('img');
  const handle = { state: 'idle', stop() {}, set(s) { handle.state = s; host.dataset.state = s; } };
  if (!M || RM()) return handle;
  const { animate } = M;
  const stops = [];
  img.style.transformOrigin = '50% 100%';
  animate(host, { opacity: [0, 1] }, { duration: .25 });
  animate(img, { y: [-30, 0], scaleY: [1.1, 1], scaleX: [.95, 1] }, { type: 'spring', stiffness: 260, damping: 11 });
  stops.push(animate(img, { y: [0, -5] }, { duration: 2.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: .9 }));
  const look = (e) => {
    const r = host.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 360));
    animate(img, { rotate: dx * 4 }, { type: 'spring', stiffness: 160, damping: 20 });
  };
  document.addEventListener('pointermove', look, { passive: true });
  host.addEventListener('pointerdown', () => animate(img, { scaleY: .92, scaleX: 1.05 }, { duration: .1 }));
  const up = () => animate(img, { scaleY: 1, scaleX: 1 }, { type: 'spring', stiffness: 420, damping: 15 });
  host.addEventListener('pointerup', up); host.addEventListener('pointerleave', up);
  handle.stop = () => { document.removeEventListener('pointermove', look); stops.forEach((a) => a.stop && a.stop()); };
  const obs = new MutationObserver(() => { if (!host.isConnected) { handle.stop(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return handle;
}

window.BROTH_MASCOT = { mount, svg: () => svg('head') };
/* mount on any .bm the app draws, wherever it draws it */
const scan = () => document.querySelectorAll('.bm:not([data-bm])').forEach((h) => mount(h));
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
/* the new chat page shows the B. A few seconds in, "roth" writes itself out beside it, in the logo's own outline-then-fill style. */
const WM='assets/brand/broth-wordmark.svg';
let wmD=null;
const wmPath=()=>wmD?Promise.resolve(wmD):fetch(WM).then(r=>r.text()).then(t=>{ const m=/ d="([^"]+)"/.exec(t); wmD=m?m[1]:''; return wmD; });
const NS='http://www.w3.org/2000/svg';
const UNIT=100/963, BW=282, WMW=963, H=247;  /* px per unit, width of the B in units, wordmark width, height */
const mk=(tag,attrs)=>{ const e=document.createElementNS(NS,tag); Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v)); return e; };
function build(h){
  const svg=mk('svg',{class:'lmw','aria-hidden':'true',viewBox:'0 0 '+BW+' '+H}); svg.style.width=Math.round(BW*UNIT)+'px';
  const parts=wmD.split(/Z\s*(?=M)/).map((p,i,a)=>p.trim()+(i<a.length-1?' Z':''));
  const probe=mk('path',{}); svg.appendChild(probe);
  h.replaceChildren(svg);
  const info=parts.map((d)=>{ probe.setAttribute('d',d); const b=probe.getBBox(); return {d,x:b.x,r:b.x+b.width}; });
  probe.remove();
  const isB=(p)=>p.r<=BW+4;
  const bFill=mk('path',{d:info.filter(isB).map(p=>p.d).join(' '),fill:'currentColor','fill-rule':'evenodd'});
  const rest=info.filter((p)=>!isB(p));
  const rFill=mk('path',{d:rest.map(p=>p.d).join(' '),fill:'currentColor','fill-rule':'evenodd'}); rFill.style.opacity='0';
  svg.append(bFill,rFill);
  return {svg,rest,rFill};
}
function revealRest(h,st){
  const {svg,rest,rFill}=st;
  const strokes=rest.map((p)=>{ const e=mk('path',{d:p.d,fill:'none',stroke:'currentColor','stroke-width':'5','stroke-linejoin':'round','stroke-linecap':'round',pathLength:'1'}); e.style.strokeDasharray='1'; e.style.strokeDashoffset='1'; svg.appendChild(e); return {e,x:p.x}; });
  const minX=Math.min(...strokes.map(s=>s.x)), span=Math.max(1,Math.max(...strokes.map(s=>s.x))-minX);
  /* the view widens from the B alone to the whole name, so the B eases left as the letters appear */
  const t0=performance.now(), dur=900;
  const ease=(t)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const tick=(now)=>{ const t=Math.min(1,(now-t0)/dur); const w=BW+(WMW-BW)*ease(t); svg.setAttribute('viewBox','0 0 '+w.toFixed(1)+' '+H); svg.style.width=Math.round(w*UNIT)+'px'; if(t<1&&svg.isConnected) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  strokes.forEach(({e,x})=>{ const delay=150+Math.round(((x-minX)/span)*520); e.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:720,delay,easing:'cubic-bezier(.45,.05,.2,1)',fill:'forwards'}); e.animate([{opacity:1},{opacity:0}],{duration:420,delay:1250,fill:'forwards'}); });
  rFill.animate([{opacity:0},{opacity:1}],{duration:520,delay:1050,easing:'ease-out',fill:'forwards'});
}
const lmScan=()=>document.querySelectorAll('.lm:not([data-lm])').forEach((h)=>{
  h.dataset.lm='1';
  wmPath().then((d)=>{ if(!d||!h.isConnected) return; let st=build(h);
    if(RM()||!M){ st.svg.setAttribute('viewBox','0 0 '+WMW+' '+H); st.svg.style.width=Math.round(WMW*UNIT)+'px'; st.rFill.style.opacity='1'; return; }
    let timer=setTimeout(()=>{ if(h.isConnected) revealRest(h,st); },2800);
    h.style.cursor='pointer'; h.onclick=()=>{ clearTimeout(timer); st=build(h); setTimeout(()=>{ if(h.isConnected) revealRest(h,st); },700); };
  }).catch(()=>{});
});
new MutationObserver(lmScan).observe(document.documentElement,{childList:true,subtree:true});
lmScan();
})();
