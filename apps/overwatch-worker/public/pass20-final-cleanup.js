(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const EILA='/assets/EILA-small-chat.jpg', LOGO='/assets/kenji-logo.webp';
  let queued=false;

  function authPolish(){
    const card=$('#authShell .auth-card');if(!card)return;
    card.classList.add('p20-auth-card');
    const logo=$('.p19-auth-logo',card);if(logo){logo.classList.add('p20-auth-logo');const img=$('img',logo);if(img&&img.getAttribute('src')!==LOGO)img.src=LOGO;}
    let eila=$('#p20AuthEila',card);
    if(!eila){eila=document.createElement('div');eila.id='p20AuthEila';eila.className='p20-auth-eila';eila.innerHTML=`<img src="${EILA}" alt="EILA OS">`;card.prepend(eila);}
    const label=$('#p19AuthLabel',card);if(label){label.classList.add('p20-auth-label');label.textContent='BLACK HOLE AI CALL CENTER';}
    const footer=$('#p19AuthFooter',card);if(footer&&!footer.dataset.p20){footer.dataset.p20='1';footer.classList.add('p20-auth-footer');footer.innerHTML='<span>Powered by <b>EILA OS</b></span>';}
  }

  function sidebarPolish(){
    const lock=$('.sidebar .p18-kenji-lockup');if(!lock)return;
    lock.classList.add('p20-sidebar-lockup');
    const img=$('img',lock),sub=$('span',lock);if(img&&img.getAttribute('src')!==LOGO)img.src=LOGO;if(sub&&sub.textContent!=='AI CALL CENTER')sub.textContent='AI CALL CENTER';
  }

  function cleanupLegacyChrome(){
    $('#p12KenjiBrand')?.remove();
    sidebarPolish();
  }

  function nurtureLayout(){
    const view=$('#view-nurture'),status=$('#p6Status'),desk=$('#p19NurtureDesk');if(!view||!status||!desk)return;
    view.classList.add('p20-nurture-layout');
    let workspace=$('#p20NurtureWorkspace');
    if(!workspace){
      workspace=document.createElement('div');workspace.id='p20NurtureWorkspace';workspace.className='p20-nurture-workspace';workspace.innerHTML='<div id="p20NurtureControls" class="p20-nurture-controls"></div><aside id="p20NurtureRail" class="p20-nurture-rail"></aside>';
      status.insertAdjacentElement('afterend',workspace);
    }
    const controls=$('#p20NurtureControls'),rail=$('#p20NurtureRail');
    for(const grid of [...view.children].filter(x=>x.classList?.contains('p6-grid'))){for(const child of [...grid.children])controls.appendChild(child);grid.remove();}
    if(desk.parentElement!==rail)rail.appendChild(desk);
  }

  function normalizeCallNames(){
    for(const name of $$('.p15-call-person b,.p15-detail-title b')){name.classList.add('p20-call-name');const flame=$('.p18-heat',name);if(flame)flame.classList.add('p20-call-heat');}
  }

  function callDetailTone(){
    const active=$('[data-p15-call].active'),detail=$('#p15CallDetail');if(!detail)return;
    detail.classList.add('p20-premium-detail');
    const tone=active?.dataset.stageTone||'';
    if(tone)detail.dataset.stageTone=tone;else detail.removeAttribute('data-stage-tone');
    normalizeCallNames();
  }

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;cleanupLegacyChrome();authPolish();nurtureLayout();callDetailTone();});}

  function boot(){
    cleanupLegacyChrome();authPolish();nurtureLayout();callDetailTone();
    document.addEventListener('click',e=>{
      const view=e.target.closest('[data-view]')?.dataset.view;
      if(view==='nurture')setTimeout(nurtureLayout,80);
      if(view==='calls'||e.target.closest('[data-p15-call]'))setTimeout(callDetailTone,0);
      if(e.target.closest('#demoLoginBtn'))setTimeout(authPolish,30);
    });
    const calls=$('#callsTable');if(calls)new MutationObserver(schedule).observe(calls,{childList:true,subtree:true});
    const auth=$('#authShell');if(auth)new MutationObserver(()=>requestAnimationFrame(authPolish)).observe(auth,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
