(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const AVATAR='/assets/EILA-small-chat.jpg';
  const LOGO='/assets/kenji-logo.webp';

  function setImage(img,src,alt){
    if(!img)return;
    if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    if(img.getAttribute('alt')!==alt)img.setAttribute('alt',alt);
  }

  function applySidebarBrand(){
    const brand=$('.sidebar .brand');if(!brand)return;
    brand.classList.add('p18-sidebar-brand');
    let lock=$('.p18-kenji-lockup',brand);
    if(!lock){
      lock=document.createElement('div');
      lock.className='p18-kenji-lockup';
      lock.innerHTML='<img class="p18-kenji-logo" alt="Kenji"><span>AI CALL CENTER</span>';
      brand.replaceChildren(lock);
    }
    setImage($('.p18-kenji-logo',lock),LOGO,'Kenji');
  }

  function applySupportBrand(){
    setImage($('#kenjiSupportPill img'),AVATAR,'EILA support');
    setImage($('#kenjiSupportPanel .kenji-support-head img'),AVATAR,'EILA support');
  }

  function applyOverwatchBrand(){
    const orb=$('.isla-orb');if(!orb)return;
    orb.classList.add('p17-eila-portrait');
    let img=$('img',orb);
    if(!img){img=document.createElement('img');orb.replaceChildren(img);}
    setImage(img,AVATAR,'EILA');
  }

  function apply(){applySidebarBrand();applySupportBrand();applyOverwatchBrand();}

  function boot(){
    apply();
    let queued=false;
    const observer=new MutationObserver(records=>{
      if(queued)return;
      let relevant=false;
      for(const record of records){if(record.type==='childList'&&record.addedNodes.length){relevant=true;break;}if(record.type==='characterData'){relevant=true;break;}}
      if(!relevant)return;
      queued=true;requestAnimationFrame(()=>{queued=false;apply();});
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
