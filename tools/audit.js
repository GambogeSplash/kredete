// Design audit probe. Paste or fetch in the page. Returns contrast, type-scale, hit-target and label problems.
window.AUDIT=()=>{
 const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
 const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(',').map(x=>parseFloat(x)); return {c:p.slice(0,3),a:p[3]===undefined?1:p[3]};};
 const bgOf=el=>{ let e=el; while(e){ const p=parse(getComputedStyle(e).backgroundColor); if(p&&p.a>0.9) return p.c; e=e.parentElement;} return [255,255,255]; };
 const vis=el=>{const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&parseFloat(cs.opacity)>0.05;};
 const out={fs:{},lowc:[],small:[],noalt:[],nolabel:[],noimgdim:[]};
 const sel=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'');
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); const seen=new Set();
 while(walker.nextNode()){ const n=walker.currentNode; if(!n.textContent.trim()) continue; const el=n.parentElement; if(!el||seen.has(el)||!vis(el)) continue; seen.add(el);
  const cs=getComputedStyle(el); const fs=Math.round(parseFloat(cs.fontSize)*2)/2; out.fs[fs]=(out.fs[fs]||0)+1;
  const fg=parse(cs.color); if(!fg) continue; const bg=bgOf(el); const a=fg.a; const fgc=fg.c.map((v,i)=>Math.round(v*a+bg[i]*(1-a)));
  const L1=lum(fgc),L2=lum(bg); const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
  const large=fs>=24||(fs>=18.66&&parseInt(cs.fontWeight)>=700); const need=large?3:4.5;
  if(ratio<need) out.lowc.push([sel(el),ratio.toFixed(2),el.textContent.trim().slice(0,28),fs]); }
 document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab]').forEach(el=>{ if(!vis(el)) return; const r=el.getBoundingClientRect(); const isCk=/checkbox|radio/.test(el.type||''); if((r.width<24||r.height<24)&&!(isCk&&r.width>=16)) out.small.push([sel(el),Math.round(r.width)+'x'+Math.round(r.height),(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,20)]);
  if(['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&!el.labels?.length&&!el.getAttribute('aria-label')&&!el.closest('label')) out.nolabel.push(sel(el));
  if(el.tagName==='BUTTON'&&!el.textContent.trim()&&!el.getAttribute('aria-label')&&!el.title) out.nolabel.push('iconbtn '+sel(el)); });
 document.querySelectorAll('img').forEach(i=>{ if(!vis(i)) return; if(i.getAttribute('alt')===null) out.noalt.push(i.src.split('/').pop()); if(!i.getAttribute('width')&&!i.getAttribute('height')&&!i.style.aspectRatio) out.noimgdim.push(i.src.split('/').pop()); });
 const agg=a=>{const m={}; a.forEach(x=>{const k=Array.isArray(x)?x[0]:x; m[k]=(m[k]||0)+1;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8);};
 return {fontSizes:out.fs, distinctSizes:Object.keys(out.fs).length, lowContrast:out.lowc.length, lowTop:out.lowc.slice(0,10), smallTargets:out.small.length, smallTop:agg(out.small), noLabel:agg(out.nolabel), noAlt:out.noalt.length, noDim:agg(out.noimgdim)};
};
