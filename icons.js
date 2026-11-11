// Inline SVG icon set (24px grid, 1.7 stroke). Used across the three reference-exact screens.
(() => {
const P={
 quote:'<path d="M9.5 8H7a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2.5v1.5A2.5 2.5 0 0 1 7 19M18.5 8H16a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2.5v1.5A2.5 2.5 0 0 1 16 19"/>',
 inbox:'<path d="M4 13l2.6-7h10.8L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.6l1 2h4.8l1-2H20"/>',
 bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2.2h5c0-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
 memory:'<path d="M5 11a7 7 0 0 1 14 0M8.5 11a3.5 3.5 0 0 1 7 0M12 11v4c0 2-1 3.4-2.4 4.5M15.5 12c0 3-.8 5-2.3 7M8.5 12c0 2 .3 4-.9 6"/>',
 lock:'<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
 grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 library:'<path d="M4.5 4v16"/><path d="M9 7v13"/><path d="M13.5 5.5v14.5"/><path d="m17 6.5 3.4 13"/>',
 plug:'<path d="M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0v-3zM12 17v3.5"/>',
 clip:'<path d="m20.5 11.2-8.7 8.7a5.5 5.5 0 0 1-7.8-7.8l8.7-8.7a3.7 3.7 0 0 1 5.2 5.2l-8.7 8.7a1.8 1.8 0 0 1-2.6-2.6l8-8"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
 rows:'<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
 moon:'<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
 folder:'<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5z"/>',
 home:'<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8z"/>',
 panel:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
 tune:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 kebab:'<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
 globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3.2 3 13.8 0 17M12 3.5c-3 3.2-3 13.8 0 17"/>',
 chevd:'<path d="M6 9.5l6 6 6-6"/>',
 chevr:'<path d="M9.5 6l6 6-6 6"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
 thumbup:'<path d="M7.5 11v8.5h-3V11h3zM7.5 11l3.5-7a2 2 0 0 1 2 2v3.5h5.2a2 2 0 0 1 2 2.4l-1.2 5.6a2 2 0 0 1-2 1.6H7.5"/>',
 thumbdown:'<path d="M7.5 13V4.5h-3V13h3zM7.5 13l3.5 7a2 2 0 0 0 2-2v-3.5h5.2a2 2 0 0 0 2-2.4l-1.2-5.6a2 2 0 0 0-2-1.6H7.5"/>',
 share:'<circle cx="6" cy="12" r="2.3"/><circle cx="17.5" cy="6" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/><path d="M8 11l7.5-3.8M8 13l7.5 3.8"/>',
 pin:'<path d="M9 4h6l-1 5 3 3H7l3-3-1-5zM12 12v8"/>',
 refresh:'<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/>',
 cal:'<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
 filter:'<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
 sliders:'<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 inbox:'<path d="M4 13l2.5-7.5h11L20 13v5.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V13zM4 13h4.5l1 2h5l1-2H20"/>',
 stack:'<path d="M12 4l8.5 4.5L12 13 3.5 8.5 12 4zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
 cube:'<path d="M12 3.5l8 4.2v8.6l-8 4.2-8-4.2V7.7l8-4.2zM12 12v8.5M4 7.7l8 4.3 8-4.3"/>',
 more:'<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
 doc:'<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1zM14 3.5V8h4"/>',
 logout:'<path d="M9 20.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5h3"/><path d="M15.5 16.5L20 12l-4.5-4.5"/><path d="M20 12H9.5"/>',
 helpc:'<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7"/><path d="M12 16.8h.01"/>',
 headset:'<path d="M4.5 14.5V12a7.5 7.5 0 0 1 15 0v2.5"/><rect x="3" y="13.5" width="3.5" height="5.5" rx="1.6"/><rect x="17.5" y="13.5" width="3.5" height="5.5" rx="1.6"/><path d="M19.2 19c0 1.4-1.6 2-4 2h-1.7"/>',
 user:'<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="10" r="3"/><path d="M6.4 18.3c1.2-2.1 3.3-3.3 5.6-3.3s4.4 1.2 5.6 3.3"/>',
 image:'<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17l4.5-4.5 3.5 3.5 2-2 4 4"/>',
 compose:'<path d="M11 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-4"/><path d="M17.3 4.7a1.6 1.6 0 0 1 2.3 2.3L12.2 14.4l-3.2.8.8-3.2 7.5-7.3z"/>',
 apps:'<g fill="currentColor"><circle cx="6" cy="6" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></g>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/>',
 analytics:'<path d="M3.5 17l5.5-5.5 3.5 3.5 7.5-8M15 7h5.5v5.5"/>',
 ext:'<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
 chat:'<path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-6l-4.5 3.5V16H7a2 2 0 0 1-2-2V6.5z"/>',
 bot:'<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.2h5"/>',
 shield:'<path d="M12 3.5l7 2.6v5.6c0 4.2-2.9 7.6-7 8.8-4.1-1.2-7-4.6-7-8.8V6.1l7-2.6zM9 12l2.2 2.2L15.5 10"/>',
 book:'<path d="M5 5.5a1.5 1.5 0 0 1 1.5-1.5H19v14.5H6.5A1.5 1.5 0 0 0 5 20V5.5zM5 20a1.5 1.5 0 0 0 1.5 1.5H19V18.5"/>',
 flow:'<circle cx="6" cy="6" r="2.3"/><circle cx="18" cy="12" r="2.3"/><circle cx="6" cy="18" r="2.3"/><path d="M8 7l8 4M8 17l8-4"/>',
 hash:'<path d="M9 4L7.5 20M16.5 4L15 20M4.5 9h15M4 15h15"/>',
 palette:'<path d="M12 4a8 8 0 1 0 0 16c1.3 0 2-.8 2-1.8 0-.9-.6-1.4-.6-2.2 0-.9.7-1.5 1.6-1.5H17a3 3 0 0 0 3-3C20 7.2 16.4 4 12 4z"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="10.5" r="1" fill="currentColor"/>',
 bell:'<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15L6 17zM10 20.5a2 2 0 0 0 4 0"/>',
 send:'<path d="M12 19.5V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const PEOPLE={'aisha bello':'aisha-bello','daniel reyes':'daniel-reyes','amara okafor':'amara-okafor','priya nair':'priya-nair','tomas berg':'tomas-berg','leo marsh':'leo-marsh'};
window.PERSON=(name,px,cls)=>`<span class="who">${window.AVATAR(name,cls||'lav',px||18)}<span>${String(name==null?'':name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span></span>`;

/* Avatar library: 16 generated avatars (8 shapes x 2 palettes). A user can also upload a photo. */
(function(){
 const PAL=[['#5e6ad2','#b9c0ff'],['#d946a8','#ffc4e8'],['#0d9488','#a7f3ec'],['#f59e0b','#ffe2a0'],['#16a34a','#b7f0c8'],['#e5484d','#ffc6c8'],['#3b82f6','#bcd7ff'],['#8b5cf6','#d9caff']];
 const ART=[
  b=>`<circle cx="32" cy="25" r="11" fill="${b}"/><path d="M11 58c2-13 11-19 21-19s19 6 21 19z" fill="${b}"/>`,
  b=>`<circle cx="32" cy="32" r="18" fill="none" stroke="${b}" stroke-width="5"/><circle cx="32" cy="32" r="7" fill="${b}"/>`,
  b=>`<circle cx="32" cy="34" r="12" fill="${b}"/>`+[0,1,2,3,4,5,6,7].map(i=>`<rect x="30.5" y="8" width="3" height="9" rx="1.5" fill="${b}" transform="rotate(${i*45} 32 34)"/>`).join(''),
  b=>`<path d="M4 38c8-10 15-10 22 0s15 10 23 0 9-5 11-3v26H4z" fill="${b}"/><circle cx="46" cy="20" r="7" fill="${b}"/>`,
  b=>`<path d="M42 10a22 22 0 1 0 12 32A17 17 0 0 1 42 10z" fill="${b}"/><circle cx="48" cy="18" r="2.5" fill="${b}"/>`,
  b=>[[13,28,18],[24,18,28],[35,32,14],[46,22,24]].map(([x,y,h])=>`<rect x="${x}" y="${y+8}" width="8" height="${h}" rx="4" fill="${b}"/>`).join(''),
  b=>`<path d="M32 10l19 33H13z" fill="${b}"/><circle cx="47" cy="48" r="6" fill="${b}" opacity=".75"/>`,
  b=>[[20,22],[44,22],[32,38],[18,50],[46,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5.5" fill="${b}"/>`).join('')
 ];
 window.AV_LIB=[1,2,3,4,5,6,7,8,9].map(n=>({id:'a'+n,src:'assets/avatars/a'+n+'.png'}));
 window.avatarSrc=av=>{ if(!av) return ''; if(av.kind==='photo') return av.data||''; if(av.kind==='lib'){ const x=window.AV_LIB.find(a=>a.id===av.id); return x?x.src:''; } return ''; };
})();
window.avDefault=(key)=>{ let h=0; String(key||'').toLowerCase().split('').forEach(c=>{ h=(h*31+c.charCodeAt(0))>>>0; }); return window.AV_LIB[h%window.AV_LIB.length].src; };
window.AVATAR=(name,cls,px)=>{ { const me=window.BRAIN&&window.BRAIN.S&&window.BRAIN.S.user; const nm=String(name||'').replace(/\(.*\)/,'').trim().toLowerCase(); if(me&&nm&&nm===String(me.name||'').toLowerCase()){ const src=me.avatar?window.avatarSrc(me.avatar):window.avDefault(me.email||me.name); if(src) return `<img class="${cls||'avimg'}" src="${src}" alt="${me.name}" title="${me.name}" width="${px||24}" height="${px||24}" style="${px?`width:${px}px;height:${px}px`:''}">`; } } const n=String(name||'').replace(/\(.*\)/,'').trim(); const k=PEOPLE[n.toLowerCase()]; const ini=n.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(); return k?`<img class="${cls||'avimg'}" src="assets/jpg/${k}.jpg" alt="${n}" title="${n}" width="${px||24}" height="${px||24}" style="${px?`width:${px}px;height:${px}px`:''}" loading="lazy">`:`<img class="${cls||'avimg'}" src="${window.avDefault(n)}" alt="${n}" title="${n}" width="${px||24}" height="${px||24}" style="${px?`width:${px}px;height:${px}px`:''}" loading="lazy">`; };
window.SRCICON=(system,px)=>`<img src="assets/svg/${{'Notion':'src-notion','Google Cloud':'src-gcloud','Confluence':'src-confluence','Google Drive':'src-drive','Internal file system':'src-filesystem','Help centre':'src-help','Slack':'src-slack'}[system]||'src-filesystem'}.svg?v=3" alt="${system}" width="${px||20}" height="${px||20}" style="border-radius:5px;flex:none">`;
window.ICON=(n,s)=>`<svg class="ic-svg" data-i="${n}" width="${s||18}" height="${s||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
})();
