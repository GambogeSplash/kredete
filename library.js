/* Library: everything you can open across the apps that feed the Broth. Connectors: which apps are connected. */
(() => {
const B=window.BRAIN; const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)]; const esc=B.esc;
const APPS=[['Confluence'],['Google Drive'],['Notion']];
const SOON=[['Google Cloud Storage','Google Cloud'],['Slack','Slack'],['SharePoint',null]];
const KIND_IC={Page:'doc',Doc:'doc',Sheet:'analytics',Slides:'panel',Database:'stack'};
const isAdmin=()=>{ const u=B.S.user; return !!(u&&(u.roles||[]).includes("admin")); };
const itemsOf=app=>{ let l=Object.values(B.D).filter(d=>d.system===app&&d.kind); const pk=B.S.picked&&B.S.picked[app]; if(pk&&pk.length) l=l.filter(d=>pk.includes(d.id)); return l; };
const short=v=>{ const [dd,mm]=String(v).split(' '); return mm+' '+dd; };
const TEAM=id=>(window.DOC_TEAM||{})[id]||'';

const row=d=>`<div class="lrow" data-open="${d.id}" role="button" tabindex="0"><span class="lst">${SRCICON(d.system,18)}</span><span class="ltt"><span>${esc(d.title)}</span><small class="lpath">${esc(d.path||'')}</small></span><span class="lr"><span class="llab"><i style="background:${window.LEVEL_COL[d.level||0]}"></i>${esc(TEAM(d.id))}</span><span class="ldoc">${ICON(KIND_IC[d.kind]||'doc',14)}${esc(d.kind)}</span>${AVATAR(d.owner,'lav',22)}<span class="ldt">${short(d.verified)}</span></span></div>`;
const TINT={Confluence:'#eef3ff','Google Drive':'#eef8f2',Notion:'#f4f4f5'};
const card=d=>`<button type="button" class="gcard" data-open="${d.id}"><span class="gc-p" style="background:${TINT[d.system]||'#f4f4f5'}"><span class="gc-l"><i></i><i></i><i></i></span>${SRCICON(d.system,30)}<span class="gc-k">${esc(d.kind)}</span></span><span class="gc-t">${esc(d.title)}</span><small>${esc(d.path||'')}</small><span class="gc-f">${AVATAR(d.owner,'lav',20)}<span>${esc(TEAM(d.id))}</span><span class="lsp"></span><span>${short(d.verified)}</span></span></button>`;
const topOf=d=>String(d.path||'').split(' / ')[0];
const split=items=>{ const by={}; items.forEach(d=>{ const k=topOf(d); (by[k]=by[k]||[]).push(d); }); const folders=[],loose=[]; Object.entries(by).forEach(([k,g])=>{ if(k&&g.length>=2) folders.push({name:k,items:g}); else loose.push(...g); }); folders.sort((a,b)=>a.name.localeCompare(b.name)); return {folders,loose}; };
const FCOL={Design:'#d946a8',Engineering:'#3b82f6',Product:'#5e6ad2',Support:'#16a34a',Compliance:'#e5484d',Cards:'#8b5cf6',Payments:'#0ea5a4',Savings:'#e2a600',Partnerships:'#f97316',Leadership:'#64748b',Legal:'#64748b',People:'#ec4899',Company:'#5e6ad2'};
const PAL=['#5e6ad2','#16a34a','#f97316','#0ea5a4','#d946a8','#3b82f6'];
const fcol=n=>FCOL[n]||PAL[[...String(n)].reduce((a,c)=>a+c.charCodeAt(0),0)%PAL.length];
const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
const tsOf=d=>{ const [dd,mm,yy]=String(d.verified).split(' '); return new Date(+yy,MON[mm],+dd).getTime(); };
const fnew=f=>short([...f.items].sort((a,b)=>tsOf(b)-tsOf(a))[0].verified);
const owners=f=>[...new Set(f.items.map(d=>d.owner))];
const fsvg=(c,px)=>`<svg class="fsvg" width="${px}" height="${px}" viewBox="0 0 28 28" aria-hidden="true"><path d="M3 9a3 3 0 0 1 3-3h4.2a2 2 0 0 1 1.5.7l1.3 1.5H22a3 3 0 0 1 3 3v1H3V9z" fill="${c}" opacity=".55"/><rect x="3" y="11" width="22" height="12" rx="3" fill="${c}"/><rect x="3" y="11" width="22" height="3" rx="1.5" fill="#fff" opacity=".22"/></svg>`;
const frow=(app,f)=>{ const c=fcol(f.name); const o=owners(f); return `<div class="lrow lfold" style="--c:${c}" data-folder="${app}|${esc(f.name)}" role="button" tabindex="0"><span class="lst lfi">${fsvg(c,26)}</span><span class="ltt"><span class="lfn">${esc(f.name)}</span><small class="lpath">${f.items.length} items · Updated ${fnew(f)}</small></span><span class="lr"><span class="avst">${o.slice(0,3).map(n=>AVATAR(n,'lav',22)).join('')}${o.length>3?`<span class="avm">+${o.length-3}</span>`:''}</span><span class="ldoc">${SRCICON(app,14)}${esc(app)}</span><span class="ldt lchev">${ICON('chevr',14)}</span></span></div>`; };
const fcard=(app,f)=>{ const c=fcol(f.name); const o=owners(f); const names=f.items.slice(0,3).map(d=>d.title); return `<button type="button" class="gcard fcard" style="--c:${c}" data-folder="${app}|${esc(f.name)}" aria-label="${esc(f.name)}, ${f.items.length} items"><span class="fc-art"><span class="fc-back"></span><span class="fc-sheet s1"><i></i><i></i><i></i></span><span class="fc-sheet s2"><i></i><i></i></span><span class="fc-sheet s3"><i></i><i></i><i></i></span><span class="fc-front"><span class="fc-count">${f.items.length}</span><span class="fc-app">${SRCICON(app,18)}</span></span></span><span class="gc-t">${esc(f.name)}</span><small>${o.length} ${o.length===1?'owner':'owners'} · Updated ${fnew(f)}</small></button>`; };
const fhead=(app,name,n)=>{ const c=fcol(name); return `<div class="fhead" style="--c:${c}"><span class="fh-i">${fsvg(c,44)}</span><div class="fh-t"><h2>${esc(name)}</h2><small>${n} items in ${esc(app)}</small></div></div>`; };
const grp=(app,n)=>`<div class="lgrp lgapp" data-app="${app}"><span class="lst">${SRCICON(app,16)}</span><b>${esc(app)}</b><span class="lcount">${n}</span></div>`;

window.SURFACES.library=()=>{ const S=B.S; const on=B.appsOn(); const f=S.libApp&&on.includes(S.libApp)?S.libApp:'all';
 const all=on.flatMap(itemsOf); const mine=all.filter(B.canSee); const locked=all.length-mine.length; const view=S.libView==='grid'?'grid':'list';
 $('#app').className='';
 $('#app').innerHTML=`<div class="pg"><h1>Library</h1>
  <div class="libbar"><div class="libs"><span class="libs-i">${ICON('search',15)}</span><input id="libq" type="search" placeholder="Search the library" aria-label="Search the library" value="${esc(S.libQ||'')}" autocomplete="off"></div>
   <div class="fwrap"><button class="fbtn ${f==='all'?'':'on'}" id="lfbtn" aria-haspopup="true" aria-expanded="false">${ICON('filter',15)}<span>${f==='all'?'Filter':esc(f)}</span></button>
    <div class="fmenu" id="lfmenu" hidden><button class="fopt ${f==='all'?'on':''}" data-f="all"><span>All</span><em>${mine.length}</em></button>${on.map(a=>`<button class="fopt ${f===a?'on':''}" data-f="${a}">${SRCICON(a,16)}<span>${a}</span><em>${mine.filter(d=>d.system===a).length}</em></button>`).join('')}</div></div>
   <div class="seg" role="group" aria-label="View"><button class="segb ${view==='list'?'on':''}" data-v="list" aria-label="List view" aria-pressed="${view==='list'}">${ICON('rows',15)}</button><button class="segb ${view==='grid'?'on':''}" data-v="grid" aria-label="Grid view" aria-pressed="${view==='grid'}">${ICON('grid',15)}</button></div></div>
  <div class="lbody ${view==='grid'?'isgrid':''}" id="libbody"></div></div>`;
 const draw=()=>{ const q=(S.libQ||'').toLowerCase().trim(); const m=d=>!q||(d.title+' '+(d.path||'')+' '+d.owner+' '+TEAM(d.id)).toLowerCase().includes(q);
  const shown=mine.filter(d=>(f==='all'||d.system===f)&&m(d));
  let h=''; const R=view==='grid'?(g=>`<div class="ggrid">${g.map(card).join('')}</div>`):(g=>g.map(row).join(''));
  const fold=S.libFolder; const inF=fold&&on.includes(fold.app)?fold:null;
  if(inF){ const g=shown.filter(d=>d.system===inF.app&&topOf(d)===inF.name); h=`<div class="libcrumb"><button class="link" data-up="all">Library</button><i>›</i><button class="link" data-up="app">${esc(inF.app)}</button><i>›</i><b>${esc(inF.name)}</b></div>`+fhead(inF.app,inF.name,g.length)+R(g); shown.length=0; shown.push(...g); }
  else if(q){ if(f==='all'){ on.forEach(a=>{ const g=shown.filter(d=>d.system===a); if(g.length) h+=grp(a,g.length)+R(g); }); } else h=R(shown); }
  else { const part=a=>{ const sp=split(shown.filter(d=>d.system===a)); const fs=sp.folders; let o=''; if(view==='grid'){ o=`<div class="ggrid">${fs.map(x=>fcard(a,x)).join('')}${sp.loose.map(card).join('')}</div>`; } else o=fs.map(x=>frow(a,x)).join('')+sp.loose.map(row).join(''); return [o,fs.length+sp.loose.length]; };
    if(f==='all'){ on.forEach(a=>{ const [o,n2]=part(a); if(n2) h+=grp(a,shown.filter(d=>d.system===a).length)+o; }); } else h=part(f)[0]; }
  if(!shown.length) h=`<div class="empty"><h2>${q?'Nothing matches':'Nothing here yet'}</h2><p>${q?'Try a different word.':'Connect an app to fill the library.'}</p></div>`;
  $('#libbody').innerHTML=h;
  $$('#libbody [data-open]').forEach(r=>{ const go=()=>B.openSource(r.dataset.open); r.onclick=go; r.onkeydown=e=>{ if(e.key==='Enter') go(); }; });
  $$('#libbody .gcard,#libbody .lrow').forEach((x,i)=>x.style.setProperty('--i',i)); { const bd=$('#libbody'); if(S._pop){ bd.classList.add('fin'); S._pop=false; } }
  $$('#libbody [data-folder]').forEach(r=>{ const go=()=>{ const [a2,n2]=r.dataset.folder.split('|'); S.libFolder={app:a2,name:n2}; S._pop=true; B.save(); draw(); window.scrollTo(0,0); }; r.onclick=go; r.onkeydown=e=>{ if(e.key==='Enter') go(); }; });
  $$('#libbody [data-up]').forEach(b=>b.onclick=()=>{ if(b.dataset.up==='app'&&S.libFolder) S.libApp=S.libFolder.app; S.libFolder=null; B.save(); window.SURFACES.library(); }); };
 draw(); $('#libq').oninput=e=>{ S.libQ=e.target.value; draw(); };
 $$('[data-v]').forEach(b=>b.onclick=()=>{ S.libView=b.dataset.v; B.save(); window.SURFACES.library(); });
 const fb=$('#lfbtn'), fm=$('#lfmenu'); const closeF=()=>{ fm.hidden=true; fb.setAttribute('aria-expanded','false'); document.removeEventListener('mousedown',outF); };
 const outF=e=>{ if(!e.target.closest('.fwrap')) closeF(); };
 fb.onclick=()=>{ if(fm.hidden){ fm.hidden=false; fb.setAttribute('aria-expanded','true'); document.addEventListener('mousedown',outF); } else closeF(); };
 fm.onkeydown=e=>{ if(e.key==='Escape'){ closeF(); fb.focus(); } };
 $$('[data-f]').forEach(b=>b.onclick=()=>{ S.libFolder=null; S.libApp=b.dataset.f==='all'?null:b.dataset.f; B.save(); window.SURFACES.library(); });
};

const CONN={
 'Google Drive':{host:'accounts.google.com',who:'Google',tag:'Find answers in your team files',desc:'Broth searches your Docs, Sheets, Slides and PDFs and reads them with the same access the person asking already has.',can:['Search files','Read file contents','List recent files','See who can open each file'],never:['Create','Edit','Share','Delete'],by:'Google',cat:'Files and documents',sign:'Google account',added:'November 2026',links:[['Documentation','https://developers.google.com/drive'],['Privacy','https://policies.google.com/privacy']],scopes:[['See and download your Drive files','Broth reads file text to answer questions. It never changes a file.'],['See who can open each file','Broth uses this to respect each person\'s access level.']]},
 'Confluence':{host:'auth.atlassian.com',who:'Atlassian',tag:'Find answers in your wiki',desc:'Broth searches your Confluence pages and spaces and reads them with the same access the person asking already has.',can:['Search pages and spaces','Read page content','See space permissions'],never:['Create','Edit','Comment','Delete'],by:'Atlassian',cat:'Wiki and knowledge',sign:'Atlassian account',added:'November 2026',links:[['Documentation','https://support.atlassian.com/confluence-cloud/'],['Privacy','https://www.atlassian.com/legal/privacy-policy']],sites:['kredete.atlassian.net','kredete-labs.atlassian.net'],scopes:[['Read pages and spaces you can view','Broth reads page text to answer questions. It never edits a page.'],['See who can view each space','Broth uses this to respect each person\'s access level.']]},
 'Notion':{host:'notion.so',who:'Notion',tag:'Find answers in your notes',desc:'Broth reads only the pages you choose to share, and answers from them with the same access the person asking already has.',can:['Read the pages you share','Search shared pages','See page sharing'],never:['Create','Edit','Comment','Delete'],by:'Notion Labs',cat:'Notes and docs',sign:'Notion account',added:'November 2026',links:[['Documentation','https://developers.notion.com'],['Privacy','https://www.notion.so/notion/Privacy-Policy-3468d120cf614d4c9014c09f6adc9091']],pick:true,scopes:[['Read content','Broth reads the pages you pick. Nothing else in your workspace.']]}
};
window.CONN_INFO=CONN;
const infoSide=c=>`<dl class="cnm"><dt>Made by</dt><dd>${esc(c.by)}</dd><dt>Category</dt><dd>${esc(c.cat)}</dd><dt>Sign-in</dt><dd>${esc(c.sign)}</dd><dt>Added</dt><dd>${esc(c.added)}</dd><dt>More info</dt><dd class="cnlk">${c.links.map(([l,u])=>`<a href="${u}" target="_blank" rel="noopener">${l}</a>`).join('')}</dd></dl>`;
const canChips=c=>`<div class="cnh">Broth can</div><div class="cnchips">${c.can.map(x=>`<span class="cnchip">${esc(x)}</span>`).join('')}</div><div class="cnh">Broth never</div><div class="cnchips">${c.never.map(x=>`<span class="cnchip no">${esc(x)}</span>`).join('')}</div>`;
function connectModal(app){ const c=CONN[app]; const m=$('#modal'); if(!c) return;
 m.innerHTML=`<div class="modal cnw" role="dialog" aria-modal="true" aria-label="Connect ${esc(app)}"><button class="xbtn" id="mclose" type="button" aria-label="Close">${B.ICON('x',16)}</button><div class="body cn-body"><div class="cdh">${SRCICON(app,48)}<div><h2>${esc(app)}</h2><small class="cntag">${esc(c.tag)}</small></div></div>
  <div class="cncols"><div class="cnmain"><p class="cnd">${esc(c.desc)}</p>${canChips(c)}</div>${infoSide(c)}</div>
  <div class="actions"><button class="btn primary" id="cngo">Continue to ${esc(c.who)}</button><button class="btn" id="cncl">Cancel</button></div></div></div>`;
 m.classList.add('on'); m.setAttribute('aria-hidden','false'); $('#mclose').onclick=$('#cncl').onclick=B.closeModal;
 $('#cngo').onclick=()=>{ B.closeModal(); openOAuth(app); }; }
/* The provider's own sign-in and consent pages, shown full screen like a real hand-off. */
function openOAuth(app){ const c=CONN[app]; const S=B.S; const u=S.user||{}; const email=u.email||'aisha.bello@kredete.example'; document.querySelectorAll('#oauth').forEach(x=>x.remove());
 const ov=document.createElement('div'); ov.id='oauth'; ov.className='oauth'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',c.who+' sign-in'); document.body.appendChild(ov);
 const prevFocus=document.activeElement; const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const close=(msg)=>{ ov.classList.add('out'); setTimeout(()=>{ ov.remove(); if(prevFocus&&prevFocus.focus) try{prevFocus.focus({preventScroll:true});}catch(e){} if(msg) B.toast(msg); },calm?0:180); };
 const shell=(inner)=>{ ov.innerHTML=`<div class="oa-top"><span class="oa-lock">${B.ICON('lock',13)}<span>${esc(c.host)}</span></span></div><div class="oa-card" tabindex="-1">${inner}</div><div class="oa-foot"><a href="${c.links[1][1]}" target="_blank" rel="noopener">Privacy</a><a href="${c.links[0][1]}" target="_blank" rel="noopener">Help</a></div>`; const card=ov.querySelector('.oa-card'); if(card.animate&&!calm) card.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'}); card.focus({preventScroll:true}); };
 const mark=`<div class="oa-pair">${SRCICON(app,40)}<i>${B.ICON('chevr',16)}</i><span class="oa-brain">K</span></div>`;
 const account=()=>{ shell(`${mark}<h1>Choose an account</h1><p class="oa-s">to continue to Broth</p><button class="oa-acc" id="oaacc">${window.AVATAR(u.name||'Aisha Bello','lav',34)}<span><b>${esc(u.name||'Aisha Bello')}</b><small>${esc(email)}</small></span></button><p class="oa-n">Broth will see your name, email and picture.</p><div class="oa-act"><button class="link" id="oacancel">Cancel</button></div>`);
  $('#oaacc',ov).onclick=()=>{ const b=$('#oaacc',ov); b.classList.add('busy'); b.disabled=true; setTimeout(()=>{ (S.provAuth=S.provAuth||{})[app]=email; B.save(); consent(); },calm?0:650); };
  $('#oacancel',ov).onclick=()=>close(app+' was not connected.'); };
 const consent=()=>{ const pickList=c.pick?itemsOf(app).filter(()=>true).map(d=>d.id):[]; const state={site:(c.sites||[])[0],sel:new Set(pickList)};
  const draw=()=>{ shell(`${mark}<h1>Broth wants access to your ${esc(c.who)} account</h1><div class="oa-as">${window.AVATAR(u.name||'Aisha Bello','lav',20)}<span>${esc(email)}</span></div>
   ${c.sites?`<label class="oa-l" for="oasite">Use on site</label><select id="oasite">${c.sites.map(x=>`<option ${x===state.site?'selected':''}>${esc(x)}</option>`).join('')}</select>`:''}
   ${c.pick?`<div class="oa-l">Pages to share <button class="link" id="oaall">${state.sel.size===pickList.length?'Clear all':'Select all'}</button></div><div class="oa-pick">${itemsOf(app).map(d=>`<label class="oa-pg"><input type="checkbox" data-pg="${d.id}" ${state.sel.has(d.id)?'checked':''}><span>${B.ICON('doc',15)}${esc(d.title)}</span></label>`).join('')}</div>`:''}
   <div class="oa-l">This will let Broth</div><ul class="oa-sc">${c.scopes.map(([t,d])=>`<li><i>${B.ICON('check',14)}</i><span><b>${esc(t)}</b><small>${esc(d)}</small></span></li>`).join('')}</ul>
   <p class="oa-n">Only use apps you trust. You can remove access any time in your ${esc(c.who)} settings.</p>
   <div class="oa-act"><button class="link" id="oacancel">Cancel</button><button class="oa-allow" id="oaallow" ${c.pick&&!state.sel.size?'aria-disabled="true"':''}><span class="spin" aria-hidden="true"></span><span id="oalab">Allow access</span></button></div>`);
   const sel=$('#oasite',ov); if(sel) sel.onchange=()=>{ state.site=sel.value; };
   $$('[data-pg]',ov).forEach(i=>i.onchange=()=>{ i.checked?state.sel.add(i.dataset.pg):state.sel.delete(i.dataset.pg); const al=$('#oaallow',ov); if(state.sel.size) al.removeAttribute('aria-disabled'); else al.setAttribute('aria-disabled','true'); const aa=$('#oaall',ov); if(aa) aa.textContent=state.sel.size===pickList.length?'Clear all':'Select all'; });
   const aa=$('#oaall',ov); if(aa) aa.onclick=()=>{ if(state.sel.size===pickList.length) state.sel.clear(); else pickList.forEach(x=>state.sel.add(x)); draw(); };
   $('#oacancel',ov).onclick=()=>close(app+' was not connected.');
   $('#oaallow',ov).onclick=()=>{ const b=$('#oaallow',ov); if(b.getAttribute('aria-disabled')==='true'){ B.toast('Pick at least one page to share'); return; } b.classList.add('busy'); b.disabled=true; $('#oalab',ov).textContent='Allowing'; setTimeout(()=>{ if(c.pick) (S.picked=S.picked||{})[app]=[...state.sel]; (S.apps=S.apps||{})[app]=true; S.surface='connectors'; B.save(); done(); },calm?0:800); }; };
  draw(); };
 const done=()=>{ const n=itemsOf(app).filter(B.canSee).length; shell(`<div class="oa-ok"><span class="oa-tick">${B.ICON('check',26)}</span></div><h1>You're connected</h1><p class="oa-s">Returning to Broth</p>`); setTimeout(()=>{ close(app+' connected. '+n+' item'+(n===1?'':'s')+' you can open '+(n===1?'is':'are')+' in the Library.'); B.route(); },calm?200:1100); };
 ov.onkeydown=e=>{ if(e.key==='Escape') close(app+' was not connected.'); };
 if(S.provAuth&&S.provAuth[app]) consent(); else account(); }
window.OPEN_OAUTH=openOAuth;
window.CONNECT_APP=connectModal;
window.SURFACES.connectors=()=>{ const S=B.S; const on=B.appsOn(); const adm=isAdmin(); const admin=window.DIRECTORY?Object.values(window.DIRECTORY).find(p=>p.roles.includes('admin')):null;
 $('#app').className='';
 $('#app').innerHTML=`<div class="pg"><h1>Connectors</h1><div class="cngrid">
  ${APPS.map(([n,d])=>{ const isOn=on.includes(n); const all=itemsOf(n); const mine=all.filter(B.canSee);
   return `<section class="capp ${isOn?'':'off'}" data-app="${n}"><div class="capp-h">${SRCICON(n,36)}<span class="tag ${isOn?'ok':''}">${isOn?'Connected':'Not connected'}</span></div><h2>${n}</h2>
   <div class="capp-a">${isOn?`<button class="btn sm primary" data-lib="${n}">Open library</button>${adm?`<button class="btn sm" data-dis="${n}">Disconnect</button>`:''}`:(adm?`<button class="btn sm primary" data-con="${n}">Connect</button>`:`<span class="amute">Admin only</span>`)}</div></section>`; }).join('')}
  ${SOON.map(([n,ic])=>`<section class="capp soon"><div class="capp-h">${ic?SRCICON(ic,36):`<span class="capp-g">${ICON('plug',18)}</span>`}<span class="tag">Soon</span></div><h2>${n}</h2><p class="capp-d">Coming soon.</p></section>`).join('')}</div></div>`;

 $$('[data-lib]').forEach(b=>b.onclick=()=>{ S.libApp=b.dataset.lib; S.surface='library'; B.save(); B.route(); });
 $$('[data-con]').forEach(b=>b.onclick=()=>connectModal(b.dataset.con));
 $$('[data-dis]').forEach(b=>b.onclick=()=>{ if(b.dataset.arm){ (S.apps=S.apps||{})[b.dataset.dis]=false; if(S.libApp===b.dataset.dis) S.libApp=null; B.save(); B.toast(b.dataset.dis+' disconnected'); B.route(); return; } b.dataset.arm='1'; b.textContent='Confirm disconnect'; b.classList.add('danger'); setTimeout(()=>{ if(b.isConnected){ delete b.dataset.arm; b.textContent='Disconnect'; b.classList.remove('danger'); } },4000); });
};
})();
