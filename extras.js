(() => {
const B = window.BRAIN; const $ = (s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)]; const esc=B.esc;
const tg=(t,c)=>`<span class="tag ${c||''}">${t}</span>`;
const S=()=>B.S;
const RN={employee:'Employee',owner:'Content owner',domain:'Domain owner',compliance:'Compliance and Security',admin:'Admin',dev:'Developer'};
const TEAMS=['Design','Engineering','Product','Support','Compliance','Finance'];
const EX={Design:'What is our brand purple?',Product:'What is the card replacement fee?',Support:'What is the card replacement fee?',Payments:'What is the daily transfer limit?',Cards:'What is the card replacement fee?',Savings:'What is the savings interest rate?',Credit:'What is our crypto custody policy?',Compliance:'What is our crypto custody policy?',Finance:'What is the daily transfer limit?',Engineering:'What is the daily transfer limit?'};
const D_=()=>B.D||{};
const A=()=>{ const s=S(); s.auth=s.auth||{expired:false,err:null,reads:{}}; return s.auth; };

/* ---------- sign-in and first run: one shell, the photo never reloads ---------- */
const AUTH={};
AUTH.example=t=>EX[t]||EX.Support;
const dots=n=>`<div class="wiz" aria-label="Step ${n} of 2"><i class="on"></i><i class="${n>1?'on':''}"></i></div>`;
function shell(inner){ document.body.classList.add('noauth'); const app=$('#app'); const cur=$('#sin');
 if(cur&&$('.si')){ cur.classList.add('out'); setTimeout(()=>{ cur.innerHTML=inner; cur.classList.remove('out'); const f=$('#sin h1'); if(f){f.setAttribute('tabindex','-1'); f.focus({preventScroll:true});} },160); return; }
 app.className='siapp'; setTimeout(()=>{ const f=$('#sin h1'); if(f&&(!document.activeElement||document.activeElement===document.body)){ f.setAttribute('tabindex','-1'); f.focus({preventScroll:true}); } },120);
 app.innerHTML=`<div class="si"><div class="si-l"><div class="si-in" id="sin" aria-live="polite">${inner}</div></div><div class="si-r" style="background-image:linear-gradient(180deg,rgba(44,8,96,.15),rgba(44,8,96,.82)),url(assets/jpg/hero-office.jpg)"><div class="si-ov"><div class="si-q">One place to ask what Broth knows, and to fix it when it is wrong.</div><div class="si-s">Cited answers. Owners notified. Every change audited.</div></div></div></div>`; }
const logo='<img src="assets/svg/logo.svg" alt="Enterprise Broth" height="30" class="si-logo">';
document.addEventListener('submit',e=>{ if(e.target&&e.target.id==='pf'){ e.preventDefault(); if(AUTH._pf) AUTH._pf(e.target); } });
/* ---------- sign-in and first run v2: split screen, the right side previews YOUR workspace ---------- */
const DIRX=()=>window.DIRECTORY||{};
const lvlFor=em=>{ const o=(S().levels||{})[em]; const d=DIRX()[em]; return o!=null?o:(d?d.level:0); };
function pvHtml(p){ const sk=w=>`<i class="pvsk" style="width:${w}px"></i>`; const apps=B.appsOn?B.appsOn():['Confluence','Google Drive'];
 return `<div class="pvp" aria-hidden="true"><div class="pvw"><div class="pvs"><div class="pvws"><img class="pvk pvlm" src="assets/brand/logomark.png" alt=""><b>Broth</b></div>${[['compose','New chat'],['library','Library'],['plug','Connectors']].map(([i,l])=>`<div class="pvi">${ICON(i,13)}<span>${l}</span></div>`).join('')}<div class="pvu">${p?AVATAR(p.name,'lav',22)+`<span><b>${esc(p.name)}</b><small>${esc(p.team)}</small></span>`:`<i class="pvav"></i><span>${sk(70)}${sk(44)}</span>`}</div></div>
  <div class="pvm"><div class="pvg">${p?`Hello, ${esc(p.first)}`:sk(120)}</div><div class="pvc"><span>Ask a question</span><i></i></div><div class="pvf">${apps.map(a=>SRCICON(a,14)).join('')}<span>Reading from ${apps.length} apps</span></div>${p?`<div class="pvl"><i style="background:${window.LEVEL_COL[p.level]}"></i>${window.LEVELS[p.level]} access</div>`:''}</div></div><div class="pvcap">${p?'Your workspace':'Your workspace appears here'}</div></div>`; }
function ashell(left,pv,step){ document.body.classList.add('noauth'); const app=$('#app');
 const stp=step?`<div class="stp" role="img" aria-label="Step ${step[0]} of ${step[1]}">${Array.from({length:step[1]},(_,i)=>`<i class="${i+1===step[0]?'on':i+1<step[0]?'done':''}"></i>`).join('')}</div>`:'';
 if($('.si.v2')&&$('#sin')){ const c=$('#sin'); c.innerHTML=stp+left; c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); if(pv!=null) $('#sipv').innerHTML=pv; }
 else { app.className='siapp'; app.innerHTML=`<div class="si v2"><div class="si-l"><div class="si-in in" id="sin" aria-live="polite">${stp+left}</div></div><div class="si-r pv" id="sipv">${pv||''}</div></div>`; }
 const h=$('#sin h1'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:true}); } }
const logo2='<div class="si-brand"><span class="si-wm" role="img" aria-label="Broth"></span></div>';
AUTH.signin=()=>{ const au=A(); const DIR=DIRX();
 const demos=['aisha.bello','sam.idowu','priya.nair'].map(k=>k+'@kredete.example');
 ashell(`${logo2}<h1>Welcome back</h1><p class="sub">Sign in to ask what your company knows.</p><div id="aerr"></div><div class="provs">${[['google','Continue with Google','<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z"/><path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.8v3A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.6 13.6a6.6 6.6 0 0 1 0-4.2v-3H1.8a11 11 0 0 0 0 10.2l3.8-3z"/><path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11 11 0 0 0 1.8 6.4l3.8 3C6.5 6.5 9 5.4 12 5.4z"/></svg>'],['ms','Continue with Microsoft','<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>'],['sso','Continue with SSO',ICON('lock',18)]].map(([k,l,i])=>`<button type="button" class="prov" data-prov="${k}">${i}<span>${l}</span></button>`).join('')}</div><div class="orline"><span>or use your work email</span></div>
  <form id="emf" novalidate><div class="emw"><span class="emi">${ICON('user',16)}</span><input id="em" class="eminp" type="email" inputmode="email" autocomplete="username" placeholder="name@company.com" aria-label="Work email" value=""></div><button class="btn primary si-btn" id="sso" type="submit"><span class="spin" aria-hidden="true"></span><span id="ssol">Continue</span></button></form>
  <p class="si-alt">New to Broth? <button type="button" class="link" id="mkws">Create a workspace</button></p>
  <div class="emdemo"><span>Try a demo account</span><div class="emrow">${demos.map(e=>`<button type="button" class="emchip" data-em="${e}">${AVATAR(DIR[e].name,'lav',24)}<span>${esc(DIR[e].name.split(' ')[0])}</span></button>`).join('')}</div></div>`,pvHtml(null));
 const f=$('#emf');
 const prev=()=>{ const em=$('#em').value.trim().toLowerCase(); const p=DIR[em]; $('#sipv').innerHTML=pvHtml(p?{name:p.name,first:p.name.split(' ')[0],team:p.team,level:lvlFor(em)}:null); };
 $('#em').oninput=prev; prev();
 $$('[data-prov]').forEach(b=>b.onclick=()=>{ $('#em').value=(au.last&&DIR[au.last]?au.last:demos[0]); prev(); $('#emf').requestSubmit(); });
 $('#mkws').onclick=()=>AUTH.signup();
 $$('[data-em]').forEach(b=>b.onclick=()=>{ $('#em').value=b.dataset.em; prev(); f.requestSubmit(); });
 const err=h=>{ $('#aerr').innerHTML=`<div class="banner bad">${h}</div>`; $('#em').setAttribute('aria-invalid','true'); };
 f.onsubmit=e=>{ e.preventDefault(); const em=$('#em').value.trim().toLowerCase(); const sso=$('#sso'); $('#aerr').innerHTML=''; $('#em').removeAttribute('aria-invalid');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ err('<b>Enter your work email.</b> It looks like name@kredete.example.'); return; }
  if(!/@kredete\.example$/.test(em)){ err('<b>That is not a Broth address.</b> Sign in with your work email.'); return; }
  au.last=em; sso.classList.add('busy'); sso.disabled=true; $('#ssol').textContent='Signing you in';
  setTimeout(()=>{
   const prof=DIR[em];
   if(!prof){ ashell(`${logo2}<h1>We could not find you</h1><p class="sub" style="margin:0 0 18px">There is no Broth profile for ${esc(em)}. Ask IT to add you.</p><div class="actions"><button class="btn primary" id="reqacc" type="button">Contact IT</button><button class="btn" id="back" type="button">Back</button></div><p class="disc" id="rq"></p>`,pvHtml(null)); $('#reqacc').onclick=function(){ this.disabled=true; $('#rq').textContent='IT has been notified.'; }; $('#back').onclick=()=>AUTH.signin(); return; }
   au.expired=false; const seen=!!((S().seen||{})[em]); S().user=Object.assign({email:em,onboarded:true,welcomed:seen},prof,{roles:prof.roles.slice()}); AUTH._ob=null; B.save(); B.route(); if(seen) B.toast('Welcome back, '+(S().user.nick||prof.name.split(' ')[0]));
  },650); }; };


/* ---------- create a workspace: four short steps ---------- */
const FREEMAIL=/@(gmail|yahoo|hotmail|outlook|icloud|proton|protonmail|aol)\./i;
AUTH.signup=()=>{ AUTH._su=AUTH._su||{step:1,email:'',name:'',company:'',apps:[],invites:[]}; suRender(); };
function suRender(){ const su=AUTH._su, TOTAL=4;
 const slug=()=>(su.company||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'your-company';
 const pv=()=>pvHtml({name:su.name||'You',first:(su.name||'there').split(' ')[0],team:su.company||'Your company',level:2});
 const nav=(label,skip)=>`<div class="obnav">${su.step>1?`<button class="btn ob-back" id="sub" type="button" aria-label="Back">${ICON('logout',18)}</button>`:''}<button class="btn primary si-btn obgo" id="sun" type="button">${label||'Continue'}</button></div>${skip?`<button class="link obout" id="susk" type="button">${skip}</button>`:''}`;
 const APPS=['Confluence','Google Drive','Notion'];
 let left;
 if(su.step===1) left=`<h1>Create your workspace</h1><p class="sub">Use your work email so teammates can find you.</p><div id="aerr"></div><label class="emlab" for="suem">Work email</label><div class="emw"><span class="emi">${ICON('user',16)}</span><input id="suem" class="eminp" type="email" inputmode="email" autocomplete="email" placeholder="name@company.com" value="${esc(su.email)}"></div>${nav()}<button class="link obout" id="suin" type="button">Already have a workspace? Sign in</button>`;
 else if(su.step===2) left=`<h1>Name your workspace</h1><div id="aerr"></div><label class="emlab" for="sunm">Your name</label><input id="sunm" class="eminp" value="${esc(su.name)}" autocomplete="name" placeholder="Aisha Bello"><label class="emlab" for="suco" style="margin-top:14px">Company</label><input id="suco" class="eminp" value="${esc(su.company)}" autocomplete="organization" placeholder="Acme Bank"><p class="suslug">broth.app/<b id="suslug">${slug()}</b></p>${nav()}`;
 else if(su.step===3) left=`<h1>Connect your first source</h1><p class="sub">Broth only reads what you can already open there.</p><div class="obapps susrc">${APPS.map(a=>{ const on=su.apps.includes(a); return `<button type="button" class="obapp susel ${on?'on':''}" data-app="${a}" aria-pressed="${on}">${SRCICON(a,26)}<b>${a}</b><span class="tag ${on?'ok':''}">${on?'Connected':'Connect'}</span></button>`; }).join('')}</div>${nav('Continue','Skip for now')}`;
 else left=`<h1>Invite your team</h1><p class="sub">They sign in with their work email. You can do this later.</p><label class="emlab" for="suinv">Emails</label><textarea id="suinv" class="eminp suta" rows="3" placeholder="sam@company.com, priya@company.com">${esc(su.invites.join(', '))}</textarea>${nav('Create workspace','Skip for now')}`;
 ashell(left,pv(),[su.step,TOTAL]);
 const err=h=>{ const e=$('#aerr'); if(e) e.innerHTML=`<div class="banner bad">${h}</div>`; };
 const go=d=>{ su.step=Math.max(1,Math.min(TOTAL,su.step+d)); suRender(); };
 const b=$('#sub'); if(b) b.onclick=()=>go(-1);
 const next=()=>go(1);
 if(su.step===1){ const em=$('#suem'); em.focus(); em.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#sun').click(); } }; $('#suin').onclick=()=>{ AUTH._su=null; AUTH.signin(); };
  $('#sun').onclick=()=>{ const v=em.value.trim().toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ err('<b>Enter your work email.</b> It looks like name@company.com.'); return; } if(FREEMAIL.test(v)){ err('<b>Use your work email.</b> Personal addresses cannot create a workspace.'); return; }
   su.email=v; const local=v.split('@')[0], dom=v.split('@')[1].split('.')[0]; if(!su.name) su.name=local.split(/[._-]/).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' '); if(!su.company) su.company=dom.charAt(0).toUpperCase()+dom.slice(1); next(); }; }
 else if(su.step===2){ const nm=$('#sunm'), co=$('#suco'); nm.focus(); const up=()=>{ su.name=nm.value.trim(); su.company=co.value.trim(); $('#suslug').textContent=slug(); $('#sipv').innerHTML=pv(); }; nm.oninput=up; co.oninput=up; [nm,co].forEach(x=>x.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#sun').click(); } });
  $('#sun').onclick=()=>{ up(); if(!su.name||!su.company){ err('<b>Add your name and company.</b>'); return; } next(); }; }
 else if(su.step===3){ $$('[data-app]').forEach(btn=>btn.onclick=()=>{ const a=btn.dataset.app; const t=$('.tag',btn); if(!su.apps.includes(a)){ t.textContent='Connecting'; btn.disabled=true; setTimeout(()=>{ su.apps.push(a); suRender(); },650); } else { su.apps=su.apps.filter(x=>x!==a); suRender(); } }); $('#sun').onclick=next; $('#susk').onclick=next; }
 else { const fin=()=>{ const inv=($('#suinv').value||'').split(/[,\s;]+/).map(x=>x.trim()).filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)); su.invites=inv; const first=su.name.split(' ')[0]; const s2=S();
   s2.levels=s2.levels||{}; s2.levels[su.email]=2; (s2.seen=s2.seen||{})[su.email]=true;
   s2.user={email:su.email,name:su.name,nick:first,title:'Workspace owner',team:'Admin',level:2,roles:['employee','admin'],onboarded:true,welcomed:true,company:su.company,invites:inv}; AUTH._su=null; s2.surface='app'; s2.mode='ask'; s2.thread=[]; B.save(); B.route(); B.toast('Workspace ready'+(inv.length?', '+inv.length+' invite'+(inv.length===1?'':'s')+' sent':'')); };
  $('#sun').onclick=fin; $('#susk').onclick=()=>{ $('#suinv').value=''; fin(); }; }
}

/* ---------- first run: three steps ---------- */
AUTH.welcome=()=>{ const s=S(), u=s.user; if(!AUTH._ob||AUTH._ob.em!==u.email) AUTH._ob={em:u.email,step:1,nick:u.nick||u.name.split(' ')[0],theme:(typeof THEME==='function'?THEME():'dark'),pick:0}; obRender(); };
function obRender(){ const s=S(), u=s.user, ob=AUTH._ob; const TOTAL=3; const first=()=>ob.nick||u.name.split(' ')[0];
 const pv=()=>pvHtml({name:u.name,first:first(),team:u.team,level:lvlFor(u.email)});
 const nav=(next,label,extra)=>`<div class="obnav"><button class="btn ob-back" id="obb" type="button" aria-label="Back" ${ob.step===1?'style="display:none"':''}>${ICON('logout',18)}</button><button class="btn primary si-btn obgo" id="obn" type="button">${label||'Continue'}</button></div>${extra||''}`;
 let left='';
 if(ob.step===1){ left=`<h1>Is this you?</h1><div class="obid">${AVATAR(u.name,'avimg',56)}<div class="obidt"><b>${esc(u.name)}</b><span>${esc(u.title||'')}</span><small>${esc(u.team||'')}${u.location?' · '+esc(u.location):''}</small></div></div><label class="emlab" for="obnick">What should we call you?</label><input id="obnick" class="eminp" value="${esc(ob.nick)}" autocomplete="off">${nav()}<button class="link obout" id="obout" type="button">Not you? Sign out</button>`; }
 else if(ob.step===2){ const apps=B.appsOn();
  left=`<h1>What Broth can read for you</h1><p class="sub">Only what you can already open there.</p><div class="obapps">${apps.map(a=>`<div class="obapp">${SRCICON(a,26)}<b>${a}</b><span class="tag ok">Connected</span></div>`).join('')}</div>${nav()}`; }
 else { const picks=[[AUTH.example(u.team)||'What is the card replacement fee?','chat'],['How do I request access to a source?','lock']]; ob.picks=picks;
  left=`<h1>Ask your first question</h1><div class="obcards" role="radiogroup" aria-label="First question">${picks.map((q,i)=>`<button class="obcard ${ob.pick===i?'on':''}" role="radio" aria-checked="${ob.pick===i}" data-pk="${i}" type="button">${ICON(q[1],16)}<span>${esc(q[0])}</span></button>`).join('')}</div>${nav(0,'Start asking')}<button class="link obout" id="obskip" type="button">Skip for now</button>`; }
 ashell(left,pv(),[ob.step,TOTAL]);
 const fin=q=>{ u.nick=ob.nick&&ob.nick!==u.name.split(' ')[0]?ob.nick:u.nick; u.welcomed=true; (s.seen=s.seen||{})[u.email]=true; AUTH._ob=null; s.surface='app'; s.mode='ask'; s.thread=[]; B.save(); B.route(); if(q) setTimeout(()=>B.ask(q),350); };
 const go=d=>{ ob.step=Math.max(1,Math.min(TOTAL,ob.step+d)); obRender(); };
 $('#obb').onclick=()=>go(-1);
 if(ob.step===1){ const n=$('#obnick'); n.oninput=()=>{ ob.nick=n.value.trim(); $('#sipv').innerHTML=pv(); }; n.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#obn').click(); } }; n.focus(); $('#obn').onclick=()=>{ ob.nick=n.value.trim()||u.name.split(' ')[0]; go(1); }; $('#obout').onclick=()=>{ s.user=null; AUTH._ob=null; B.save(); B.route(); }; }
 else if(ob.step===2){ $('#obn').onclick=()=>go(1); }
 else { $$('[data-pk]').forEach(b=>b.onclick=()=>{ ob.pick=+b.dataset.pk; $$('[data-pk]').forEach(x=>{ const on=x===b; x.classList.toggle('on',on); x.setAttribute('aria-checked',on); }); }); $('#obn').onclick=()=>fin(ob.picks[ob.pick][0]); $('#obskip').onclick=()=>fin(null); } }

/* ---------- step 2: team, then straight into Ask. Roles come from the identity provider ---------- */
AUTH.picker=()=>{ const u=S().user; const first=esc(u.name.split(' ')[0]); const sug='Support';
 shell(`${logo}${dots(2)}<h1>Welcome, ${first}</h1>
  <form id="pf" class="pf">
   <fieldset class="pick"><legend>Your team <span class="cap">Suggested from your Broth profile</span></legend><div class="pills">${TEAMS.map(t=>`<label class="pill"><input type="radio" name="team" value="${t}" ${t===sug?'checked':''}><span>${t}</span></label>`).join('')}</div></fieldset>
   <button class="btn primary si-btn" id="pgo" type="submit"><span class="spin" aria-hidden="true"></span><span id="pgol">Start asking</span></button>
  </form>`);
 const IDP={Compliance:['compliance'],Engineering:['dev']};
 AUTH._pf=f=>{ if(f.dataset.sent) return; f.dataset.sent='1'; const b=$('#pgo'); b.classList.add('busy'); b.disabled=true; $('#pgol').textContent='Setting up your brain';
   u.team=(f.querySelector('input[name=team]:checked')||{}).value||sug; u.roles=['employee',...(IDP[u.team]||[])]; u.onboarded=true; B.save();
   setTimeout(()=>{ const s=S(); s.surface='app'; s.mode='ask'; s.role='employee'; B.save(); B.route(); },450); }; };


/* ---------- shared step table: one wording and one done check per event, used by the Next card and by the guided flows ---------- */
(()=>{ const It=(s,id)=>(s.items||[]).find(i=>i.id===id); const A=(s,th)=>th||s.thread||[]; const Mg=(s,ms)=>ms||(s.bot&&s.bot.msgs)||[];
AUTH.STEPS={
 ask:{w:'Ask your first question',h:'Tap an example question.',done:(s,th)=>A(s,th).length>0},
 report:{w:'Report the conflict to the owner',h:'Use the Report to owner button.',done:s=>!!s.reported},
 rhist:{w:'Reopen a question from your history',h:'Open the History tab on the right and click a question.',done:s=>!!(s.ask&&s.ask.histUsed)},
 rfollow:{w:'Ask a short follow-up',h:'For example: is it waived?',done:(s,th)=>A(s,th).some(x=>x.a&&x.a.follow)},
 rrate:{w:'Rate the answer',h:'Helpful, or Not helpful with a reason.',done:(s,th)=>A(s,th).some(x=>x.fb)}
}; })();

/* ---------- what next: one role-aware card on the Ask home, one step at a time ---------- */
AUTH.nextStep=()=>{ const s=S(), u=s.user; if(!u||!u.onboarded) return null; const nd=u.nd=u.nd||{}; const r=u.roles||[]; const L=[];
 L.push({k:'ask',t:'Ask your first question',b:'See a cited answer, then check where it came from.',l:AUTH.example(u.team)});
 if((s.thread||[]).some(x=>x.a&&x.a.a&&x.a.b)) L.push({k:'report',t:'Report the conflict',b:'Two sources disagree. Tell the owner and they fix it at the source.',l:'Report to owner'});
 if((s.history||[]).length>0){ const th=s.thread||[]; const hq=B.qOf(s.history[0]);
  L.push({k:'rhist',t:'Pick up where you left off',b:'Your questions are saved, only for you. Reopen the last one from History.',l:'Reopen: '+(hq.length>34?hq.slice(0,32)+'...':hq),ask:hq,pre:()=>{ s.ask.histUsed=true; s.ask.pt='answer'; }});
  L.push({k:'rfollow',t:'Ask a short follow up',b:'No need to repeat yourself. The brain remembers the topic.',l:'Is it waived?',ask:'Is it waived?'});
  L.push({k:'rrate',t:'Rate the answer',b:'A quick rating tells owners what to fix first.',l:'Mark it helpful',run:()=>{ const e=th[th.length-1]; if(e){ e.fb={v:'up'}; B.save(); } },stay:true}); }
 L.forEach(x=>{ const d=AUTH.STEPS[x.k]; if(d) x.done=!!d.done(s); });
 const i=L.findIndex(x=>!(nd[x.k]||x.done)); if(i<0) return null; return Object.assign({i:i+1,n:L.length},L[i]); };
AUTH.nextDone=k=>{ const u=S().user; if(u){ (u.nd=u.nd||{})[k]=1; B.save(); } };


/* ---------- header: jump, bell, account ---------- */
window.SURFACES.chats=()=>{ const st=S(); const q0=(st.chatQ||'').toLowerCase().trim(); const T=B.titleOf;
 const ago=t=>{ if(!t) return ''; const m=Math.round((Date.now()-t)/60000); return m<1?'Just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'; };
 const all=(st.history||[]).map(id=>({id,q:B.qOf(id),t:T(id),ts:(st.saved&&st.saved[id]&&st.saved[id][0]&&st.saved[id][0].ts)||0,pin:!!(st.pins&&st.pins[id])})).filter(c=>!q0||(c.t+' '+c.q).toLowerCase().includes(q0)).sort((a,b)=>(b.pin-a.pin));
 $('#app').className=''; $('#app').innerHTML=`<div class="pg"><h1>Chats</h1><div class="libbar"><div class="libs"><span class="libs-i">${ICON('search',15)}</span><input id="chq" type="search" placeholder="Search chats" aria-label="Search chats" value="${esc(st.chatQ||'')}" autocomplete="off"></div></div><div class="actl chl" id="chl"></div></div>`;
 const draw=()=>{ const l=$('#chl'); l.innerHTML=all.length?all.map((c,i)=>`<div class="actr chr" data-o="${i}" role="button" tabindex="0"><span class="actic">${ICON('chat',16)}</span><span class="actt"><b>${esc(c.t)}</b><small>${c.t!==c.q?esc(c.q)+' · ':''}${ago(c.ts)||'Earlier'}</small></span><span class="actb">${c.pin?`<span class="chpin">${ICON('pin',13)}</span>`:''}<button class="lib" data-m="${i}" aria-label="Chat actions" aria-haspopup="menu">${ICON('more',16)}</button></span></div>`).join(''):`<p class="actn">${q0?'No chats match.':'No chats yet. Ask Broth a question to start one.'}</p>`;
  $$('[data-o]',l).forEach(r=>{ const go=()=>B.openChat(all[+r.dataset.o].id); r.onclick=e=>{ if(e.target.closest('[data-m]')) return; go(); }; r.onkeydown=e=>{ if(e.key==='Enter'&&!e.target.closest('[data-m]')) go(); }; });
  $$('[data-m]',l).forEach(b=>b.onclick=e=>{ e.stopPropagation(); const c=all[+b.dataset.m]; const row=b.closest('.chr'); B.chatMenu(b,c.id,{rename:()=>{ const n=row.querySelector('.actt b'); B.editTitle(n,c.id,()=>window.SURFACES.chats()); }}); }); };
 draw(); $('#chq').oninput=e=>{ st.chatQ=e.target.value; B.save(); window.SURFACES.chats(); const i=$('#chq'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); };
};
AUTH.mount=()=>{ const tr=$('.top-right'); if(!$('#acct')){ const a=document.createElement('button'); a.id='acct'; a.className='acct'; a.setAttribute('aria-label','Account'); tr.append(a); a.setAttribute('aria-haspopup','menu'); a.setAttribute('aria-expanded','false'); a.onclick=()=>profileMenu(a); } if(!$('#thm')){ const t=document.createElement('button'); t.id='thm'; t.className='thm'; t.type='button'; tr.append(t); t.onclick=()=>{ applyTheme(isDark()?'light':'dark'); if(window.BRAIN.haptic) window.BRAIN.haptic('select'); if(t.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches) t.animate([{transform:'rotate(-70deg) scale(.6)',opacity:.3},{transform:'none',opacity:1}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'}); }; syncThm(); } };
AUTH.after=()=>{ AUTH.mount(); const s=S(), u=s.user;
 const a=$('#acct'); a.style.display=u?'':'none'; const tb=$('#thm'); if(tb) tb.style.display=u?'':'none'; syncThm(); if(u) a.innerHTML=AVATAR(u.name,'avimg',28)+`<span class="acct-t"><b>${esc(u.name)}</b><small>${esc(u.team||'')}</small></span><svg class="acct-c" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5L6 4.5l3 3"/></svg>`;
 };

/* ---------- theme ---------- */
const THEME=()=>{ try{ return localStorage.getItem('broth-theme')||'dark'; }catch(e){ return 'dark'; } };
function syncThm(){ const t=document.getElementById('thm'); if(!t) return; const d=document.documentElement.dataset.mode==='dark'; t.innerHTML=ICON(d?'sun':'moon',18); t.setAttribute('aria-label',d?'Switch to light mode':'Switch to dark mode'); t.title=d?'Light mode':'Dark mode'; }
function applyTheme(m){ try{ localStorage.setItem('broth-theme',m); }catch(e){} const dark=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches); if(dark) document.documentElement.dataset.mode='dark'; else delete document.documentElement.dataset.mode; syncThm(); }
const isDark=()=>document.documentElement.dataset.mode==='dark';
/* ---------- footer profile menu: account, admin, platform and the rest ---------- */
let pm=null;
function closePM(refocus){ if(!pm) return; const m=pm.el, a=pm.a; pm=null; m.remove(); a.setAttribute('aria-expanded','false'); document.removeEventListener('pointerdown',pmOut,true); window.removeEventListener('resize',pmWin); if(refocus) a.focus({preventScroll:true}); }
const pmOut=e=>{ if(pm&&!pm.el.contains(e.target)&&!pm.a.contains(e.target)) closePM(false); };
const pmWin=()=>closePM(false);
function openAvatarPicker(){ const s=S(), u=s.user; if(!u) return; const m=$('#modal'); let sel=u.avatar?JSON.parse(JSON.stringify(u.avatar)):null;
  const hasWork=!!(typeof AVATAR==='function'&&['aisha bello','daniel reyes','amara okafor','priya nair','tomas berg','leo marsh'].includes(String(u.name).toLowerCase()));
  const src=a=>window.avatarSrc(a);
  const prev=()=>{ const el=$('#avprev'); if(!el) return; const sc=sel?src(sel):''; el.innerHTML=sc?`<img src="${sc}" alt="">`:`<span class="avini">${esc((u.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2))}</span>`; if(!sel&&hasWork){ const o=document.createElement('div'); o.innerHTML=AVATAR(u.name,'avimg',96).replace(/\s*style="[^"]*"/,''); el.innerHTML=''; el.append(o.firstChild); } };
  const grid=()=>{ const g=$('#avgrid'); g.innerHTML=`<button type="button" class="avt avup" id="avup" aria-label="Upload a photo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Upload</span></button>`+(sel&&sel.kind==='photo'?`<button type="button" class="avt on" data-av="photo" aria-pressed="true" aria-label="Your photo"><img src="${sel.data}" alt=""></button>`:'')+window.AV_LIB.map(a=>`<button type="button" class="avt ${sel&&sel.kind==='lib'&&sel.id===a.id?'on':''}" data-av="${a.id}" aria-pressed="${sel&&sel.kind==='lib'&&sel.id===a.id?'true':'false'}" aria-label="Avatar ${a.id.slice(1)}"><img src="${a.src}" alt=""></button>`).join('');
    $('#avup').onclick=()=>$('#avfile').click(); g.querySelectorAll('[data-av]').forEach(b=>b.onclick=()=>{ if(b.dataset.av==='photo') return; sel={kind:'lib',id:b.dataset.av}; if(window.BRAIN.haptic) window.BRAIN.haptic('select'); prev(); grid(); }); };
  m.innerHTML=`<div class="modal avpick" role="dialog" aria-modal="true" aria-label="Choose your avatar"><div class="bar"><span>Choose your avatar</span><button class="link" id="mclose">Close</button></div><div class="body avbody"><div class="avprev" id="avprev"></div><div class="avgrid" id="avgrid"></div><input type="file" id="avfile" accept="image/*" hidden><div class="actions"><button class="btn" id="avrm">${hasWork?'Use my work photo':'Use my initials'}</button><span class="lsp"></span><button class="btn primary" id="avsave">Save</button></div></div></div>`;
  m.classList.add('on'); m.setAttribute('aria-hidden','false'); $('#mclose').onclick=B.closeModal; prev(); grid();
  $('#avrm').onclick=()=>{ sel=null; prev(); grid(); };
  $('#avfile').onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); const k=Math.min(im.width,im.height); g.drawImage(im,(im.width-k)/2,(im.height-k)/2,k,k,0,0,256,256); sel={kind:'photo',data:c.toDataURL('image/jpeg',.86)}; prev(); grid(); }; im.src=fr.result; }; fr.readAsDataURL(f); };
  $('#avsave').onclick=()=>{ if(sel) u.avatar=sel; else delete u.avatar; B.save(); B.closeModal(); B.toast('Avatar updated'); if(window.BRAIN.haptic) window.BRAIN.haptic('success'); B.route(); }; }
document.addEventListener('click',e=>{ const b=e.target.closest('#avchg'); if(b){ e.preventDefault(); openAvatarPicker(); } });
function profileMenu(a){ if(pm){ closePM(true); return; } const s=S(), u=s.user; if(!u) return; const roles=u.roles||[];
 const adm=roles.includes('admin')||roles.includes('compliance'), dev=roles.includes('dev');
 const sf=s.surface||'app';
 const it=(k,l,ic,extra)=>`<button type="button" class="pm-i" role="menuitem" data-pm="${k}" ${sf===k?'aria-current="page"':''}>${ICON(ic,18)}<span>${l}</span>${extra||''}</button>`;
 const th=THEME();
 let h=`<div class="pm-head"><button type="button" class="pm-who" role="menuitem" data-pm="account">${AVATAR(u.name,'avimg',40)}<span><b>${esc(u.name)}</b><small>${esc(u.email||'')}</small><em>${esc(u.team||'')}</em></span></button><button type="button" class="pm-go" role="menuitem" data-pm="account" aria-label="Account settings">${ICON('chevr',16)}</button></div>`;
 h+='<div class="pm-s"></div>';
 h+=it('account','Account settings','user');
 if(adm||dev) h+=it('bot','Support agent','headset');

 h+='<div class="pm-s"></div><button type="button" class="pm-i danger" role="menuitem" data-pm="out">'+ICON('logout',18)+'<span>Sign out</span></button>';
 const el=document.createElement('div'); el.className='pmenu'; el.setAttribute('role','menu'); el.setAttribute('aria-label','Profile'); el.innerHTML=h; document.body.appendChild(el);
 const r=a.getBoundingClientRect(); el.style.left=Math.max(8,Math.min(r.left,innerWidth-el.offsetWidth-8))+'px'; el.style.bottom=(innerHeight-r.top+6)+'px'; el.style.maxHeight=Math.max(200,r.top-16)+'px';
 pm={el,a}; a.setAttribute('aria-expanded','true'); const items=[...el.querySelectorAll('.pm-i,.pm-who,.pm-go')]; let cur=-1; const hi=n=>{ cur=n; items[n].focus({preventScroll:true}); }; el.setAttribute('tabindex','-1'); el.focus({preventScroll:true});
  items.filter(b=>b.dataset.pm).forEach(b=>b.onclick=()=>{ const k=b.dataset.pm; closePM(false); if(window.BRAIN.haptic) window.BRAIN.haptic('light'); if(k==='theme'){ applyTheme(isDark()?'light':'dark'); return; } if(k==='out'){ s.user=null; A().expired=false; B.save(); B.route(); return; } s.surface=k; B.save(); B.route(); window.scrollTo(0,0); });
 el.onkeydown=e=>{ if(e.key==='ArrowDown'){ e.preventDefault(); hi((cur+1)%items.length); } else if(e.key==='ArrowUp'){ e.preventDefault(); hi((cur-1+items.length)%items.length); } else if(e.key==='Home'){ e.preventDefault(); hi(0); } else if(e.key==='End'){ e.preventDefault(); hi(items.length-1); } else if(e.key==='Escape'||e.key==='Tab'){ e.preventDefault(); closePM(true); } };
 document.addEventListener('pointerdown',pmOut,true); window.addEventListener('resize',pmWin); }

/* ---------- account settings page ---------- */
window.SURFACES.account=()=>{ const s=S(), u=s.user; if(!u){ s.surface='app'; B.route(); return; }
 const NAV=[['',[['Profile','Profile'],['Sessions','Sessions'],['Data','Data']]]];
 const ids=NAV.flatMap(g=>g[1].map(x=>x[0])); const tab=ids.includes(s.acctTab)?s.acctTab:'Profile';
 const hint=t=>`<span class="hint" tabindex="0" data-tip="${t}" aria-label="${t}">i</span>`;
 $('#app').className='';
 $('#app').innerHTML=`<div class="lset"><nav class="lrail" aria-label="Account">${NAV.map(([g,ts],gi)=>`${gi?'<div class="lrail-sep" role="separator"></div>':''}${ts.map(([k,l])=>`<button class="tab" data-at="${k}" aria-current="${k===tab?'page':'false'}">${l}</button>`).join('')}`).join('')}<div class="lrail-f"><button class="tab out" id="aout">Sign out</button></div></nav><div class="lcont"><h1 class="lcont-t">${(NAV.flatMap(g=>g[1]).find(x=>x[0]===tab)||[0,tab])[1]}</h1><div id="acpane"></div></div></div>`;
 $$('[data-at]').forEach(b=>b.onclick=()=>{ s.acctTab=b.dataset.at; s.acctEdit=null; B.save(); window.SURFACES.account(); });
 $('#aout').onclick=()=>{ s.user=null; A().expired=false; B.save(); B.route(); };
 const el=$('#acpane'); const myL=B.myLevel(); const locked=B.lockedFor(); const seen=Object.values(B.D).filter(d=>B.canSee(d)&&d.level!=null).length;
 const fr=(l,d,v,act)=>`<div class="frow"><div class="frl"><b>${l}</b>${d?`<small>${d}</small>`:''}</div><div class="frv">${v}</div><div class="fra">${act||''}</div></div>`;
 
 const P={
  Profile(){ const ed=s.acctEdit; const nick=u.nick||String(u.name).split(' ')[0];
   el.innerHTML=`<div class="acid"><button type="button" class="avchg" id="avchg" aria-label="Change avatar" title="Change avatar">${AVATAR(u.name,'avimg',88)}<span class="avedit">${ICON('compose',14)}</span></button><div class="acidt"><h2>${esc(u.name)}</h2><div>${esc(u.title||'')}</div><div class="amute">${esc(u.email)}</div></div></div>
   <div class="fgroup">${fr('Preferred name','',ed==='nick'?`<input id="enick" class="eminp" value="${esc(nick)}" aria-label="Preferred name" style="margin:0;max-width:260px">`:esc(nick),ed==='nick'?'<button class="btn sm primary" id="enks">Save</button><button class="btn sm" id="enkc">Cancel</button>':'<button class="btn sm" id="enk">Edit</button>')}
   ${fr('Appearance','',`<select id="etheme" aria-label="Appearance">${[['light','Light'],['dark','Dark'],['system','Match my device']].map(([k,l])=>`<option value="${k}" ${THEME()===k?'selected':''}>${l}</option>`).join('')}</select>`)}</div>
   <h3 class="ach">From your work account ${hint('Managed by IT. Ask IT to change these.')}</h3><div class="fgroup">${fr('Team','',esc(u.team||''))}${fr('Location','',esc(u.location||''))}${fr('Manager','',u.manager?AVATAR(u.manager,'lav',20)+' '+esc(u.manager):'')}${fr('Roles','',`<span class="acchips">${u.roles.map(r=>`<span class="tag">${esc(RN[r]||r)}</span>`).join('')}</span>`)}</div>`;
   const sv=()=>{ B.save(); B.toast('Saved'); };
   const en=$('#enk'); if(en) en.onclick=()=>{ s.acctEdit='nick'; P.Profile(); $('#enick').focus(); }; const c=$('#enkc'); if(c) c.onclick=()=>{ s.acctEdit=null; P.Profile(); };
   const ks=$('#enks'); if(ks) ks.onclick=()=>{ const v=$('#enick').value.trim(); if(!v){ B.toast('Add a name first'); return; } u.nick=v; s.acctEdit=null; sv(); P.Profile(); };
   $('#etheme').onchange=e=>{ applyTheme(e.target.value); }; },
  Access(){ const mine=(s.requests||[]).filter(r=>r.by===u.name).slice().reverse(); const gr=s.grants||{};
   el.innerHTML=`<div class="lvlbar" role="img" aria-label="Your access level is ${window.LEVELS[myL]}">${window.LEVELS.map((l,i)=>`<div class="lvs ${i<=myL?'on':''} ${i===myL?'cur':''}"><i style="background:${window.LEVEL_COL[i]}"></i><b>${l}</b>${i===myL?'<small>You</small>':''}</div>`).join('')}</div>
   <p class="acline">You can open <b>${seen}</b> of ${seen+locked.length} sources.</p>
   ${locked.length?`<h3 class="ach">Needs access</h3><div class="actl">${locked.map(d=>{ const r=(s.requests||[]).find(x=>x.doc===d.id&&x.by===u.name&&!gr[d.id]); return `<div class="actr"><span class="actic">${ICON('lock',16)}</span><span class="actt"><b>${esc(d.title)}</b><small>Needs ${esc(window.LEVELS[d.level||0])} · owned by ${PERSON(d.owner,14)}</small></span><span class="actb">${r?'<span class="tag blue">Request sent</span>':`<button class="btn sm primary" data-rq="${d.id}">Request access</button>`}</span></div>`; }).join('')}</div>`:'<p class="amute">Nothing needs access.</p>'}
   ${mine.filter(r=>gr[r.doc]).length?`<h3 class="ach">Granted to you</h3><div class="actl">${mine.filter(r=>gr[r.doc]).map(r=>`<div class="actr"><span class="actic">${ICON('check',16)}</span><span class="actt"><b>${esc((B.D[r.doc]||{}).title||r.doc)}</b></span><span class="tag ok">Granted</span></div>`).join('')}</div>`:''}`;
   $$('[data-rq]',el).forEach(b=>b.onclick=()=>B.requestAccess(b.dataset.rq)); },
  Sessions(){ const devIc=d=>{ const P=/iphone|android|phone|mobile/i.test(d)?'<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M11 18h2"/>':/windows|linux|desktop/i.test(d)?'<rect x="3.5" y="4.5" width="17" height="11" rx="1.8"/><path d="M9 20h6M12 15.5V20"/>':'<rect x="5" y="5" width="14" height="10" rx="1.6"/><path d="M3 18.5h18"/>'; return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P}</svg>`; }; const ss=s.sessions||(s.sessions=[{id:'cur',dev:'Chrome on macOS',loc:'Lagos',at:'Now',cur:true},{id:'a',dev:'Safari on iPhone',loc:'Lagos',at:'2 days ago'},{id:'b',dev:'Edge on Windows',loc:'London',at:'5 days ago'}]);
   el.innerHTML=`<div class="fgroup">${fr('Sign-in','Broth single sign-on','<span class="tag ok">Managed by IT</span>')}${fr('2-step verification','','<span class="tag ok">Required</span>')}${fr('Simulate session expiry','','','<button class="btn sm" id="aexp">Expire</button>')}</div>
   <h3 class="ach">Devices ${ss.length}</h3><div class="dt" style="--cols:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) 110px"><div class="dt-r dt-h"><span>Device</span><span>Location</span><span>Last active</span><span></span></div>${ss.map(x=>`<div class="dt-r"><span class="dtp"><i class="devic" aria-hidden="true">${devIc(x.dev)}</i><b style="font-weight:500">${x.dev}</b>${x.cur?'<span class="tag ok">This device</span>':''}</span><span class="dtm">${x.loc}</span><span class="dtm">${x.at}</span><span>${x.cur?'':`<button class="btn sm" data-so="${x.id}">Sign out</button>`}</span></div>`).join('')}</div>
   ${ss.length>1?'<div class="actions" style="margin-top:14px"><button class="btn" id="soall">Sign out of all other devices</button></div>':''}`;
   $('#aexp').onclick=()=>{ s.user=null; A().expired=true; B.save(); B.route(); };
   $$('[data-so]',el).forEach(b=>b.onclick=()=>{ s.sessions=ss.filter(x=>x.id!==b.dataset.so); B.save(); B.toast('Device signed out'); P.Sessions(); }); const all=$('#soall'); if(all) all.onclick=()=>{ s.sessions=ss.filter(x=>x.cur); B.save(); B.toast('Signed out everywhere else'); P.Sessions(); }; },
  Data(){ el.innerHTML=`<div class="fgroup">${fr('Download my data','Your profile and questions, as a file.','','<button class="btn sm" id="adl">Download</button>')}${fr('Delete my question history','Only you can see it.','','<button class="btn sm danger-o" id="aclr">Delete</button>')}${fr('Replay onboarding','','','<button class="btn sm" id="atour">Replay</button>')}</div>`;
   $('#atour').onclick=()=>{ u.welcomed=false; AUTH._ob=null; B.save(); B.route(); };
   $('#aclr').onclick=function(){ if(!this.dataset.arm){ this.dataset.arm='1'; this.textContent='Confirm delete'; return; } s.history=[]; s.thread=[]; B.save(); B.toast('Your history was deleted'); B.route(); };
   $('#adl').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify({user:u,history:s.history,questions:s.thread.map(t=>t.q)},null,2)],{type:'application/json'})); a.download='my-brain-data.json'; a.click(); }; },
 }; P[tab]();
};

/* ---------- onboarding tours ---------- */
function steps(){ const st=[];
 st.push({ic:'chat',t:'Ask anything',b:`Type a question the way you would ask a colleague. Try: "${EX[S().user.team]||EX.Support}"`,act:{l:'Go to Ask',f:()=>{S().surface='app';S().mode='ask';}}});
 st.push({ic:'stack',t:'Check the source',b:'Every answer has numbered citations. Hover one for a preview, click it to open the source panel with the passage, its owner and when it was last verified.'});
 st.push({ic:'flow',t:'When sources disagree',b:'A conflict card shows both sides with their dates, and tags the recommended one. Use Report to owner and the right person gets it.'});
 st.push({ic:'shield',t:'Your chats are private',b:'Only you can see them. Use the chat menu to rename, pin or delete any chat.'});
 return st; }
AUTH.tour=()=>{ const st=steps(); let i=0; const u=S().user;
 const draw=()=>{ const x=st[i]; $('#modal').innerHTML=`<div class="modal" role="dialog" aria-label="Welcome tour"><div class="body"><div class="wiz">${st.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div><div class="tourico" aria-hidden="true">${ICON(x.ic,20)}</div><p class="sub" style="margin:0 0 4px">Step ${i+1} of ${st.length}</p><h2>${esc(x.t)}</h2><p>${esc(x.b)}</p><div class="actions">${i>0?'<button class="btn" id="tb">Back</button>':''}${x.act?`<button class="btn" id="ta">${esc(x.act.l)}</button>`:''}<button class="btn primary" id="tn">${i<st.length-1?'Next':'Done'}</button><button class="link" id="ts">Skip tour</button></div></div></div>`;
  $('#modal').classList.add('on'); const fin=()=>{ u.onboarded=true; u.toured=true; B.save(); B.closeModal(); };
  $('#ts').onclick=fin; $('#tn').onclick=()=>{ if(i<st.length-1){i++;draw();} else fin(); }; const tb=$('#tb'); if(tb) tb.onclick=()=>{i--;draw();}; const ta=$('#ta'); if(ta) ta.onclick=()=>{ fin(); x.act.f(); B.save(); B.route(); }; }; draw(); };

/* ---------- document details and lineage ---------- */
window.DOCDETAIL=id=>{ const d=B.D[id]; const s=S(); const cited=[...s.audit].filter(e=>e.sources.includes(id)); const qs=s.thread.filter(t=>(t.a.sources||(t.a.a?[t.a.a,t.a.b]:[])).some(x=>x.id===id));
 const ver=[['v3',d.verified,d.owner,'Current'],['v2','2 Jun 2025',d.owner,'Superseded'],['v1','11 Jan 2025',d.owner,'Superseded']];
 $('#modal').innerHTML=`<div class="modal" style="max-width:720px" role="dialog"><div class="bar"><span>${esc(d.title)}</span><button class="link" id="mc">Close</button></div><div class="body">
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${tg(d.authority,/Approved/.test(d.authority)&&!/past/.test(d.authority)?'ok':'warn')}${tg(d.system)}${tg(d.domain,'blue')}</div>
  <dl class="kv"><dt>Owner</dt><dd>${PERSON(d.owner,20)}, ${esc(d.ownerRole)}</dd><dt>Last verified</dt><dd>${d.verified}</dd><dt>Sensitivity</dt><dd>Internal</dd><dt>Access</dt><dd>${d.id==='fee_schedule'?'All staff':'Support, Payments'}</dd><dt>External use</dt><dd>${d.id==='fee_schedule'?'Approved':'Not approved'}</dd></dl>
  <h4 style="font-weight:500;margin:0 0 6px">Lineage: answers that cited this</h4>${cited.length?`<ul style="margin:0 0 14px;padding-left:18px">${cited.slice(0,5).map(e=>`<li>${esc(e.q)} <span class="sub" style="margin:0">(${e.channel}, ${e.time})</span></li>`).join('')}</ul>`:'<p class="sub">Not cited yet in this session.</p>'}
  <h4 style="font-weight:500;margin:0 0 6px">Version history</h4><table><tr><th>Version</th><th>Verified</th><th>By</th><th></th></tr>${ver.map(v=>`<tr><td>${v[0]}</td><td>${v[1]}</td><td>${esc(v[2])}</td><td>${tg(v[3],v[3]==='Current'?'ok':'')}</td></tr>`).join('')}</table>
  <div class="actions"><button class="btn primary" id="mo">Open in ${esc(d.system)}</button></div></div></div>`;
 $('#modal').classList.add('on'); $('#mc').onclick=B.closeModal; $('#mo').onclick=()=>B.toast('Opens the source system'); };

/* ---------- accessibility: live region ---------- */
const live=document.createElement('div'); live.setAttribute('aria-live','polite'); live.className='sr'; live.id='live'; document.body.appendChild(live);
new MutationObserver(()=>{ const t=$('.thread article:last-child .ans'); if(t&&!t.classList.contains('cursor')) live.textContent=t.textContent; }).observe($('#app'),{childList:true,subtree:true});
/* ---------- dialogs: roles, focus trap, inert background, focus return ---------- */
(function(){ const FOC='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])'; let opener=null;
 const bg=()=>[...document.querySelectorAll('.top,.mainpanel')];
 function wire(id,label){ const el=document.getElementById(id); if(!el) return; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label',label);
  new MutationObserver(()=>{ const on=el.classList.contains('on'); if(on){ if(!el.dataset.open){ el.dataset.open='1'; opener=document.activeElement; bg().forEach(x=>x.setAttribute('inert','')); el.setAttribute('aria-hidden','false'); setTimeout(()=>{ const f=el.querySelector(FOC); (f||el).focus&&(f||el).focus(); },60); } } else if(el.dataset.open){ delete el.dataset.open; el.setAttribute('aria-hidden','true'); if(!document.querySelector('#modal.on,#drawer.on')) bg().forEach(x=>x.removeAttribute('inert')); if(opener&&opener.focus&&document.contains(opener)) opener.focus(); } }).observe(el,{attributes:true,attributeFilter:['class']});
  el.addEventListener('keydown',ev=>{ if(ev.key!=='Tab') return; const f=[...el.querySelectorAll(FOC)].filter(x=>x.offsetParent!==null); if(!f.length){ ev.preventDefault(); return; } const first=f[0], last=f[f.length-1]; if(ev.shiftKey&&document.activeElement===first){ ev.preventDefault(); last.focus(); } else if(!ev.shiftKey&&document.activeElement===last){ ev.preventDefault(); first.focus(); } }); }
 wire('modal','Dialog'); wire('drawer','Details panel'); })();
window.AUTH=AUTH;
})();
