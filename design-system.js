/* Design reference page: renders the token tables and the theme switch. */
(()=>{
  const sheet=[...document.styleSheets].find(s=>(s.href||'').includes('tokens.css')); const vars={};
  try{ for(const r of sheet.cssRules){ if(r.selectorText===':root'){ for(const p of r.style){ if(p.startsWith('--')) vars[p]=r.style.getPropertyValue(p).trim(); } } } }catch(e){}
  const cs=getComputedStyle(document.documentElement); const val=n=>cs.getPropertyValue(n).trim();
  const group=(title,names,el)=>{ el.insertAdjacentHTML('beforeend','<h3>'+title+'</h3><div class="ds-grid">'+names.map(n=>'<div class="ds-sw"><i style="background:var('+n+')"></i><div><b>'+n.replace('--','')+'</b><span class="ds-tk">'+val(n)+'</span></div></div>').join('')+'</div>'); };
  const keys=Object.keys(vars); const c=document.getElementById('colors');
  group('Surfaces and fills',['--surface','--shell','--wash','--fill-1','--fill-2','--fill-3'],c);
  group('Lines',['--line','--line-strong','--line2'],c);
  group('Text',['--ink','--ink-2','--mute','--mute-2','--mute-3'],c);
  group('Brand',['--brand','--brand-strong','--brand-soft','--brand-wash','--brand-line'],c);
  group('Status',['--ok','--ok-soft','--warn','--warn-soft','--danger','--danger-strong','--danger-soft','--danger-line'],c);
  document.getElementById('type').innerHTML=keys.filter(k=>/^--fs-/.test(k)).map(k=>'<span class="ds-tk">'+k.replace('--','')+' · '+vars[k]+'</span><span style="font-size:var('+k+');line-height:1.3">Cited answers, owners notified</span>').join('');
  document.getElementById('space').innerHTML=keys.filter(k=>/^--s-/.test(k)).map(k=>'<div class="ds-sp"><span class="ds-tk" style="width:90px">'+k.replace('--','')+' · '+vars[k]+'</span><i style="width:var('+k+')"></i></div>').join('');
  document.getElementById('radius').innerHTML=keys.filter(k=>/^--r-/.test(k)).map(k=>'<div class="ds-rd" style="border-radius:var('+k+')">'+k.replace('--r-','')+'<br>'+vars[k]+'</div>').join('');
  document.getElementById('motion').innerHTML=keys.filter(k=>/^--dur-/.test(k)).map(k=>'<div class="ds-mo" style="transition:transform var('+k+') var(--ease-out),background var('+k+'),border-color var('+k+')">'+k.replace('--dur-','')+' '+vars[k]+'</div>').join('');
  const tb=document.getElementById('dstheme');const dk=()=>document.documentElement.dataset.mode==='dark';
  const sync=()=>{tb.textContent=dk()?'Light mode':'Dark mode'};sync();
  tb.onclick=()=>{ if(dk()){delete document.documentElement.dataset.mode;try{localStorage.setItem('brain-theme','light')}catch(e){}} else {document.documentElement.dataset.mode='dark';try{localStorage.setItem('brain-theme','dark')}catch(e){}} sync(); };
})();
