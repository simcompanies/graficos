(function(){
  'use strict';
  const root=document.documentElement;
  const search=document.getElementById('manualSearch');
  const status=document.getElementById('searchStatus');
  const sidebar=document.querySelector('.manual-sidebar');
  const mobileIndex=document.getElementById('mobileIndexBtn');
  const toast=document.getElementById('manualToast');
  let toastTimer=null;
  const embedded=new URLSearchParams(location.search).get('embed')==='1'||window.parent!==window;
  if(embedded)root.classList.add('embedded');

  function loadTheme(){
    let theme='dark';
    try{const p=JSON.parse(localStorage.getItem('orbisvA11yV1')||'{}');if(p.theme==='light')theme='light';}catch{}
    root.dataset.theme=theme;
  }
  function toggleTheme(){root.dataset.theme=root.dataset.theme==='light'?'dark':'light';}
  function showToast(text){clearTimeout(toastTimer);toast.textContent=text;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);}

  function openInOrbisV(action){
    try{
      if(embedded&&window.parent&&window.parent!==window&&window.parent.OrbisManualBridge){
        window.parent.OrbisManualBridge.handle(action);
        showToast(innerWidth<=760?'Recurso aberto no OrbisV. O manual foi recolhido.':'Recurso aberto no OrbisV ao lado do manual.');
        return;
      }
      if(window.opener && !window.opener.closed && window.opener.OrbisManualBridge){
        window.opener.OrbisManualBridge.handle(action);
        window.opener.OrbisManualBridge.focus?.();
        showToast('O OrbisV foi posicionado no recurso correspondente.');
        return;
      }
    }catch{}
    const routes={home:'inicio',catalog:'simuladores',notebook:'caderno'};
    location.href='../index.html#'+(String(action).startsWith('platform:')?(routes[action.split(':')[1]]||'inicio'):'inicio');
  }

  document.addEventListener('click',(e)=>{
    const b=e.target.closest('[data-open-orbisv]');
    if(b){e.preventDefault();openInOrbisV(b.dataset.openOrbisv);}
  });
  document.getElementById('themeBtn')?.addEventListener('click',toggleTheme);
  document.getElementById('printBtn')?.addEventListener('click',()=>window.print());

  const sections=[...document.querySelectorAll('.searchable')];
  function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function runSearch(){
    const q=normalize(search.value.trim());let matches=0;
    sections.forEach(section=>{
      section.classList.remove('search-match');
      if(!q){section.classList.remove('search-hidden');return;}
      const hay=normalize((section.dataset.title||'')+' '+section.textContent);
      const ok=hay.includes(q);section.classList.toggle('search-hidden',!ok);if(ok){matches+=1;section.classList.add('search-match');}
    });
    status.textContent=q?`${matches} seção(ões) encontrada(s)`:'';
  }
  search?.addEventListener('input',runSearch);
  search?.addEventListener('search',runSearch);

  const links=[...document.querySelectorAll('#manualNav a')];
  const observed=[...document.querySelectorAll('.manual-section[id],.manual-hero[id]')];
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible)return;
    links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${visible.target.id}`));
  },{rootMargin:'-15% 0px -70% 0px',threshold:[0,.15,.35]});
  observed.forEach(s=>observer.observe(s));

  mobileIndex?.addEventListener('click',()=>{const open=sidebar.classList.toggle('mobile-open');mobileIndex.setAttribute('aria-expanded',String(open));});
  sidebar?.addEventListener('click',(e)=>{if(e.target.closest('a')&&innerWidth<=760){sidebar.classList.remove('mobile-open');mobileIndex?.setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&sidebar?.classList.contains('mobile-open')){sidebar.classList.remove('mobile-open');mobileIndex?.setAttribute('aria-expanded','false');}});

  loadTheme();
})();
