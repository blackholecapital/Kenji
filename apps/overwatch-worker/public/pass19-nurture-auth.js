(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const LOGO='/assets/kenji-logo.webp', EILA='/assets/EILA-small-chat.jpg';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]));
  const heat=s=>Number(s)>=90?'🔥🔥':Number(s)>=80?'🔥':'';
  const nameOf=l=>`${l?.firstName||''} ${l?.lastName||''}`.trim()||l?.company||'Lead';
  const ago=t=>{if(!t)return'never';const m=Math.floor((Date.now()-Number(t))/60000);if(m<1)return'just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`;};
  let nurtureLeads=[],loading=null;

  function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._p19);el._p19=setTimeout(()=>el.classList.remove('show'),2800);}
  async function json(path){const r=await fetch(path,{headers:{accept:'application/json'}}),d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)throw new Error(d?.error||`Request failed (${r.status})`);return d;}

  function sidebarBrand(){
    const brand=$('.sidebar .brand');if(!brand)return;brand.classList.add('p19-sidebar-brand');
    const mark=$('.brand-mark.small',brand);if(mark){mark.classList.add('p19-kenji-logo');let img=$('img',mark);if(!img){img=document.createElement('img');mark.replaceChildren(img);}if(img.getAttribute('src')!==LOGO)img.src=LOGO;img.alt='Kenji';}
    const strong=$('strong',brand),sub=$('span',brand);if(strong)strong.textContent='';if(sub&&sub.textContent!=='AI CALL CENTER')sub.textContent='AI CALL CENTER';
  }

  function authBrand(){
    const card=$('#authShell .auth-card');if(!card)return;card.classList.add('p19-auth-card');
    const mark=$('.brand-mark',card);if(mark&&!mark.classList.contains('p19-auth-logo')){mark.classList.add('p19-auth-logo');mark.innerHTML=`<img src="${LOGO}" alt="Kenji">`;}
    $('.eyebrow',card)?.classList.add('p19-auth-hide');$('h1',card)?.classList.add('p19-auth-hide');$('.auth-copy',card)?.classList.add('p19-auth-hide');$('#authHint')?.classList.add('p19-auth-hide');
    if(!$('#p19AuthLabel')){const label=document.createElement('div');label.id='p19AuthLabel';label.className='p19-auth-label';label.textContent='BLACK HOLE AI CALL CENTER';mark?.insertAdjacentElement('afterend',label);}
    const submit=$('#authSubmit');if(submit&&submit.textContent!=='Enter AI Call Center')submit.textContent='Enter AI Call Center';
    const name=$('#authName');if(name){name.placeholder='Name';name.setAttribute('autocomplete','name');}
    if(!$('#p19AuthFooter')){const footer=document.createElement('div');footer.id='p19AuthFooter';footer.className='p19-auth-footer';footer.innerHTML=`<img src="${EILA}" alt="EILA"><div><span>Powered by</span><b>EILA OS</b></div>`;$('#authError')?.insertAdjacentElement('afterend',footer);}
  }

  function ensureNurtureDesk(){
    const view=$('#view-nurture');if(!view)return null;let desk=$('#p19NurtureDesk');if(desk)return desk;
    desk=document.createElement('article');desk.id='p19NurtureDesk';desk.className='panel p19-nurture-desk';desk.innerHTML=`<div class="panel-head"><div><p class="eyebrow">NURTURE CUSTOMERS</p><h3>Keep viable leads warm</h3></div><span class="badge">long-term follow-up</span></div><p class="copy p19-nurture-explain">Nurture is for a lead that still has value but is not ready to buy now. Keep the relationship alive with consented SMS/email follow-up instead of treating them like a fresh sales call every day.</p><div id="p19NurtureCustomers" class="p19-nurture-customers"><p class="copy">Loading nurture customers…</p></div>`;
    const status=$('#p6Status');status?.insertAdjacentElement('afterend',desk);return desk;
  }

  function leadCard(l){
    const score=Number(l.score||0),flame=heat(score),initials=((l.firstName?.[0]||'')+(l.lastName?.[0]||'')).toUpperCase()||'K';
    return `<article class="p19-nurture-card" data-lead="${esc(l.id)}"><div class="p19-nurture-top"><div class="p19-nurture-avatar">${esc(initials)}</div><div class="p19-nurture-person"><b>${esc(nameOf(l))}${flame?` <span class="p19-heat">${flame}</span>`:''}</b><span>${esc(l.company||'Kenji lead')}</span></div><div class="p19-nurture-score">${esc(score||'—')}</div></div><div class="p19-nurture-meta"><div><label>Stage</label><span>${esc(l.stage||'Nurture')}</span></div><div><label>Source</label><span>${esc(l.source||'—')}</span></div><div><label>Account</label><span>${esc(l.sourceAccount||'—')}</span></div><div><label>Last contact</label><span>${esc(ago(l.lastContactedAt))}</span></div></div><p class="p19-nurture-note">${esc(l.notes||'No nurture context stored yet.')}</p><div class="p19-nurture-actions"><button type="button" class="text-btn" data-p19-open="${esc(l.id)}">Open lead</button><button type="button" class="text-btn" data-p19-sequence="${esc(l.id)}">Use in sequence</button><button type="button" class="text-btn" data-p19-consent="${esc(l.id)}">Consent</button></div></article>`;
  }

  function renderNurtureDesk(){
    ensureNurtureDesk();const host=$('#p19NurtureCustomers');if(!host)return;
    host.innerHTML=nurtureLeads.length?nurtureLeads.map(leadCard).join(''):'<div class="p19-nurture-empty"><b>No leads are currently in Nurture.</b><span>When a Pipeline record moves to Nurture, it will appear here automatically for long-term follow-up planning.</span></div>';
    $$('[data-p19-open]',host).forEach(b=>b.addEventListener('click',()=>openLead(b.dataset.p19Open)));
    $$('[data-p19-sequence]',host).forEach(b=>b.addEventListener('click',()=>useSequence(b.dataset.p19Sequence)));
    $$('[data-p19-consent]',host).forEach(b=>b.addEventListener('click',()=>focusConsent(b.dataset.p19Consent)));
  }

  async function loadNurture(force=false){
    if(loading&&!force)return loading;ensureNurtureDesk();
    loading=(async()=>{try{let d=await json('/api/leads?stage=Nurture&limit=100'),rows=d.leads||[];if(!rows.length){d=await json('/api/leads?limit=250');rows=(d.leads||[]).filter(x=>String(x.stage||'').toLowerCase()==='nurture');}nurtureLeads=rows;renderNurtureDesk();}catch(e){const host=$('#p19NurtureCustomers');if(host)host.innerHTML=`<div class="p19-nurture-empty"><b>Nurture customers unavailable.</b><span>${esc(e.message)}</span></div>`;}})().finally(()=>{loading=null;});return loading;
  }

  function byId(id){return nurtureLeads.find(x=>String(x.id)===String(id));}
  function openLead(id){const l=byId(id),nav=$('[data-view="leads"]');nav?.click();setTimeout(()=>{const st=$('#stageFilter'),q=$('#leadSearch');if(st){st.value='Nurture';st.dispatchEvent(new Event('change',{bubbles:true}));}if(q&&l){q.value=nameOf(l);q.dispatchEvent(new Event('input',{bubbles:true}));q.focus();}},100);}
  function useSequence(id){const l=byId(id);if(!l)return;const name=$('#p6Name'),source=$('#p6Source'),account=$('#p6Account'),stage=$('#p6Stage');if(name&&!name.value.trim())name.value=`Nurture · ${l.company||nameOf(l)}`;if(source&&!source.value.trim())source.value=l.source||'';if(account&&!account.value.trim())account.value=l.sourceAccount||'';if(stage)stage.value='Nurture';$('#p6Name')?.scrollIntoView({behavior:'smooth',block:'center'});toast('Sequence Builder preloaded for this nurture segment.');}
  function focusConsent(id){const row=$(`[data-consent-sms="${CSS.escape(String(id))}"]`)?.closest('.p6-consent')||$(`[data-consent-email="${CSS.escape(String(id))}"]`)?.closest('.p6-consent');if(row){row.classList.add('p19-consent-focus');row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>row.classList.remove('p19-consent-focus'),1800);}else{document.querySelector('#p6Consents')?.scrollIntoView({behavior:'smooth',block:'center'});toast('No explicit SMS/email consent record is set for this nurture lead yet.');}}

  function tidyCallbacks(){
    for(const card of $$('#callbackList .callback-card')){
      if(card.dataset.p19Callback==='1')continue;card.dataset.p19Callback='1';
      const score=$('.p18-callback-score',card),strong=$('strong',score),h4=$('h4',card),stage=$('.p13-callback-stage',card)?.textContent?.trim()||card.dataset.stageTone||'—',status=$('.p15-callback-tags .status',card)?.textContent?.trim()||'queued',due=$('.time',card)?.textContent?.replace(/^DUE\s*·?\s*/i,'').trim()||'—';
      const n=Number(strong?.textContent||0),flame=heat(n);if(h4&&flame&&!$('.p19-heat',h4)){const f=document.createElement('span');f.className='p19-heat';f.textContent=flame;h4.appendChild(f);}if(score)$('.p18-heat',score)?.remove();
      if(!$('.p19-callback-meta',card)){const meta=document.createElement('div');meta.className='p19-callback-meta';meta.innerHTML=`<div><label>Due</label><span>${esc(due)}</span></div><div><label>Stage</label><span>${esc(stage)}</span></div><div><label>Queue</label><span>${esc(status)}</span></div>`;const p=$('p',card);p?.insertAdjacentElement('afterend',meta);}
    }
  }

  function boot(){sidebarBrand();authBrand();ensureNurtureDesk();tidyCallbacks();
    document.addEventListener('click',e=>{const view=e.target.closest('[data-view]')?.dataset.view;setTimeout(()=>{sidebarBrand();authBrand();if(view==='nurture')loadNurture(true);if(view==='callbacks')tidyCallbacks();},80);});
    $('#demoLoginBtn')?.addEventListener('click',()=>setTimeout(authBrand,30));
    const cb=$('#callbackList');if(cb){let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;tidyCallbacks();});}).observe(cb,{childList:true});}
    if($('#view-nurture')?.classList.contains('active'))loadNurture();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
