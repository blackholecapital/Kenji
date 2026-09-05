(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]));
  const when=t=>!t?'—':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(Number(t)));
  const tone=v=>String(v||'').trim().toLowerCase();
  const heat=s=>Number(s)>=90?'🔥🔥':Number(s)>=80?'🔥':'';
  const stripHeat=s=>String(s||'').replace(/[🔥\s]+$/u,'').trim();

  let leads=[],calls=[],callbacks=[],loading=null;
  let leadsById=new Map(),leadsByName=new Map(),callsById=new Map(),callbacksById=new Map(),callbacksByLead=new Map();
  let queued=false;

  function nameOf(l){return `${l?.firstName||''} ${l?.lastName||''}`.trim()||l?.company||'Lead';}
  function applyHeat(target,score){
    if(!target)return;
    const wanted=heat(score);let el=$('.p18-heat',target);
    if(!wanted){el?.remove();return;}
    if(!el){el=document.createElement('span');el.className='p18-heat';target.appendChild(el);}
    if(el.textContent!==wanted)el.textContent=wanted;
  }
  function rebuildMaps(){
    leadsById=new Map(leads.map(x=>[String(x.id),x]));
    leadsByName=new Map(leads.map(x=>[nameOf(x).toLowerCase(),x]));
    callsById=new Map(calls.map(x=>[String(x.id),x]));
    callbacksById=new Map(callbacks.map(x=>[String(x.id),x]));
    callbacksByLead=new Map();for(const row of callbacks){if(!row?.leadId)continue;const k=String(row.leadId),arr=callbacksByLead.get(k)||[];arr.push(row);callbacksByLead.set(k,arr);}
  }
  async function json(path){const r=await fetch(path,{headers:{accept:'application/json'}}),d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)throw new Error(d?.error||`Request failed (${r.status})`);return d;}
  async function refreshData(force=false){
    if(loading&&!force)return loading;
    loading=(async()=>{
      const [l,c,b]=await Promise.allSettled([json('/api/leads?limit=250'),json('/api/calls'),json('/api/callbacks')]);
      if(l.status==='fulfilled')leads=l.value.leads||[];
      if(c.status==='fulfilled')calls=c.value.calls||[];
      if(b.status==='fulfilled')callbacks=b.value.callbacks||[];
      rebuildMaps();return {leads,calls,callbacks};
    })().finally(()=>{loading=null;});
    return loading;
  }

  function fallbackLeadByName(raw){
    const key=stripHeat(raw).toLowerCase();if(leadsByName.has(key))return leadsByName.get(key);
    for(const card of $$('#leadGrid .lead-card')){
      const n=stripHeat($('.lead-top b',card)?.textContent).toLowerCase();if(n!==key)continue;
      return {id:card.querySelector('[data-stage]')?.dataset.stage||'',firstName:key,stage:card.querySelector('[data-stage]')?.value||'',score:Number($('.score-ring',card)?.textContent||0),sourceAccount:[...card.querySelectorAll('.lead-meta div')].find(x=>x.querySelector('label')?.textContent?.toLowerCase()==='account')?.querySelector('span')?.textContent||'',notes:$('.lead-notes',card)?.textContent||''};
    }
    return null;
  }

  function quietHeader(){
    const pill=$('#demoModePill');if(pill){const wanted=pill.classList.contains('live')?'OWNER':'DEMO';if(pill.textContent!==wanted)pill.textContent=wanted;}
  }

  function decorateLeadHeat(){
    for(const card of $$('#leadGrid .lead-card')){const score=Number($('.score-ring',card)?.textContent||0);applyHeat($('.lead-top b',card),score);}
  }

  function callLead(card){
    const leadId=card.querySelector('[data-p15-call-action]')?.dataset.lead||'';
    if(leadId&&leadsById.has(String(leadId)))return leadsById.get(String(leadId));
    return fallbackLeadByName($('.p15-call-person b',card)?.textContent||'');
  }
  function decorateCallCards(){
    for(const card of $$('[data-p15-call]')){
      const lead=callLead(card),score=Number(lead?.score||$('.p15-call-score',card)?.textContent||0),stage=lead?.stage||'';
      if(stage)card.dataset.stageTone=tone(stage);
      applyHeat($('.p15-call-person b',card),score);
    }
    const active=$('[data-p15-call].active'),lead=active?callLead(active):null;if(lead)applyHeat($('#p15CallDetail .p15-detail-title b'),lead.score);
  }

  function callbackRow(card){
    const id=card.querySelector('[data-complete-cb]')?.dataset.completeCb||'';if(id&&callbacksById.has(String(id)))return callbacksById.get(String(id));
    const leadId=card.querySelector('[data-call]')?.dataset.call||'';if(leadId){const rows=callbacksByLead.get(String(leadId));if(rows?.length)return rows[0];}
    const lead=fallbackLeadByName(card.querySelector('h4')?.textContent||'');return lead?{leadId:lead.id,lead}:null;
  }
  function decorateCallbacks(){
    for(const card of $$('#callbackList .callback-card')){
      const row=callbackRow(card),lead=row?.lead||leadsById.get(String(row?.leadId||''))||fallbackLeadByName(card.querySelector('h4')?.textContent||'');if(!lead)continue;
      if(lead.stage)card.dataset.stageTone=tone(lead.stage);
      let wrap=$('.p18-callback-score',card);if(!wrap){wrap=document.createElement('span');wrap.className='p18-callback-score';wrap.innerHTML='<strong></strong><span class="p18-heat"></span>';card.appendChild(wrap);}
      const strong=$('strong',wrap),score=Number(lead.score||0);if(strong.textContent!==String(score||'—'))strong.textContent=String(score||'—');const h=heat(score),flame=$('.p18-heat',wrap);if(h){if(flame.textContent!==h)flame.textContent=h;flame.style.display='inline-flex';}else flame.style.display='none';
    }
  }

  function selectedContext(){
    const card=$('[data-p15-call].active')||$('[data-p15-call]');if(!card)return null;
    const callId=String(card.dataset.p15Call||''),call=callsById.get(callId)||null,lead=callLead(card)||null,leadId=String(call?.leadId||lead?.id||card.querySelector('[data-p15-call-action]')?.dataset.lead||'');
    return {card,call,callId,lead,leadId};
  }
  function historyHtml(ctx){
    if(!ctx)return '<div class="p18-workflow-card"><p>No selected client.</p></div>';
    const rows=[];
    for(const c of calls.filter(x=>String(x.leadId||'')===ctx.leadId))rows.push({at:Number(c.startedAt||c.createdAt||0),title:`Voice call · ${c.status||'unknown'}`,detail:`${c.direction||'call'} · ${c.disposition||'no disposition'} · ${Number(c.durationSeconds||0)}s${c.summary?` · ${c.summary}`:''}`});
    for(const cb of callbacksByLead.get(ctx.leadId)||[])rows.push({at:Number(cb.dueAt||cb.createdAt||0),title:`Callback · ${cb.status||'queued'}`,detail:cb.reason||'Follow up'});
    rows.sort((a,b)=>b.at-a.at);
    return `<div class="p18-history-list">${rows.length?rows.map(x=>`<div class="p18-history-row"><time>${esc(when(x.at))}</time><div><b>${esc(x.title)}</b><span>${esc(x.detail)}</span></div></div>`).join(''):'<div class="p18-workflow-card"><p>No additional history is available for this client yet.</p></div>'}</div>`;
  }
  function workflowHtml(kind,ctx){
    const l=ctx?.lead||{},phone=l.phone||'—',email=l.email||'—',stage=l.stage||'—';
    if(kind==='sms')return `<div class="p18-workflow-card"><h4>SMS workflow</h4><p>Use Nurture so channel consent, opt-out state, sender identity and delivery events remain enforced.</p><div class="p18-workflow-meta"><div><label>Phone</label><span>${esc(phone)}</span></div><div><label>Stage</label><span>${esc(stage)}</span></div></div><div class="p18-workflow-actions"><button type="button" data-goto="nurture">Open SMS workflow</button></div></div>`;
    if(kind==='email')return `<div class="p18-workflow-card"><h4>Email workflow</h4><p>Open Nurture to send through the configured verified email identity and preserve the separate email-consent boundary.</p><div class="p18-workflow-meta"><div><label>Email</label><span>${esc(email)}</span></div><div><label>Stage</label><span>${esc(stage)}</span></div></div><div class="p18-workflow-actions"><button type="button" data-goto="nurture">Open email workflow</button></div></div>`;
    if(kind==='calendar'){
      const cb=callbacksByLead.get(ctx?.leadId||'')||[];return `<div class="p18-workflow-card"><h4>Calendar + follow-up</h4><p>Review callback obligations here or schedule another follow-up from the selected call.</p><div class="p18-history-list" style="margin-top:8px">${cb.length?cb.map(x=>`<div class="p18-history-row"><time>${esc(when(x.dueAt||x.createdAt))}</time><div><b>${esc(x.status||'queued')}</b><span>${esc(x.reason||'Follow up')}</span></div></div>`).join(''):'<div class="p18-history-row"><time>—</time><div><b>No callback queued</b><span>This client has no current callback obligation.</span></div></div>'}</div><div class="p18-workflow-actions"><button type="button" data-p18-schedule="1">Schedule callback</button><button type="button" data-goto="callbacks">Open callback queue</button></div></div>`;
    }
    if(kind==='notes')return `<div class="p18-workflow-card"><h4>Client notes</h4><div class="p18-workflow-meta"><div><label>Source</label><span>${esc(l.sourceAccount||l.source||'—')}</span></div><div><label>Stage</label><span>${esc(stage)}</span></div></div><div class="p18-note-box">${esc(l.notes||'No client notes are stored yet.')}</div><div class="p18-workflow-actions"><button type="button" data-goto="leads">Open Lead Pipeline</button></div></div>`;
    return historyHtml(ctx);
  }
  function bindWorkspaceBody(body){
    $$('[data-goto]',body).forEach(b=>b.addEventListener('click',()=>{const nav=$(`[data-view="${CSS.escape(b.dataset.goto)}"]`);nav?.click();}));
    $$('[data-p18-schedule]',body).forEach(b=>b.addEventListener('click',()=>{const active=$('[data-p15-call].active'),cal=active?.querySelector('[data-p15-call-action="calendar"]');cal?.click();}));
  }
  function renderExtraTab(kind){
    const host=$('#p15CallDetail'),body=$('.p15-detail-body',host),tabs=$$('.p15-detail-tabs button',host);if(!host||!body)return;
    tabs.forEach(b=>b.classList.toggle('active',b.dataset.p18DetailTab===kind));
    const ctx=selectedContext();body.innerHTML=workflowHtml(kind,ctx);bindWorkspaceBody(body);
  }
  function ensureDetailTabs(){
    const host=$('#p15CallDetail'),tabs=$('.p15-detail-tabs',host);if(!host||!tabs)return;
    const extras=[['history','History'],['sms','SMS'],['email','Email'],['calendar','Calendar'],['notes','Notes']];
    for(const [key,label] of extras){if($(`[data-p18-detail-tab="${key}"]`,tabs))continue;const b=document.createElement('button');b.type='button';b.className='text-btn';b.dataset.p18DetailTab=key;b.textContent=label;b.addEventListener('click',()=>renderExtraTab(key));tabs.appendChild(b);}
    const ctx=selectedContext();if(ctx?.lead)applyHeat($('.p15-detail-title b',host),ctx.lead.score);
  }

  function decorate(){quietHeader();decorateLeadHeat();decorateCallCards();decorateCallbacks();ensureDetailTabs();}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
  function observe(selector){const el=$(selector);if(el)new MutationObserver(schedule).observe(el,{childList:true,subtree:true,characterData:true});}

  function boot(){
    quietHeader();refreshData().finally(schedule);
    observe('#leadGrid');observe('#callbackList');observe('#callsTable');observe('.top-actions');
    document.addEventListener('click',e=>{const view=e.target.closest('[data-view]')?.dataset.view;if(!view)return;if(['leads','calls','callbacks'].includes(view)){setTimeout(()=>refreshData(true).finally(schedule),80);}else setTimeout(schedule,40);});
    setInterval(()=>{if(document.hidden)return;const callsView=$('#view-calls')?.classList.contains('active'),cbView=$('#view-callbacks')?.classList.contains('active');if(callsView||cbView)refreshData(true).finally(schedule);},30000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
