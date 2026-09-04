(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]));
  const when=t=>!t?'—':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(Number(t)));
  const name=l=>`${l?.firstName||''} ${l?.lastName||''}`.trim()||l?.company||'Lead';
  const initials=l=>((l?.firstName?.[0]||'')+(l?.lastName?.[0]||'')).toUpperCase()||'K';
  const svg={
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.9z"/></svg>',
    sms:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>',
    email:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>'
  };

  function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._p15);el._p15=setTimeout(()=>el.classList.remove('show'),2800);}
  async function api(path,options={}){const r=await fetch(path,{...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}}),d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)throw new Error(d?.error||`Request failed (${r.status})`);return d;}
  function goto(view){const b=$(`[data-view="${CSS.escape(view)}"]`);if(b)b.click();}
  async function scheduleCallback(leadId){const dt=new Date(Date.now()+3600000);dt.setSeconds(0,0);const value=prompt('Callback time (local date/time)',dt.toISOString().slice(0,16));if(!value)return;const due=Date.parse(value);if(Number.isNaN(due))return toast('Invalid callback time');const reason=prompt('Callback note','Follow up')||'Follow up';try{await api(`/api/leads/${encodeURIComponent(leadId)}/callback`,{method:'POST',body:JSON.stringify({dueAt:due,reason})});toast('Callback queued');}catch(e){toast(e.message);}}
  async function queueCall(leadId){try{const d=await api(`/api/leads/${encodeURIComponent(leadId)}/call`,{method:'POST',body:'{}'});toast(`Call queued · ${(d.call?.id||'').slice(-8)}`);}catch(e){toast(e.message);}}

  /* Overview */
  function overviewPanels(){
    const hot=$('#hotLeads')?.closest('.panel'),sources=$('#sources')?.closest('.panel'),follow=$('#dueCallbacks')?.closest('.panel'),recent=$('#recentCalls')?.closest('.panel');
    hot?.classList.add('p15-hot-panel');sources?.classList.add('p15-source-panel');follow?.classList.add('p15-follow-panel');recent?.classList.add('p15-recent-panel');
  }
  function hotLeadHeat(){
    for(const row of $$('#hotLeads .mini-lead')){
      const score=Number($('.score',row)?.textContent||0);row.classList.toggle('p15-hot',score>80&&score<90);row.classList.toggle('p15-elite',score>=90);
      let fire=$('.p15-fire',row);if(score>80){if(!fire){fire=document.createElement('span');fire.className='p15-fire';$('.grow b',row)?.appendChild(fire);}fire.textContent=score>=90?' 🔥🔥':' 🔥';}else fire?.remove();
    }
  }

  /* Callback premium deck */
  function callbackActions(){
    for(const card of $$('#callbackList .callback-card')){
      let tags=$('.p15-callback-tags',card);if(!tags){tags=document.createElement('div');tags.className='p15-callback-tags';card.appendChild(tags);}
      const stage=$('.p13-callback-stage',card),status=$('.row>.status',card);if(stage&&!stage.closest('.p15-callback-tags'))tags.prepend(stage);if(status&&!status.closest('.p15-callback-tags'))tags.appendChild(status);
      if($('.p15-callback-actions',card))continue;
      const oldCall=$('.mini-actions [data-call]',card),oldDone=$('.mini-actions [data-complete-cb]',card),leadId=oldCall?.dataset.call||'';
      const deck=document.createElement('div');deck.className='p15-callback-actions';
      const button=(kind,title)=>{const b=document.createElement('button');b.type='button';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=svg[kind];return b;};
      const phone=button('phone','Call lead');phone.addEventListener('click',e=>{e.stopPropagation();oldCall?.click();});deck.appendChild(phone);
      const sms=button('sms','Text lead');sms.addEventListener('click',e=>{e.stopPropagation();goto('nurture');toast('Open Nurture to text this lead.');});deck.appendChild(sms);
      const email=button('email','Email lead');email.addEventListener('click',e=>{e.stopPropagation();goto('nurture');toast('Open Nurture to email this lead.');});deck.appendChild(email);
      const cal=button('calendar','Schedule another callback');cal.addEventListener('click',e=>{e.stopPropagation();if(leadId)scheduleCallback(leadId);});deck.appendChild(cal);
      const spacer=document.createElement('span');spacer.className='p15-callback-spacer';deck.appendChild(spacer);
      const done=document.createElement('button');done.type='button';done.className='p15-done';done.textContent='Done';done.addEventListener('click',e=>{e.stopPropagation();oldDone?.click();});deck.appendChild(done);
      card.appendChild(deck);
    }
  }

  /* Calls */
  let callRows=[],leadMap=new Map(),selectedCallId='',callsBusy=false;
  const demoTranscript={
    demo_call_1:[['EILA','Hi Noah, this is EILA with Kenji AI. I am following up on your interest in multi-location support. Do you have a minute?'],['Customer','Yes. We are looking at something that can handle multiple locations without adding more staff.'],['EILA','That fits what you submitted. I can have the team send booking options and pricing for a multi-location setup.'],['Customer','Perfect. Send me the booking link and I will grab a time.']],
    demo_call_2:[['EILA','Hi Jordan, I am following up on your solar inquiry. Is now still a good time?'],['Customer','I am tied up right now. Can you call me back after four?'],['EILA','Absolutely. I will mark the follow-up for after 4 PM.'],['Customer','Thank you.']],
    demo_call_3:[['Customer','Hi, I am calling about the maintenance plan pricing on your site.'],['EILA','I can help with that. Is this for one property or multiple locations?'],['Customer','One commercial property right now.'],['EILA','Got it. I captured that for the team so the follow-up can be specific to the commercial plan.']],
    demo_call_4:[['System','Outbound attempt placed. The contact did not answer. Retry window remains available.']]
  };
  function mergedLead(call){return leadMap.get(String(call.leadId||''))||call.lead||{};}
  function chipClass(v){const s=String(v||'').toLowerCase();if(['completed','qualified','connected','booked','won'].includes(s))return'good';if(['failed','busy','no-answer','canceled','lost'].includes(s))return'bad';return'blue';}
  function callTicket(c){const l=mergedLead(c),score=Number(l.score||c.lead?.score||0),summary=c.error||c.summary||'No call note yet.';return `<article class="p15-call-ticket ${selectedCallId===c.id?'active':''}" data-p15-call="${esc(c.id)}" tabindex="0"><div class="p15-call-top"><div class="p15-call-avatar">${esc(initials(l))}</div><div class="p15-call-person"><b>${esc(name(l))}</b><span>${esc(l.company||'Kenji lead')}</span></div><div class="p15-call-score">${esc(score||'—')}</div></div><div class="p15-call-chips"><span class="p15-call-chip ${chipClass(c.status)}">${esc(c.status||'unknown')}</span><span class="p15-call-chip blue">${esc(c.direction||'call')}</span><span class="p15-call-chip ${chipClass(c.disposition)}">${esc(c.disposition||'no disposition')}</span></div><div class="p15-call-meta"><div><label>Duration</label><span>${esc(c.durationSeconds||0)}s</span></div><div><label>Started</label><span>${esc(when(c.startedAt||c.createdAt))}</span></div><div><label>Channel</label><span>AI voice</span></div></div><div class="p15-call-note">${esc(summary)}</div><div class="p15-call-actions"><button type="button" data-p15-call-action="phone" data-lead="${esc(c.leadId)}" title="Call lead" aria-label="Call lead">${svg.phone}</button><button type="button" data-p15-call-action="sms" data-lead="${esc(c.leadId)}" title="Text lead" aria-label="Text lead">${svg.sms}</button><button type="button" data-p15-call-action="email" data-lead="${esc(c.leadId)}" title="Email lead" aria-label="Email lead">${svg.email}</button><button type="button" data-p15-call-action="calendar" data-lead="${esc(c.leadId)}" title="Schedule callback" aria-label="Schedule callback">${svg.calendar}</button></div></article>`;}
  function transcriptData(c){
    if(c?.transcript){const raw=c.transcript;if(Array.isArray(raw))return{rows:raw,demo:false};try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return{rows:parsed,demo:false};}catch{}return{rows:String(raw).split(/\n+/).filter(Boolean),demo:false};}
    if(/^demo_call_/.test(String(c?.id||''))&&demoTranscript[c.id])return{rows:demoTranscript[c.id],demo:true};
    return{rows:[],demo:false};
  }
  function turnHtml(row){
    if(Array.isArray(row)){const role=String(row[0]||'').toLowerCase(),text=row[1]||'';return `<div class="p15-turn ${/eila|agent|assistant/.test(role)?'agent':/customer|caller|user/.test(role)?'customer':'neutral'}"><b>${esc(row[0]||'Conversation')}</b>${esc(text)}</div>`;}
    if(row&&typeof row==='object'){const who=row.role||row.speaker||row.name||'Conversation',text=row.text||row.content||row.message||JSON.stringify(row);return turnHtml([who,text]);}
    const s=String(row||''),m=s.match(/^([^:]{1,24}):\s*(.*)$/);return m?turnHtml([m[1],m[2]]):`<div class="p15-turn neutral">${esc(s)}</div>`;
  }
  function renderCallDetail(c,tab='conversation'){
    const host=$('#p15CallDetail');if(!host||!c)return;const l=mergedLead(c),score=Number(l.score||c.lead?.score||0),td=transcriptData(c),summary=c.error||c.summary||'No summary stored for this call.';
    host.innerHTML=`<div class="p15-detail-head"><div class="p15-detail-avatar">${esc(initials(l))}</div><div class="p15-detail-title"><b>${esc(name(l))}</b><span>${esc(l.company||'Kenji lead')}</span></div><div class="p15-detail-score">${esc(score||'—')}</div></div><div class="p15-detail-contact"><div><label>Phone</label><span>${esc(l.phone||'—')}</span></div><div><label>Email</label><span>${esc(l.email||'—')}</span></div><div><label>Stage</label><span>${esc(l.stage||'—')}</span></div><div><label>Source</label><span>${esc(l.sourceAccount||l.source||'—')}</span></div></div><div class="p15-detail-summary"><div class="p15-call-chips"><span class="p15-call-chip ${chipClass(c.status)}">${esc(c.status||'unknown')}</span><span class="p15-call-chip blue">${esc(c.direction||'call')}</span><span class="p15-call-chip ${chipClass(c.disposition)}">${esc(c.disposition||'no disposition')}</span></div><p>${esc(summary)}</p></div><div class="p15-detail-tabs"><button class="text-btn ${tab==='conversation'?'active':''}" data-p15-detail-tab="conversation">Conversation</button><button class="text-btn ${tab==='details'?'active':''}" data-p15-detail-tab="details">Call details</button></div><div class="p15-detail-body">${tab==='conversation'?`${td.demo?'<span class="p15-demo-transcript">DEMO TRANSCRIPT</span>':''}<div class="p15-transcript">${td.rows.length?td.rows.map(turnHtml).join(''):'<div class="p15-turn neutral">No transcript is stored for this call yet.</div>'}</div>`:`<div class="p15-details-grid"><div><label>Call ID</label><span>${esc(c.id)}</span></div><div><label>Provider SID</label><span>${esc(c.providerSid||'—')}</span></div><div><label>Started</label><span>${esc(when(c.startedAt||c.createdAt))}</span></div><div><label>Ended</label><span>${esc(when(c.endedAt))}</span></div><div><label>Duration</label><span>${esc(c.durationSeconds||0)} seconds</span></div><div><label>Disposition</label><span>${esc(c.disposition||'—')}</span></div></div>`}</div>`;
    $$('[data-p15-detail-tab]',host).forEach(b=>b.addEventListener('click',()=>renderCallDetail(c,b.dataset.p15DetailTab)));
  }
  function selectCall(id){selectedCallId=id;$$('[data-p15-call]').forEach(x=>x.classList.toggle('active',x.dataset.p15Call===id));const c=callRows.find(x=>String(x.id)===String(id));if(c)renderCallDetail(c,'conversation');}
  function bindCallWorkspace(){
    $$('[data-p15-call]').forEach(card=>{card.addEventListener('click',e=>{if(e.target.closest('button'))return;selectCall(card.dataset.p15Call);});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCall(card.dataset.p15Call);}});});
    $$('[data-p15-call-action]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const leadId=b.dataset.lead,op=b.dataset.p15CallAction;if(op==='phone')queueCall(leadId);else if(op==='calendar')scheduleCallback(leadId);else{goto('nurture');toast(op==='sms'?'Open Nurture to text this lead.':'Open Nurture to email this lead.');}}));
  }
  async function premiumCalls(){
    const host=$('#callsTable');if(!host||host.querySelector('.p15-calls-layout')||callsBusy)return;callsBusy=true;
    try{const [c,l]=await Promise.all([api('/api/calls'),api('/api/leads?limit=250')]);callRows=c.calls||[];leadMap=new Map((l.leads||[]).map(x=>[String(x.id),x]));if(!callRows.length){host.innerHTML='<p class="copy">No calls yet.</p>';return;}if(!selectedCallId||!callRows.some(x=>x.id===selectedCallId))selectedCallId=callRows[0].id;host.innerHTML=`<div class="p15-calls-layout"><div class="p15-call-list">${callRows.map(callTicket).join('')}</div><aside id="p15CallDetail" class="p15-call-detail"></aside></div>`;bindCallWorkspace();selectCall(selectedCallId);}catch(e){toast(e.message);}finally{callsBusy=false;}
  }

  function boot(){
    overviewPanels();hotLeadHeat();callbackActions();
    const hot=$('#hotLeads');if(hot)new MutationObserver(()=>hotLeadHeat()).observe(hot,{childList:true,subtree:true});
    const callbacks=$('#callbackList');if(callbacks)new MutationObserver(()=>callbackActions()).observe(callbacks,{childList:true,subtree:true});
    const calls=$('#callsTable');if(calls)new MutationObserver(()=>{if(!calls.querySelector('.p15-calls-layout'))premiumCalls();}).observe(calls,{childList:true,subtree:true});
    document.addEventListener('click',e=>{const v=e.target.closest('[data-view]')?.dataset.view;if(v==='overview')setTimeout(()=>{overviewPanels();hotLeadHeat();},40);if(v==='callbacks')setTimeout(callbackActions,40);if(v==='calls')setTimeout(premiumCalls,80);});
    if($('#view-calls')?.classList.contains('active'))premiumCalls();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
