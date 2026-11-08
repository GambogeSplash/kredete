/* Admin and Platform: turn the tab strip into a left rail, like Linear settings. */
(() => {
const app=document.getElementById('app');
const wrap=()=>{
  const sf=document.body.dataset.sf; if(sf!=='admin'&&sf!=='platform'&&sf!=='bot') return;
  const tabs=app.querySelector(':scope > .tabs'); if(!tabs||app.querySelector(':scope > .lset')) return;
  const h1=app.querySelector('h1');
  const set=document.createElement('div'); set.className='lset';
  const rail=document.createElement('nav'); rail.className='lrail'; rail.setAttribute('aria-label','Sections');
  const head=document.createElement('div'); head.className='lrail-h'; head.textContent=''; rail.append(head,tabs); head.textContent=h1?h1.textContent:'';
  const cont=document.createElement('div'); cont.className='lcont';
  const title=h1?h1.textContent:''; if(h1) h1.remove();
  [...app.children].forEach(n=>{ if(n!==tabs) cont.appendChild(n); });
  const t=document.createElement('h1'); t.className='lcont-t'; const cur=tabs.querySelector('[aria-current=page]'); t.textContent=cur?cur.textContent:''; cont.prepend(t);
  set.append(rail,cont); app.appendChild(set);
  tabs.removeAttribute('role');
};
new MutationObserver(()=>wrap()).observe(app,{childList:true});
wrap();
})();
