/* Our own dropdown. Replaces every native <select> (no OS sheet) with a trigger and a popover list.
   The real <select> stays in the DOM, hidden, so existing code keeps reading .value and listening for change. */
(() => {
const CARET='<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.75L5 6.25l2.5-2.5"/></svg>';
const CHECK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const valDesc=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
let menu=null, openFor=null, typed='', typedT=0;
const label=s=>{ const o=s.options[s.selectedIndex]; return o?o.textContent:''; };
function closeMenu(refocus){ if(!menu) return; const m=menu, f=openFor; menu=null; openFor=null; m.remove(); if(f){ f.btn.setAttribute('aria-expanded','false'); if(refocus) f.btn.focus({preventScroll:true}); } document.removeEventListener('pointerdown',outside,true); window.removeEventListener('resize',onWin); document.removeEventListener('scroll',onWin,true); }
const outside=e=>{ if(menu&&!menu.contains(e.target)&&!(openFor&&openFor.btn.contains(e.target))) closeMenu(false); };
const onWin=e=>{ if(menu&&e&&menu.contains(e.target)) return; closeMenu(false); };
function choose(f,i){ const s=f.sel; if(s.options[i].disabled) return; const changed=s.selectedIndex!==i; s.selectedIndex=i; sync(f); closeMenu(true); if(changed){ s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); } }
function openMenu(f){ if(openFor===f){ closeMenu(true); return; } closeMenu(false); const s=f.sel; if(s.disabled) return;
  const m=document.createElement('div'); m.className='ssel-menu'; m.setAttribute('role','listbox'); m.tabIndex=-1; if(s.getAttribute('aria-label')) m.setAttribute('aria-label',s.getAttribute('aria-label'));
  let h=''; let grp=null; [...s.children].forEach(c=>{ if(c.tagName==='OPTGROUP'){ h+=`<div class="ssel-g">${c.label}</div>`; [...c.children].forEach(o=>h+=item(s,o)); } else h+=item(s,c); }); m.innerHTML=h;
  function item(s,o){ const i=[...s.options].indexOf(o); return `<button type="button" class="ssel-o" role="option" data-i="${i}" aria-selected="${s.selectedIndex===i}" ${o.disabled?'aria-disabled="true"':''}><span>${o.textContent}</span>${s.selectedIndex===i?CHECK:''}</button>`; }
  document.body.appendChild(m); menu=m; openFor=f; f.btn.setAttribute('aria-expanded','true');
  const r=f.btn.getBoundingClientRect(); m.style.minWidth=Math.max(r.width,160)+'px'; m.style.maxWidth=Math.min(360,innerWidth-16)+'px';
  const mh=Math.min(m.scrollHeight,300); const below=innerHeight-r.bottom; const up=below<mh+12&&r.top>below;
  m.style.maxHeight=Math.max(120,Math.min(300,(up?r.top:below)-12))+'px'; m.style.left=Math.max(8,Math.min(innerWidth-m.offsetWidth-8,r.left))+'px'; m.style.top=up?Math.max(8,r.top-m.offsetHeight-4)+'px':(r.bottom+4)+'px';
  const opts=[...m.querySelectorAll('.ssel-o')]; let cur=Math.max(0,opts.findIndex(o=>o.getAttribute('aria-selected')==='true'));
  const hi=n=>{ cur=n; opts.forEach((o,k)=>o.classList.toggle('hi',k===n)); opts[n].scrollIntoView({block:'nearest'}); }; hi(cur); m.focus({preventScroll:true});
  opts.forEach((o,k)=>{ o.onmousemove=()=>hi(k); o.onclick=()=>choose(f,+o.dataset.i); });
  m.onkeydown=e=>{ const k=e.key; const step=d=>{ let n=cur; do{ n=(n+d+opts.length)%opts.length; }while(opts[n].getAttribute('aria-disabled')==='true'&&n!==cur); hi(n); };
   if(k==='ArrowDown'){ e.preventDefault(); step(1); } else if(k==='ArrowUp'){ e.preventDefault(); step(-1); } else if(k==='Home'){ e.preventDefault(); hi(0); } else if(k==='End'){ e.preventDefault(); hi(opts.length-1); }
   else if(k==='Enter'||k===' '){ e.preventDefault(); choose(f,+opts[cur].dataset.i); } else if(k==='Escape'||k==='Tab'){ e.preventDefault(); closeMenu(true); }
   else if(k.length===1){ const now=Date.now(); typed=(now-typedT>600?'':typed)+k.toLowerCase(); typedT=now; const n=opts.findIndex(o=>o.textContent.trim().toLowerCase().startsWith(typed)); if(n>=0) hi(n); } };
  document.addEventListener('pointerdown',outside,true); window.addEventListener('resize',onWin); document.addEventListener('scroll',onWin,true); }
function sync(f){ f.txt.textContent=label(f.sel); f.btn.disabled=f.sel.disabled; }
function enhance(sel){ if(sel.dataset.ui||sel.multiple||sel.size>1) return; sel.dataset.ui='1';
  const wrap=document.createElement('span'); wrap.className='ssel'; const cs=getComputedStyle(sel); const par=sel.parentElement;
  if(sel.classList.contains('lang')||sel.classList.contains('cxsel')||sel.classList.contains('sm')) wrap.classList.add('sm');
  if(par&&((par.clientWidth&&parseFloat(cs.width)>=par.clientWidth*.9&&getComputedStyle(par).display!=='flex')||sel.style.width==='100%')) wrap.classList.add('fill');
  sel.parentNode.insertBefore(wrap,sel); wrap.appendChild(sel); sel.classList.add('ssel-native'); sel.tabIndex=-1; sel.setAttribute('aria-hidden','true');
  const btn=document.createElement('button'); btn.type='button'; btn.className='ssel-btn'; btn.setAttribute('aria-haspopup','listbox'); btn.setAttribute('aria-expanded','false');
  const lab=sel.getAttribute('aria-label')||(sel.id&&document.querySelector('label[for="'+sel.id+'"]')&&document.querySelector('label[for="'+sel.id+'"]').textContent)||(sel.closest('label')&&sel.closest('label').firstChild&&sel.closest('label').firstChild.textContent)||''; if(lab&&lab.trim()) btn.setAttribute('aria-label',lab.trim());
  const txt=document.createElement('span'); txt.className='ssel-t'; btn.appendChild(txt); btn.insertAdjacentHTML('beforeend',CARET); wrap.insertBefore(btn,sel);
  const f={sel,btn,txt}; sync(f);
  btn.addEventListener('pointerdown',e=>{ if(e.button!==0||e.pointerType==='touch') return; e.preventDefault(); openMenu(f); });
  btn.addEventListener('click',e=>{ if(e.detail===0||e.pointerType==='touch'||e.detail>0&&false) openMenu(f); else if(e.pointerType==='touch') openMenu(f); });
  btn.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Enter'||e.key===' '){ e.preventDefault(); openMenu(f); } });
  sel.addEventListener('change',()=>sync(f));
  Object.defineProperty(sel,'value',{configurable:true,get(){ return valDesc.get.call(this); },set(v){ valDesc.set.call(this,v); sync(f); }});
  new MutationObserver(()=>sync(f)).observe(sel,{childList:true,subtree:true,attributes:true,characterData:true}); }
const scan=root=>{ (root.querySelectorAll?root.querySelectorAll('select:not([data-ui])'):[]).forEach(enhance); if(root.tagName==='SELECT') enhance(root); };
new MutationObserver(ms=>{ ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.nodeType===1) scan(n); })); }).observe(document.documentElement,{childList:true,subtree:true});
scan(document);
})();
