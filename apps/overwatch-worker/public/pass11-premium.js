(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const svg=(name)=>({
    phone:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.9z"/></svg>',
    sms:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>',
    email:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    search:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  }[name]||'');

  function toast(msg){const el=$("#toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(el._p11);el._p11=setTimeout(()=>el.classList.remove("show"),2600);}
  function goto(view){const b=$(`[data-view="${view}"]`);if(b)b.click();}

  function brand(){
    const strong=$(".brand strong"),sub=$(".brand span"),mark=$(".brand-mark.small");
    if(strong)strong.textContent="KENJI AI";if(sub)sub.textContent="AI THAT CLOSES DEALS";if(mark)mark.textContent="K";
    if(!$(".kenji-advantage")&&$(".sidebar nav")){
      const box=document.createElement("div");box.className="kenji-advantage";box.innerHTML='<b>✦ Kenji AI Advantage</b><p>Revenue-generating automation that works 24/7 to follow up, qualify leads, and close more business.</p><a href="https://kenjiai.com/" target="_blank" rel="noreferrer">KenjiAI.com →</a>';
      $(".sidebar nav").insertAdjacentElement("afterend",box);
    }
  }

  function topSearch(){
    const top=$(".topbar"),actions=$(".top-actions");if(!top||!actions||$("#kenjiTopSearch"))return;
    const wrap=document.createElement("div");wrap.id="kenjiTopSearch";wrap.className="kenji-top-search";wrap.innerHTML='<input aria-label="Search leads" placeholder="Search leads, companies, or contacts…">';
    top.insertBefore(wrap,actions);
    const input=$("input",wrap);input.addEventListener("keydown",e=>{if(e.key!=="Enter")return;const q=input.value.trim();goto("leads");setTimeout(()=>{const s=$("#leadSearch");if(s){s.value=q;s.dispatchEvent(new Event("input",{bubbles:true}));s.focus();}},80);});
    const title=$("#pageTitle");if(title&&!$("#kenjiPageSub")){const p=document.createElement("div");p.id="kenjiPageSub";p.className="kenji-page-sub";p.textContent="Your real-time hub for revenue-generating automation.";title.insertAdjacentElement("afterend",p);}
  }

  function stageChips(){
    const toolbar=$("#view-leads .toolbar");if(!toolbar||$("#p11StageChips"))return;
    const row=document.createElement("div");row.id="p11StageChips";row.style.cssText="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 12px";
    for(const stage of ["All","New","Contacted","Qualified","Nurture","Booked","Won","Lost"]){const b=document.createElement("button");b.className="ghost compact";b.textContent=stage;b.dataset.p11Stage=stage;b.addEventListener("click",()=>{const sel=$("#stageFilter");if(!sel)return;sel.value=stage==="All"?"":stage;sel.dispatchEvent(new Event("change",{bubbles:true}));$$('[data-p11-stage]').forEach(x=>x.classList.toggle("primary",x===b));});row.appendChild(b);}toolbar.insertAdjacentElement("beforebegin",row);
  }

  function decorateCard(card){
    if(card.dataset.p11Premium)return;card.dataset.p11Premium="1";
    const legacy=card.querySelector(".lead-actions"),call=legacy?.querySelector("[data-call]"),callback=legacy?.querySelector("[data-callback]"),stage=legacy?.querySelector("[data-stage]");
    if(stage){const meta=card.querySelector(".lead-meta");if(meta){const row=document.createElement("div");row.innerHTML='<label>Stage</label>';row.appendChild(stage);stage.style.cssText="justify-self:end;min-width:120px;padding:6px 8px";const old=[...meta.querySelectorAll("div")].find(x=>x.querySelector("label")?.textContent.trim()==="Stage");if(old)old.replaceWith(row);else meta.prepend(row);}}
    const actions=document.createElement("div");actions.className="premium-lead-actions";
    const make=(kind,label,cls="")=>{const b=document.createElement("button");b.type="button";b.className=cls;b.innerHTML=svg(kind);b.title=label;b.setAttribute("aria-label",label);return b;};
    const phone=make("phone","Call lead","primary-contact");phone.addEventListener("click",()=>call?.click());actions.appendChild(phone);
    const sms=make("sms","Text lead");sms.addEventListener("click",()=>{goto("nurture");toast("Open Nurture to text this lead.");});actions.appendChild(sms);
    const email=make("email","Email lead");email.addEventListener("click",()=>{goto("nurture");toast("Open Nurture to email this lead.");});actions.appendChild(email);
    const cal=make("calendar","Schedule callback");cal.addEventListener("click",()=>callback?.click());actions.appendChild(cal);
    const spacer=document.createElement("span");spacer.className="premium-spacer";actions.appendChild(spacer);
    if(stage){const label=document.createElement("span");label.className="premium-stage-label";label.textContent="Stage";actions.appendChild(label);actions.appendChild(stage);}
    legacy?.insertAdjacentElement("afterend",actions);
  }
  function decorateCards(){$$(".lead-card").forEach(decorateCard);}

  function pageTitles(){
    const map={overview:["Command Center","Your real-time hub for revenue-generating automation."],leads:["Lead Pipeline","Prioritize, contact, and convert leads faster."],calls:["Calls","Review AI voice activity and outcomes."],callbacks:["Callbacks","Keep every promised follow-up on schedule."],campaigns:["Campaigns","Launch controlled outbound calling from qualified lead groups."],integrations:["Integrations","Connect lead sources, HighLevel, and API intake."],agency:["Agency Ops","See connected accounts, bookings, and follow-up health."],isla:["EILA Overwatch","Ask your AI operator what needs attention now."],demo:["Live Demo","Verify the live voice and receptionist experience."],nurture:["Nurture","Coordinate compliant SMS and email follow-up."],scale:["Scale Lab","Control throughput and model capacity safely."],launch:["Launch","Confirm platform and go-live readiness."],setup:["Owner Setup","Connect the last real-world pieces without touching secrets."]};
    document.addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;const m=map[b.dataset.view];if(!m)return;setTimeout(()=>{if($("#pageTitle"))$("#pageTitle").textContent=m[0];if($("#kenjiPageSub"))$("#kenjiPageSub").textContent=m[1];},0);});
  }

  function boot(){brand();topSearch();stageChips();decorateCards();pageTitles();
    const grid=$("#leadGrid");if(grid)new MutationObserver(()=>decorateCards()).observe(grid,{childList:true,subtree:true});
    new MutationObserver(()=>{brand();topSearch();stageChips();decorateCards();}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
