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
/* the wordmark on the new chat page writes itself out: each letter's outline is drawn left to right, then the letters fill in */
const WM='assets/brand/broth-wordmark.svg';
let wmD=null;
const wmPath=()=>wmD?Promise.resolve(wmD):fetch(WM).then(r=>r.text()).then(t=>{ const m=/ d="([^"]+)"/.exec(t); wmD=m?m[1]:''; return wmD; });
const NS='http://www.w3.org/2000/svg';
function writeOut(h){
  const svg=document.createElementNS(NS,'svg'); svg.setAttribute('viewBox','0 0 963 247'); svg.setAttribute('class','lmw'); svg.setAttribute('aria-hidden','true');
  const fill=document.createElementNS(NS,'path'); fill.setAttribute('d',wmD); fill.setAttribute('fill','currentColor'); fill.setAttribute('fill-rule','evenodd'); fill.style.opacity=RM()||!M?'1':'0'; svg.appendChild(fill);
  h.replaceChildren(svg);
  if(RM()||!svg.animate) return;
  const parts=wmD.split(/Z\s*(?=M)/).map((p,i,a)=>p.trim()+(i<a.length-1?' Z':''));
  const strokes=parts.map((d)=>{ const p=document.createElementNS(NS,'path'); p.setAttribute('d',d); p.setAttribute('fill','none'); p.setAttribute('stroke','currentColor'); p.setAttribute('stroke-width','5'); p.setAttribute('stroke-linejoin','round'); p.setAttribute('stroke-linecap','round'); p.setAttribute('pathLength','1'); p.style.strokeDasharray='1'; p.style.strokeDashoffset='1'; svg.appendChild(p); return p; });
  const xs=strokes.map((p)=>p.getBBox().x); const order=[...strokes.keys()].sort((a,b)=>xs[a]-xs[b]); const minX=xs[order[0]]; const span=Math.max(1,xs[order[order.length-1]]-minX);
  order.forEach((i)=>{ const delay=Math.round(((xs[i]-minX)/span)*520); strokes[i].animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:720,delay,easing:'cubic-bezier(.45,.05,.2,1)',fill:'forwards'}); });
  fill.animate([{opacity:0},{opacity:1}],{duration:520,delay:980,easing:'ease-out',fill:'forwards'});
  strokes.forEach((p)=>p.animate([{opacity:1},{opacity:0}],{duration:420,delay:1180,fill:'forwards'}));
}
const lmScan=()=>document.querySelectorAll('.lm:not([data-lm])').forEach((h)=>{
  h.dataset.lm='1';
  wmPath().then((d)=>{ if(!d||!h.isConnected) return; writeOut(h); h.style.cursor='pointer'; h.onclick=()=>writeOut(h); }).catch(()=>{});
});
new MutationObserver(lmScan).observe(document.documentElement,{childList:true,subtree:true});
lmScan();
})();
