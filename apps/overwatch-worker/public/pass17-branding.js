(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const AVATAR='/assets/EILA-small-chat.jpg';

  function setImage(img,alt='EILA'){
    if(!img)return;
    if(img.getAttribute('src')!==AVATAR)img.setAttribute('src',AVATAR);
    if(img.getAttribute('alt')!==alt)img.setAttribute('alt',alt);
  }

  function applySidebarBrand(){
    const brand=$('.sidebar .brand');if(!brand)return;
    const mark=$('.brand-mark.small',brand);
    if(mark){
      mark.classList.add('p17-brand-portrait');
      let img=$('img',mark);
      if(!img){img=document.createElement('img');mark.replaceChildren(img);}
      setImage(img,'EILA');
    }
    const strong=$('strong',brand),sub=$('span',brand);
    if(strong&&strong.textContent!=='KENJI')strong.textContent='KENJI';
    if(sub&&sub.textContent!=='AI CALL CENTER')sub.textContent='AI CALL CENTER';
  }

  function applySupportBrand(){
    setImage($('#kenjiSupportPill img'),'EILA support');
    setImage($('#kenjiSupportPanel .kenji-support-head img'),'EILA support');
  }

  function applyOverwatchBrand(){
    const orb=$('.isla-orb');if(!orb)return;
    orb.classList.add('p17-eila-portrait');
    let img=$('img',orb);
    if(!img){img=document.createElement('img');orb.replaceChildren(img);}
    setImage(img,'EILA');
  }

  function apply(){
    applySidebarBrand();
    applySupportBrand();
    applyOverwatchBrand();
  }

  function boot(){
    apply();
    let queued=false;
    const observer=new MutationObserver(records=>{
      let relevant=false;
      for(const record of records){
        if(record.type==='childList'&&record.addedNodes.length){relevant=true;break;}
        if(record.type==='characterData'){relevant=true;break;}
      }
      if(!relevant||queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;apply();});
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
