/* Support agent: the customer-facing bot as a product. Four pages, one Publish. */
(() => {
const B=window.BRAIN; const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)]; const esc=B.esc;
const NAV=[['Agent',['Overview']],['Build',['Knowledge','Experience']]];
const bot=()=>{ const b=B.S.bot; b.products=b.products||[{id:'p1',name:'Kredete Business app',origin:'app.kredete.example',accent:'#5e6ad2',key:'bk_live_7f3a91c2',live:true},{id:'p2',name:'Kredete Help site',origin:'help.kredete.example',accent:'#26a269',key:'bk_live_c40be8d1',live:true}]; b.fixes=b.fixes||[]; b.version=b.version||1; b.tab=NAV.flatMap(g=>g[1]).includes(b.tab)?b.tab:'Overview'; return b; };
const live=d=>d.id==='fee_schedule'||d.id==='public_fee'||B.S.ext[d.id]===true;
const norm=t=>String(t).toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const drafts=()=>bot().fixes.filter(f=>f.status==='draft').length;

function shell(){ const b=bot(); if(!['Overview','Knowledge','Experience'].includes(b.tab)) b.tab='Overview'; const d=drafts();
  $('#app').className='';
  $('#app').innerHTML=`<div class="lset"><nav class="lrail" aria-label="Support agent">${NAV.map(([g,ts])=>`${ts.map(t=>`<button class="tab" data-at="${t}" aria-current="${b.tab===t?'page':'false'}">${t}</button>`).join('')}`).join('')}</nav>
   <div class="lcont"><div class="aghd"><h1 class="lcont-t">${b.tab}</h1><span class="lsp"></span>${d?`<span class="tag warn">${d} unpublished</span><button class="btn primary" id="agpub">Publish version ${b.version+1}</button>`:b.tab==='Overview'?`<span class="tag ok">Live · version ${b.version}</span>`:''}</div><div id="abpane"></div></div></div>`;
  $$('[data-at]').forEach(x=>x.onclick=()=>{ b.tab=x.dataset.at; B.save(); shell(); window.scrollTo(0,0); });
  const pb=$('#agpub'); if(pb) pb.onclick=()=>{ const n=bot().fixes.filter(f=>f.status==='draft'); n.forEach(f=>f.status='live'); b.version++; B.save(); B.toast('Version '+b.version+' is live on '+b.products.filter(p=>p.live).length+' products'); shell(); };
  window.BOT_HOST=null; ({Overview,Knowledge,Experience}[b.tab]||Overview)(); }

/* ---- Overview: readiness, numbers, live preview ---- */
function Overview(){ const b=bot(), el=$('#abpane'); const liveP=b.products.filter(p=>p.live).length;
  const docs=Object.values(B.D).filter(live).slice(0,5); const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; const vals=liveP?[142,168,155,191,176,88,97]:[0,0,0,0,0,0,0]; const mx=Math.max(...vals,1);
  const kpi=liveP?[['86%','Answered from your sources','+4 pts'],['1,017','Questions this week','+12%'],['9%','Handed to a person','-2 pts'],['4.6','Customer rating','+0.1']]:[['0%','Answered from your sources',''],['0','Questions this week',''],['0%','Handed to a person',''],['0','Customer rating','']];
  const gaps=[['Can I change my payout date?',23,'No source covers payouts timing'],['How do I dispute a charge?',17,'Only an internal policy exists'],['Do you support Apple Pay?',11,'No source mentions it']];
  const hits=[212,164,131,98,74];
  el.innerHTML=`<div class="agov">
   <div class="ovk">${kpi.map(k=>`<div class="astat"><b>${k[0]}</b><span>${k[1]}</span>${k[2]?`<em class="${k[2][0]==='-'&&/Handed/.test(k[1])?'up':k[2][0]==='-'?'dn':'up'}">${k[2]}</em>`:''}</div>`).join('')}</div>
   <div class="acard"><div class="agc-h"><h3>Questions per day</h3><span class="lsp"></span><span class="ovsub">Last 7 days</span></div><div class="ovc" role="img" aria-label="Questions per day, last 7 days">${vals.map((v,i)=>`<div class="ovb"><i style="height:${Math.max(v/mx*100,2)}%"><u>${v}</u></i><span>${days[i]}</span></div>`).join('')}</div></div>
   <div class="ov2">
    <div class="acard"><div class="agc-h"><h3>Questions it could not answer</h3><span class="lsp"></span><button class="btn sm" data-go="Knowledge">Add knowledge</button></div>${gaps.map(g=>`<div class="ovr"><span class="ovt"><b>${g[0]}</b><small>${g[2]}</small></span><span class="ovn">${g[1]}x</span></div>`).join('')}</div>
    <div class="acard"><div class="agc-h"><h3>Most used sources</h3></div>${docs.length?docs.map((d,i)=>`<div class="ovr"><span class="ovt ovs">${SRCICON(d.system,20)}<b>${esc(d.title)}</b></span><span class="ovn">${hits[i]||40}</span></div>`).join(''):'<div class="ovr"><span class="ovt"><small>No sources are visible to customers yet</small></span></div>'}</div>
   </div>
   <div class="ovh"><h3>Products</h3></div><div id="agprod"></div></div>`;
  $$('[data-go]',el).forEach(x=>x.onclick=()=>{ b.tab=x.dataset.go; B.save(); shell(); });
  Products();
 }

/* ---- Conversations: handovers first, then recent, with the fix editor ---- */

/* ---- Knowledge: what customers can know, and ask for more ---- */
function Knowledge(){ const el=$('#abpane'); const docs=Object.values(B.D).filter(d=>d.kind||d.level!=null); const reqs=B.S.items.filter(i=>i.type==='approval'&&i.reqDoc);
  const rows=docs.sort((a,b)=>(live(b)?1:0)-(live(a)?1:0)).map(d=>{ const lv=live(d); const asked=reqs.find(r=>r.reqDoc===d.id&&['open','progress'].includes(r.status)); const canAsk=!lv&&(d.level||0)===0;
   return `<div class="dt-r"><span class="dtp">${SRCICON(d.system,22)}<span><b>${esc(d.title)}</b><small>${esc(d.system)}</small></span></span><span class="dtm"><i class="adot" style="background:${window.LEVEL_COL[d.level||0]}"></i> ${window.LEVELS[d.level||0]}</span><span>${lv?'<span class="tag ok">Visible</span>':asked?'<span class="tag blue">Approval requested</span>':'<span class="tag">Internal</span>'}</span><span class="dtr">${canAsk&&!asked?`<button class="btn sm" data-ask="${d.id}">Ask to approve</button>`:''}</span></div>`; }).join('');
  el.innerHTML=`<div class="dt" style="--cols:minmax(0,2fr) minmax(0,1fr) 150px 130px"><div class="dt-r dt-h"><span>Source</span><span>Level</span><span>For customers</span><span></span></div>${rows}</div>`;
  $$('[data-ask]',el).forEach(x=>x.onclick=()=>{ const d=B.D[x.dataset.ask]; B.S.items.unshift({id:'i'+Date.now(),type:'approval',title:'Approve "'+d.title+'" for the support agent',domain:d.domain,impact:0,owner:d.owner,status:'open',age:'just now',reqDoc:d.id,preview:d.text?B.esc(String(d.text()).replace(/<[^>]+>/g,'')):'',note:'Requested from the Support agent. Approving makes it visible to customers.'}); B.save(); B.toast('Sent to '+d.owner+' for approval'); Knowledge(); }); }


/* ---- Experience: how the bot looks and behaves for customers, with a live preview ---- */
const EXPD={name:'Kredete Assistant',greeting:'Hi, I can answer questions about your Kredete account and cards.',sugg:['What is the card replacement fee?','What is the daily transfer limit?','How much interest does Flexible Saver pay?'],tone:'friendly',handoff:true,unknown:"I could not find that in our help content.",side:'right',accent:'#5e6ad2'};
const expo=()=>{ const b=bot(); b.exp=Object.assign({},EXPD,b.exp||{}); b.exp.sugg=(b.exp.sugg||EXPD.sugg).slice(0,3); return b.exp; };
function expAnswer(q,x){ const ws=q.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!/^(the|what|how|does|can|for|you|are|and|with|much)$/.test(w));
  const docs=Object.values(B.D).filter(live); let best=null,sc=0; docs.forEach(d=>{ const t=(d.title+' '+String(d.text?d.text(d.value):'')).replace(/<[^>]+>/g,' ').toLowerCase(); const n=ws.reduce((a,w)=>a+(t.includes(w)?1:0),0); if(n>sc){ sc=n; best=d; } });
  if(!best||sc<1) return {ok:false,text:x.unknown};
  const raw=String(best.text(best.value)).replace(/<[^>]+>/g,'').split(/(?<=\.)\s/)[0]; return {ok:true,text:(x.tone==='friendly'?'Happy to help! ':'')+raw,src:best.title}; }
function Experience(){ const b=bot(), el=$('#abpane'); const x=expo();
  const seg=(k,opts)=>`<div class="seg exseg" role="group">${opts.map(([v,l])=>`<button type="button" class="exsb ${x[k]===v?'on':''}" data-k="${k}" data-v="${v}" aria-pressed="${x[k]===v}">${l}</button>`).join('')}</div>`;
  const sw=['#5e6ad2','#26a269','#e5484d','#1b1b1f'];
  el.innerHTML=`<div class="exg"><div class="exf">
   <label class="hsl" for="exn" style="margin-top:0">Name</label><input id="exn" class="eminp" value="${esc(x.name)}" maxlength="32">
   <label class="hsl" for="exg">Opening line</label><textarea id="exg" class="eminp" rows="2" maxlength="120">${esc(x.greeting)}</textarea>
   <label class="hsl">Suggested questions</label>${x.sugg.map((q,i)=>`<input class="eminp exsq" data-i="${i}" value="${esc(q)}" maxlength="60" aria-label="Suggested question ${i+1}">`).join('')}
   <div class="exrow"><span class="hsl">Tone</span>${seg('tone',[['friendly','Friendly'],['concise','Concise']])}</div>
   <div class="exrow"><span class="hsl">Colour</span><div class="exsw">${sw.map(c=>`<button type="button" class="exc ${x.accent===c?'on':''}" data-c="${c}" style="--c:${c}" aria-label="Colour ${c}" aria-pressed="${x.accent===c}"></button>`).join('')}</div></div>
   <div class="exrow"><span class="hsl">Button position</span>${seg('side',[['left','Left'],['right','Right']])}</div>
   <div class="exrow"><span class="hsl">Offer a person when it cannot answer</span><input type="checkbox" class="sw" id="exh" ${x.handoff?'checked':''} aria-label="Offer a person"></div>
   <label class="hsl" for="exu">When it does not know</label><input id="exu" class="eminp" value="${esc(x.unknown)}" maxlength="90">
  </div><div class="exp"><div class="exw" style="--ac:${x.accent}"><div class="exh"><span class="exav">${esc(x.name.trim().charAt(0)||'K')}</span><b>${esc(x.name)}</b></div><div class="exm" id="exm"><div class="exb bot">${esc(x.greeting)}</div><div class="exq">${x.sugg.filter(Boolean).map(q=>`<button type="button" class="exqb">${esc(q)}</button>`).join('')}</div></div><form class="exi" id="exfm"><input id="exin" placeholder="Ask a question" aria-label="Ask a question"><button type="submit" class="exs" aria-label="Send">${ICON('send',14)}</button></form></div><div class="exl ${x.side}" style="--ac:${x.accent}" aria-hidden="true">${ICON('chat',20)}</div></div></div>`;
  const upd=()=>{ B.save(); };
  const redraw=()=>{ upd(); Experience(); };
  $('#exn').oninput=e=>{ x.name=e.target.value; upd(); $('.exh b').textContent=x.name; $('.exav').textContent=x.name.trim().charAt(0)||'K'; };
  $('#exg').oninput=e=>{ x.greeting=e.target.value; upd(); const f=$('.exb.bot'); if(f) f.textContent=x.greeting; };
  $$('.exsq',el).forEach(i=>i.onchange=()=>{ x.sugg[+i.dataset.i]=i.value; redraw(); });
  $$('.exsb',el).forEach(b2=>b2.onclick=()=>{ x[b2.dataset.k]=b2.dataset.v; redraw(); });
  $$('.exc',el).forEach(b2=>b2.onclick=()=>{ x.accent=b2.dataset.c; redraw(); });
  $('#exh').onchange=e=>{ x.handoff=e.target.checked; upd(); };
  $('#exu').oninput=e=>{ x.unknown=e.target.value; upd(); };
  const m=$('#exm'); const say=q=>{ q=q.trim(); if(!q) return; const u=document.createElement('div'); u.className='exb me'; u.textContent=q; m.appendChild(u); const r=expAnswer(q,x); const a=document.createElement('div'); a.className='exb bot'; a.textContent=r.text; if(r.src){ const s2=document.createElement('small'); s2.textContent='From '+r.src; a.appendChild(s2); } if(!r.ok&&x.handoff){ const h=document.createElement('button'); h.type='button'; h.className='exqb'; h.textContent='Talk to a person'; h.onclick=()=>{ B.toast('A person will pick this up'); }; a.appendChild(h); } setTimeout(()=>{ m.appendChild(a); m.scrollTop=m.scrollHeight; },380); m.scrollTop=m.scrollHeight; };
  $$('.exqb',el).forEach(q=>{ if(!q.dataset.h) q.onclick=()=>say(q.textContent); });
  $('#exfm').onsubmit=e=>{ e.preventDefault(); const i=$('#exin'); say(i.value); i.value=''; };
}

/* ---- Products: embed anywhere ---- */
const snippet=p=>{ const x=expo(), at=(k,v)=>`\n  data-${k}="${esc(v)}"`;
  return `<script src="https://kredete.vercel.app/embed.js" async`+at('key',p.key)+at('product',p.name)+at('accent',p.accent)+at('name',x.name)+at('greeting',x.greeting)+at('suggestions',JSON.stringify(x.sugg.filter(Boolean)))+at('tone',x.tone)+at('side',x.side)+at('handoff',String(!!x.handoff))+at('unknown',x.unknown)+`><\/script>`; };
function Products(){ const b=bot(), el=$('#agprod'); const sel=b.products.find(p=>p.id===b.selP)||b.products[0]; b.selP=sel.id;
  el.innerHTML=`<div class="pgrid">${b.products.map(p=>`<button type="button" class="pcard ${p.id===sel.id?'on':''}" data-pid="${p.id}" aria-pressed="${p.id===sel.id}"><span class="pico" style="--c:${p.accent}">${ICON(/help|docs|site/i.test(p.name)?'book':'stack',20)}</span><span class="pcn"><b>${esc(p.name)}</b><small>${esc(p.origin)}</small></span><span class="tag ${p.live?'ok':'warn'}">${p.live?'Live':'Revoked'}</span></button>`).join('')}<button type="button" class="pcard padd" id="agadd"><span class="pico plus" aria-hidden="true">+</span><span class="pcn"><b>Add a product</b></span></button></div>
  <div class="acard" style="margin-top:var(--s-3)"><div class="agc-h"><h3>${esc(sel.name)}<small class="pkey">Key ${sel.key.slice(0,8)}••••${sel.key.slice(-4)}</small></h3><span class="lsp"></span><button class="btn sm" id="agrv">${sel.live?'Revoke key':'Restore key'}</button></div><pre class="code" id="agsn">${snippet(sel).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre><div class="actions" style="margin:8px 0 0"><button class="btn primary" id="agcp">Copy snippet</button><a class="link" href="embed-demo.html" target="_blank" rel="noopener">Open demo page ${ICON('ext',14)}</a></div></div>`;
  $$('[data-pid]',el).forEach(x=>{ const o=()=>{ b.selP=x.dataset.pid; B.save(); Products(); }; x.onclick=o; x.onkeydown=e=>{ if(e.key==='Enter') o(); }; });
  $('#agrv').onclick=()=>{ sel.live=!sel.live; B.save(); B.toast(sel.live?'Key restored':'Key revoked. The agent stops answering there.'); shell(); };
  $('#agcp').onclick=()=>{ try{ navigator.clipboard.writeText(snippet(sel)); }catch(e){} B.toast('Snippet copied'); };
  $('#agadd').onclick=()=>addProduct(); }
function addProduct(){ const b=bot(); const m=$('#modal');
  m.innerHTML=`<div class="modal" role="dialog" aria-label="Add a product"><div class="bar"><span>Add a product</span><button class="link" id="mclose">Close</button></div><div class="body"><label class="hsl" for="apn" style="margin-top:0">Name</label><input id="apn" class="eminp" type="text" placeholder="Kredete Consumer app"><label class="hsl" for="apo">Site it runs on</label><input id="apo" class="eminp" type="text" placeholder="consumer.kredete.example"><label class="hsl">Colour</label><select id="apa"><option value="#5e6ad2">Indigo</option><option value="#26a269">Green</option><option value="#e5484d">Red</option><option value="#1b1b1f">Black</option></select><div class="hse" id="ape" role="alert"></div><div class="actions"><button class="btn primary" id="apg">Create key</button><button class="btn" id="apc">Cancel</button></div></div></div>`;
  m.classList.add('on'); m.setAttribute('aria-hidden','false'); $('#mclose').onclick=$('#apc').onclick=B.closeModal; setTimeout(()=>$('#apn').focus(),80);
  $('#apg').onclick=()=>{ const n=$('#apn').value.trim(), o=$('#apo').value.trim().replace(/^https?:\/\//,''); if(!n||!/\./.test(o)){ $('#ape').textContent='Add a name and the site, like app.example.com.'; return; } const id='p'+Date.now(); b.products.push({id,name:n,origin:o,accent:$('#apa').value,key:'bk_live_'+Math.random().toString(16).slice(2,10),live:true}); b.selP=id; B.save(); B.closeModal(); B.toast('Key created for '+n); shell(); }; }

window.AGENTFIX=q=>{ const b=bot(); const f=b.fixes.find(x=>norm(x.q)===norm(q)&&(x.status==='live'||x.status==='draft')); return f?f.a:null; };
window.SURFACES.bot=shell;
})();
