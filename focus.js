/* focus.js: return keyboard focus to the opener after any overlay closes, and make Escape close only the top-most overlay. */
(function(){
  var INTERACTIVE='button,a[href],[role=button],[role=menuitem],.surf,.capp,.pcard,[tabindex]:not([tabindex="-1"]),input,select,textarea,summary';
  var last=null, stack=[], pending=false;
  var on=function(el){ return !!el && el.classList.contains('on'); };
  var DEFS=[
    {key:'modal',  sel:'#modal',  open:on, close:function(){ if(window.BRAIN&&BRAIN.closeModal) BRAIN.closeModal(); }},
    {key:'drawer', sel:'#drawer', open:on, close:function(){ if(window.BRAIN&&BRAIN.closeDrawer) BRAIN.closeDrawer(); }},
    {key:'cmdk',   sel:'#cmdk',   open:on, close:function(){ var x=document.getElementById('kx'); if(x) x.click(); }},
    {key:'oauth',  sel:'#oauth',  open:function(el){ return !!el && !el.classList.contains('out'); }, close:function(el){ if(el&&el.onkeydown) el.onkeydown({key:'Escape',preventDefault:function(){},stopPropagation:function(){}}); }, },
    {key:'menu',   sel:'.pmenu,.cmenu', menu:true, open:function(){ return true; }},
    {key:'menu',   sel:'#lfmenu', menu:true, open:function(el){ return !el.hidden; }}
  ];
  function openNow(){
    var out=[];
    DEFS.forEach(function(d){ document.querySelectorAll(d.sel).forEach(function(el){ if(el.isConnected&&d.open(el)) out.push({el:el,def:d}); }); });
    return out;
  }
  function entryOf(el){ for(var i=0;i<stack.length;i++){ if(stack[i].el===el) return stack[i]; } return null; }
  function visible(el){ return !!el && el.isConnected && !el.closest('[aria-hidden="true"]') && !el.closest('[hidden]') && el.getClientRects().length>0; }
  function fallback(){
    return document.querySelector('main h1, main [role=heading], h1, #app, main') || document.body;
  }
  function restore(entry){
    var a=document.activeElement;
    var lost = !a || a===document.body || !a.isConnected || entry.el.contains(a) || !visible(a);
    if(!lost) return;
    var t=entry.trigger;
    if(!(t && visible(t))){
      t=fallback();
      if(t && t!==document.body && !t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) t.setAttribute('tabindex','-1');
    }
    if(t&&t.focus) t.focus({preventScroll:true});
  }
  function reconcile(){
    pending=false;
    var now=openNow(), els=now.map(function(n){return n.el;});
    var closed=stack.filter(function(e){ return els.indexOf(e.el)<0; });
    stack=stack.filter(function(e){ return els.indexOf(e.el)>=0; });
    now.forEach(function(n){
      if(!entryOf(n.el)){
        var t=last;
        if(t && n.el.contains(t)) t=null;
        stack.push({el:n.el,def:n.def,trigger:t});
      }
    });
    if(closed.length){ var top=closed[closed.length-1]; setTimeout(function(){ restore(top); },40); }
  }
  function schedule(){ if(pending) return; pending=true; Promise.resolve().then(reconcile); }
  function record(e){
    var t=e.target; if(!t||!t.closest) return;
    var el=t.closest(INTERACTIVE);
    if(!el && e.type==='keydown'){ var a=document.activeElement; if(a&&a!==document.body) el=a; }
    if(!el) return;
    // A click inside a menu that is about to close: the real opener is the menu's own trigger.
    var m=el.closest('.pmenu,.cmenu,#lfmenu');
    if(m){ var en=entryOf(m); if(en&&en.trigger) el=en.trigger; }
    last=el;
  }
  document.addEventListener('pointerdown',record,true);
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')) record(e);
  },true);
  window.addEventListener('keydown',function(e){
    if(e.key!=='Escape') return;
    reconcile();
    var layers=stack.filter(function(s){ return !s.def.menu; });
    if(layers.length<2) return;
    var top=layers[layers.length-1];
    if(stack[stack.length-1]!==top) return;
    e.stopImmediatePropagation(); e.preventDefault();
    top.def.close(top.el);
  },true);
  var mo=new MutationObserver(schedule);
  function start(){
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    reconcile();
  }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded',start);
})();
