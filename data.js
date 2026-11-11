// Mock data. Names and numbers are invented for the prototype.
window.DOCS = {
  fee_schedule: {id:'fee_schedule', title:'Fee Schedule 2026', system:'Confluence', owner:'Amara Okafor', ownerRole:'Cards domain owner',
    verified:'12 Oct 2026', authority:'Approved policy', domain:'Cards',
    text:(v)=>`Card replacement fee: <mark>$${v}</mark> per card. Waived once per year for lost cards reported within 24 hours.`, value:'5.00'},
  cards_faq: {id:'cards_faq', title:'Cards FAQ (internal)', system:'Google Drive', owner:'Daniel Reyes', ownerRole:'Support content owner',
    verified:'3 Mar 2025', authority:'FAQ, not approved', domain:'Cards',
    text:(v)=>`A replacement card costs <mark>$${v}</mark>. Delivery takes 5 to 7 working days.`, value:'7.50'},
  limits: {id:'limits', title:'Transfer Limits Policy', system:'Confluence', owner:'Priya Nair', ownerRole:'Payments domain owner',
    verified:'30 Sep 2026', authority:'Approved policy', domain:'Payments',
    text:()=>`Standard accounts can send up to <mark>$5,000</mark> per day. Limits rise after identity verification.`},
  limits2: {id:'limits2', title:'Payments Handbook', system:'Internal file system', owner:'Priya Nair', ownerRole:'Payments domain owner',
    verified:'18 Aug 2026', authority:'Approved handbook', domain:'Payments',
    text:()=>`Verified business accounts can send up to <mark>$25,000</mark> per day.`},
  rates: {id:'rates', title:'Savings Rate Sheet', system:'Google Drive', owner:'Tomas Berg', ownerRole:'Savings domain owner',
    verified:'14 Jan 2025', authority:'Approved, past review date', domain:'Savings',
    text:()=>`Flexible Saver pays <mark>3.2%</mark> annual interest, effective January 2025.`}
};
window.DOCS.crypto={id:'crypto',title:'Crypto Custody Policy',system:'Confluence',owner:'Priya Nair',ownerRole:'Compliance owner',verified:'1 Nov 2026',authority:'Approved policy',domain:'Compliance',text:()=>`Broth does not hold customer crypto. Staff may not accept crypto from partners.`};
window.DOCS.escalate={id:'escalate',title:'Support escalation guide',system:'Google Drive',owner:'Daniel Reyes',ownerRole:'Support content owner',verified:'9 Sep 2026',authority:'Approved guide',domain:'Payments',text:()=>`Escalate chargebacks over <mark>$2,000</mark> to the Payments lead within one working day.`};
window.DOCS.pricing={id:'pricing',title:'Partner Pricing 2026',system:'Google Drive',owner:'Leo Marsh',ownerRole:'Security',verified:'20 Oct 2026',authority:'Restricted',domain:'Compliance',text:()=>`Partner rates and volume tiers for 2026. Sharing: anyone in Broth can open this.`};
window.DOCS.public_fee={id:'public_fee',title:'Card fees (public help article)',system:'Help centre',owner:'Amara Okafor',ownerRole:'Cards domain owner',verified:'2 Feb 2026',authority:'Public article',domain:'Cards',value:'free',text:(v)=>`The first replacement card is <mark>${v}</mark>.`};
window.SEED_ITEMS = [
  {id:'i1', type:'staleness', title:'Savings Rate Sheet is past its review date', domain:'Savings', impact:41, owner:'Tomas Berg', status:'open', age:'6 days',
    doc:'rates', note:'Last verified 14 Jan 2025. 41 questions cited it this month.'},
  {id:'i2', type:'gap', title:'Crypto custody: 9 questions with no source', domain:'Compliance', impact:9, owner:'Priya Nair', status:'open', age:'3 days',
    questions:['Do we hold customer crypto?','What is the policy on crypto custody?','Can staff accept crypto from partners?'], note:'Asked by staff over 3 weeks. No document answers it.'},
  {id:'i3', type:'approval', title:'Approve "Credit building basics" for the support bot', domain:'Credit', impact:0, owner:'Amara Okafor', status:'open', age:'1 day',
    preview:'Paying on time each month is the biggest factor in building a credit history. This article is general information, not personal advice.', note:'Requested by Support. Approving makes it visible to customers.'}
];

window.SEED_ITEMS.push(
  {id:'i4', type:'exposure', title:'Restricted pricing sheet is shared with the whole company', domain:'Compliance', impact:0, owner:'Leo Marsh (Security)', status:'open', age:'2 days', doc:'pricing',
    preview:'Partner Pricing 2026 is marked restricted but shared with "Anyone in Broth".', note:'Routed to Security. The brain narrowed access already, the source still needs fixing.'},
  {id:'i5', type:'drift', title:'Public fee FAQ no longer matches the Fee Schedule', domain:'Cards', impact:12, owner:'Amara Okafor', status:'open', age:'4 days', doc:'public_fee',
    preview:'The public help article still says the first replacement card is free. The internal policy changed on 12 Oct.', note:'Routed to the domain owner and the Support lead.'}
);

/* Org teams. A team owns sources and items; domain (Cards, Payments...) is the topic. */
window.DOC_TEAM={fee_schedule:'Product',limits:'Product',rates:'Product',cards_faq:'Support',escalate:'Support',public_fee:'Support',crypto:'Compliance',pricing:'Compliance',limits2:'Compliance'};
window.OWNER_TEAM={'Amara Okafor':'Product','Tomas Berg':'Product','Daniel Reyes':'Support','Priya Nair':'Compliance','Leo Marsh':'Compliance','Zainab Bello':'Design','Kofi Mensah':'Engineering'};
window.DOCS.brand={id:'brand',title:'Brand and UI guidelines',system:'Google Drive',owner:'Zainab Bello',ownerRole:'Design lead',verified:'22 Oct 2026',authority:'Approved guide',domain:'Brand',text:()=>`Broth purple is <mark>#5A0FC8</mark>. Body text is set at 16px or larger, and every screen is checked at 390px.`};
window.DOCS.dsystem={id:'dsystem',title:'Design system: components',system:'Confluence',owner:'Zainab Bello',ownerRole:'Design lead',verified:'3 Nov 2026',authority:'Approved guide',domain:'Brand',text:()=>`Use the shared button, field and table components. A new look ships as a named variant, never as one-off CSS.`};
window.DOCS.apilimits={id:'apilimits',title:'API rate limits and errors',system:'Confluence',owner:'Kofi Mensah',ownerRole:'Engineering lead',verified:'28 Oct 2026',authority:'Approved policy',domain:'Platform',text:()=>`The public API allows <mark>600 requests per minute</mark> per key. Above that it returns 429 with a Retry-After header.`};
window.DOCS.incident={id:'incident',title:'Incident response runbook',system:'Google Drive',owner:'Kofi Mensah',ownerRole:'Engineering lead',verified:'11 Aug 2026',authority:'Approved, past review date',domain:'Platform',text:()=>`Page the on-call engineer within <mark>10 minutes</mark> of a Sev 1. Post status updates every 30 minutes until resolved.`};
Object.assign(window.DOC_TEAM,{brand:'Design',dsystem:'Design',apilimits:'Engineering',incident:'Engineering'});

/* Who can open each source. No acl = everyone at Broth. */
window.DOCS.pricing.acl=['Compliance']; window.DOCS.limits2.acl=['Compliance','Product','Finance']; window.DOCS.incident.acl=['Engineering'];

/* Company directory. Work email resolves to a profile, the way an identity provider would. Invented for the prototype. */
window.DIRECTORY={
 'aisha.bello@kredete.example':{name:'Aisha Bello',title:'Support Operations Lead',team:'Support',location:'Lagos',manager:'Daniel Reyes',roles:['employee','owner','admin']},
 'daniel.reyes@kredete.example':{name:'Daniel Reyes',title:'Head of Support Content',team:'Support',location:'Lagos',manager:'Amara Okafor',roles:['employee','owner']},
 'amara.okafor@kredete.example':{name:'Amara Okafor',title:'Product Lead, Cards',team:'Product',location:'Lagos',manager:'Priya Nair',roles:['employee','owner','domain']},
 'priya.nair@kredete.example':{name:'Priya Nair',title:'Head of Compliance',team:'Compliance',location:'London',manager:'Leo Marsh',roles:['employee','owner','domain','compliance']},
 'zainab.bello@kredete.example':{name:'Zainab Bello',title:'Design Lead',team:'Design',location:'Lagos',manager:'Amara Okafor',roles:['employee','owner']},
 'kofi.mensah@kredete.example':{name:'Kofi Mensah',title:'Engineering Lead',team:'Engineering',location:'Accra',manager:'Priya Nair',roles:['employee','owner','dev']},
 'sam.idowu@kredete.example':{name:'Sam Idowu',title:'Customer Support Agent',team:'Support',location:'Lagos',manager:'Daniel Reyes',roles:['employee']}
};

/* Access levels. A person opens a source when their level is at or above the source's level, or their team is named on it, or the owner granted it. */
window.LEVELS=['General','Internal','Confidential','Restricted'];
window.LEVEL_COL=['#26a269','#3b82f6','#e2a600','#e5484d'];
Object.entries({public_fee:0,fee_schedule:0,cards_faq:0,brand:0,dsystem:0,limits:1,escalate:1,rates:1,apilimits:1,crypto:1,limits2:2,incident:2,pricing:3}).forEach(([k,v])=>{ if(window.DOCS[k]) window.DOCS[k].level=v; });
Object.entries({'aisha.bello':2,'daniel.reyes':1,'amara.okafor':2,'priya.nair':3,'zainab.bello':1,'kofi.mensah':2,'sam.idowu':1}).forEach(([k,v])=>{ const d=window.DIRECTORY[k+'@kredete.example']; if(d) d.level=v; });

/* Library content: what the connected apps hold. Mock titles and dates. Level and team decide who can open each. */
(()=>{ const O={daniel:['Daniel Reyes','Support content owner'],kofi:['Kofi Mensah','Engineering lead'],zainab:['Zainab Bello','Design lead'],priya:['Priya Nair','Compliance owner'],amara:['Amara Okafor','Product lead'],leo:['Leo Marsh','Security'],tomas:['Tomas Berg','Savings domain owner']};
 const ROWS=[
 ['onboarding','Onboarding checklist','Confluence','daniel','12 Oct 2026',0,'Support','Operations','Approved guide','Support / Onboarding','Page',null],
 ['handbook_eng','Engineering handbook','Confluence','kofi','28 Oct 2026',1,'Engineering','Platform','Approved guide','Engineering / Handbook','Page',null],
 ['arch','Architecture overview','Confluence','kofi','5 Oct 2026',1,'Engineering','Platform','Approved guide','Engineering / Architecture','Page',null],
 ['secstd','Security standards','Confluence','kofi','19 Oct 2026',2,'Engineering','Platform','Approved policy','Engineering / Security','Page',['Engineering','Compliance']],
 ['kyc','KYC and onboarding procedure','Confluence','priya','30 Sep 2026',2,'Compliance','Compliance','Approved policy','Compliance / Procedures','Page',null],
 ['release','Release process','Confluence','kofi','2 Nov 2026',1,'Engineering','Platform','Approved guide','Engineering / Delivery','Page',null],
 ['voice','Brand voice guide','Confluence','zainab','22 Oct 2026',0,'Design','Brand','Approved guide','Design / Brand','Page',null],
 ['roadmap','Product roadmap 2027','Confluence','amara','1 Nov 2026',2,'Product','Cards','Approved, past review date','Product / Planning','Page',['Product']],
 ['board_q3','Q3 board pack','Google Drive','leo','4 Oct 2026',3,'Compliance','Compliance','Restricted','Leadership / Board','Slides',null],
 ['macros','Support macros','Google Drive','daniel','31 Oct 2026',1,'Support','Operations','Approved guide','Support / Macros','Doc',null],
 ['price27','Pricing sheet 2027 draft','Google Drive','amara','3 Nov 2026',2,'Product','Cards','Draft','Product / Pricing','Sheet',['Product','Compliance']],
 ['dreview','Design review notes','Google Drive','zainab','29 Oct 2026',1,'Design','Brand','Approved guide','Design / Reviews','Doc',null],
 ['postmortem','Incident postmortems','Google Drive','kofi','15 Oct 2026',2,'Engineering','Platform','Approved guide','Engineering / Incidents','Doc',['Engineering']],
 ['research','Customer research summary','Google Drive','amara','24 Oct 2026',1,'Product','Cards','Approved guide','Product / Research','Doc',null],
 ['contract','Partner contract template','Google Drive','priya','9 Sep 2026',3,'Compliance','Compliance','Restricted','Legal / Templates','Doc',null],
 ['wiki','Team wiki','Notion','daniel','6 Nov 2026',0,'Support','Operations','Approved guide','Wiki','Page',null],
 ['pnotes','Meeting notes: product sync','Notion','amara','5 Nov 2026',1,'Product','Cards','Notes','Product / Meetings','Page',null],
 ['dsroad','Design system roadmap','Notion','zainab','3 Nov 2026',1,'Design','Brand','Approved guide','Design / Roadmap','Page',null],
 ['rfcs','Engineering RFCs','Notion','kofi','1 Nov 2026',1,'Engineering','Platform','Approved guide','Engineering / RFCs','Database',null],
 ['hiring','Hiring plan','Notion','leo','28 Oct 2026',3,'Compliance','Compliance','Restricted','People / Hiring','Page',null],
 ['okrs','OKRs 2027','Notion','amara','30 Oct 2026',1,'Product','Cards','Approved guide','Company / OKRs','Page',null],
 ['playbook','Support playbook','Notion','daniel','4 Nov 2026',1,'Support','Operations','Approved guide','Support / Playbook','Page',null],
 ['training','Compliance training','Notion','priya','20 Oct 2026',0,'Compliance','Compliance','Approved guide','Compliance / Training','Page',null]];
 ROWS.forEach(r=>{ const [id,title,system,o,verified,level,team,domain,authority,path,kind,acl]=r; const ow=O[o];
  const d={id,title,system,owner:ow[0],ownerRole:ow[1],verified,authority,domain,level,path,kind,text:()=>`${title} lives in ${system}${path?', '+path:''}. Owned by ${ow[0]}.`}; if(acl) d.acl=acl; window.DOCS[id]=d; window.DOC_TEAM[id]=team; });
 /* existing sources: give them a path and kind so the Library shows them */
 const X={fee_schedule:['Cards / Fees','Page'],limits:['Payments / Limits','Page'],rates:['Savings / Rates','Sheet'],crypto:['Compliance / Policies','Page'],apilimits:['Engineering / API','Page'],dsystem:['Design / System','Page'],cards_faq:['Support / FAQ','Doc'],escalate:['Support / Escalation','Doc'],brand:['Design / Brand','Doc'],incident:['Engineering / Runbooks','Doc'],pricing:['Partnerships / Pricing','Sheet']};
 Object.entries(X).forEach(([k,v])=>{ if(window.DOCS[k]){ window.DOCS[k].path=v[0]; window.DOCS[k].kind=v[1]; } });
})();
