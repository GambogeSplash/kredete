// Mock data for the Support agent and the embeddable widget only (sandbox spec 4.4); every
// other surface reads the API. Names and numbers are invented.
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
window.DOCS.crypto={id:'crypto',title:'Crypto Custody Policy',system:'Confluence',owner:'Priya Nair',ownerRole:'Compliance owner',verified:'1 Nov 2026',authority:'Approved policy',domain:'Compliance',text:()=>`Kredete does not hold customer crypto. Staff may not accept crypto from partners.`};
window.DOCS.escalate={id:'escalate',title:'Support escalation guide',system:'Google Drive',owner:'Daniel Reyes',ownerRole:'Support content owner',verified:'9 Sep 2026',authority:'Approved guide',domain:'Payments',text:()=>`Escalate chargebacks over <mark>$2,000</mark> to the Payments lead within one working day.`};
window.DOCS.pricing={id:'pricing',title:'Partner Pricing 2026',system:'Google Drive',owner:'Leo Marsh',ownerRole:'Security',verified:'20 Oct 2026',authority:'Restricted',domain:'Compliance',text:()=>`Partner rates and volume tiers for 2026. Sharing: anyone in Kredete can open this.`};
window.DOCS.public_fee={id:'public_fee',title:'Card fees (public help article)',system:'Help centre',owner:'Amara Okafor',ownerRole:'Cards domain owner',verified:'2 Feb 2026',authority:'Public article',domain:'Cards',value:'free',text:(v)=>`The first replacement card is <mark>${v}</mark>.`};
window.DOCS.brand={id:'brand',title:'Brand and UI guidelines',system:'Google Drive',owner:'Zainab Bello',ownerRole:'Design lead',verified:'22 Oct 2026',authority:'Approved guide',domain:'Brand',text:()=>`Kredete purple is <mark>#5A0FC8</mark>. Body text is set at 16px or larger, and every screen is checked at 390px.`};
window.DOCS.dsystem={id:'dsystem',title:'Design system: components',system:'Confluence',owner:'Zainab Bello',ownerRole:'Design lead',verified:'3 Nov 2026',authority:'Approved guide',domain:'Brand',text:()=>`Use the shared button, field and table components. A new look ships as a named variant, never as one-off CSS.`};
window.DOCS.apilimits={id:'apilimits',title:'API rate limits and errors',system:'Confluence',owner:'Kofi Mensah',ownerRole:'Engineering lead',verified:'28 Oct 2026',authority:'Approved policy',domain:'Platform',text:()=>`The public API allows <mark>600 requests per minute</mark> per key. Above that it returns 429 with a Retry-After header.`};
window.DOCS.incident={id:'incident',title:'Incident response runbook',system:'Google Drive',owner:'Kofi Mensah',ownerRole:'Engineering lead',verified:'11 Aug 2026',authority:'Approved, past review date',domain:'Platform',text:()=>`Page the on-call engineer within <mark>10 minutes</mark> of a Sev 1. Post status updates every 30 minutes until resolved.`};

/* Access levels the Support agent shows for each source. */
window.LEVELS=['General','Internal','Confidential','Restricted'];
window.LEVEL_COL=['#26a269','#3b82f6','#e2a600','#e5484d'];
Object.entries({public_fee:0,fee_schedule:0,cards_faq:0,brand:0,dsystem:0,limits:1,escalate:1,rates:1,apilimits:1,crypto:1,limits2:2,incident:2,pricing:3}).forEach(([k,v])=>{ if(window.DOCS[k]) window.DOCS[k].level=v; });
