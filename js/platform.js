(function (global) {
  'use strict';
  const STORE_KEY = 'orbisvPlatformV1';
  const MAX_NOTES = 200, MAX_TEXT = 120000, MAX_FILE = 16 * 1024 * 1024;
  const {areas: AREAS, labs: LABS} = global.OrbisCatalog;
  const DATA_LABELS={expression:'Expressão',xMin:'Domínio inicial',xMax:'Domínio final',xExpr:'x(t)',yExpr:'y(t)',zExpr:'z(t)',tMin:'t inicial',tMax:'t final',x1:'x₁',y1:'y₁',z1:'z₁',x2:'x₂',y2:'y₂',z2:'z₂',x0:'x₀',y0:'y₀',z0:'z₀',cx:'Centro x',cy:'Centro y',r:'Raio',vertices:'Vértices',method:'Método',axis:'Eixo',view:'Visualização',outerExpr:'Raio externo',innerExpr:'Raio interno',volume:'Volume aproximado',maxOuter:'Raio externo máximo',maxInner:'Raio interno máximo'};
  const DATA_VALUES={washers:'Anéis',disks:'Discos',pointVector:'Ponto e vetor diretor',twoPoints:'Dois pontos','3d':'3D','2d':'2D'};
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now = () => new Date().toISOString();
  const uid = () => global.crypto?.randomUUID?.() || `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR') : '';
  const state = {page:'home',areaId:null,loadedLabId:null,lastLabId:null,noteId:null,status:'',statusKind:''};
  const scenes = new Map();
  let runtime, defaults, store = {format:'orbisv-platform',version:1,notes:[],labs:{}}, saveTimer, routeBusy=false;

  function cleanDrafts(raw) {
    const result = clone(defaults);
    if (!raw || typeof raw !== 'object') return result;
    for (const mode of Object.keys(result)) {
      if (!raw[mode] || typeof raw[mode] !== 'object') continue;
      for (const key of Object.keys(result[mode])) {
        const v = raw[mode][key];
        if (key === 'vertices') {
          if (Array.isArray(v) && v.length >= 3 && v.length <= 2000 && v.every(p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number' && Number.isFinite(n)))) result[mode][key] = clone(v);
        } else if (typeof v === 'string' || typeof v === 'number') result[mode][key] = String(v).slice(0, 2048);
      }
    }
    if (!['point','line','circle','ellipse','polygon'].includes(result.geometry.type)) result.geometry.type='point';
    return result;
  }
  function cleanView(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const v = {};
    for (const key of ['scale','scaleX','scaleY','offsetX','offsetY']) if (Number.isFinite(raw[key])) v[key]=raw[key];
    for (const key of ['equalScale','showGrid','showMinorGrid','showAxes','showLabels','showCoordinates','showPointValues']) if (typeof raw[key]==='boolean') v[key]=raw[key];
    if (['2d','3d'].includes(raw.viewMode)) v.viewMode=raw.viewMode;
    if (raw.camera3d && typeof raw.camera3d==='object') {
      v.camera3d={target:{}};
      for (const key of ['yaw','pitch','distance','fov']) if (Number.isFinite(raw.camera3d[key])) v.camera3d[key]=raw.camera3d[key];
      for (const key of ['x','y','z']) if (Number.isFinite(raw.camera3d.target?.[key])) v.camera3d.target[key]=raw.camera3d.target[key];
    }
    return v;
  }
  function cleanSnapshot(raw) {
    if (raw == null) return null;
    if(raw.kind==='calculation')return global.OrbisWorkbench.validateSnapshot(raw);
    if (!raw || typeof raw!=='object' || !Array.isArray(raw.objects)) throw new Error('Registro de cena inválido no Caderno.');
    runtime.objects.validateProject({format:'orbisv-project',version:2,scene:{objects:raw.objects}});
    return {kind:'scene',labId:LABS[raw.labId]?raw.labId:'fund-funcoes',labTitle:String(raw.labTitle||'Laboratório').slice(0,140),mode:Object.hasOwn(defaults,raw.mode)?raw.mode:'function',savedAt:Number.isFinite(Date.parse(raw.savedAt))?raw.savedAt:now(),objects:raw.objects.map((o,i)=>runtime.objects.sanitizeObject(o,i)),view:cleanView(raw.view),projectName:String(raw.projectName||'Cena do Caderno').slice(0,140)};
  }
  function cleanNote(raw) {
    if (!raw || typeof raw!=='object' || typeof raw.title!=='string' || typeof raw.text!=='string') throw new Error('O arquivo contém uma anotação inválida.');
    if (raw.title.length>140 || raw.text.length>MAX_TEXT) throw new Error('Uma anotação ultrapassa o tamanho permitido.');
    return {id:typeof raw.id==='string'?raw.id.slice(0,100):uid(),title:raw.title,text:raw.text,createdAt:Number.isFinite(Date.parse(raw.createdAt))?raw.createdAt:now(),updatedAt:Number.isFinite(Date.parse(raw.updatedAt))?raw.updatedAt:now(),labId:LABS[raw.labId]?raw.labId:'',snapshot:cleanSnapshot(raw.snapshot)};
  }
  function validateNotebook(raw) {
    if (!raw || raw.format!=='orbisv-platform' || raw.version!==1 || !Array.isArray(raw.notes)) throw new Error('Selecione um Caderno OrbisV válido, na versão 1.');
    if (raw.notes.length>MAX_NOTES) throw new Error(`O Caderno aceita até ${MAX_NOTES} anotações.`);
    const ids=new Set();
    return raw.notes.map(cleanNote).map(note=>{if(!note.id || ids.has(note.id))note.id=uid();ids.add(note.id);return note;});
  }
  function loadStore() {
    try {
      const raw=JSON.parse(localStorage.getItem(STORE_KEY)||'null');
      if (!raw) return;
      const notes=validateNotebook(raw), labs={};
      for (const id of Object.keys(LABS)) {
        if(LABS[id].kind==='workbench')continue;
        const saved=raw.labs?.[id];
        if (!saved || typeof saved!=='object') continue;
        labs[id]={mode:Object.hasOwn(defaults,saved.mode)?saved.mode:LABS[id].mode,drafts:cleanDrafts(saved.drafts),view:cleanView(saved.view),projectName:String(saved.projectName||LABS[id].title).slice(0,140),savedAt:String(saved.savedAt||now())};
      }
      store={format:'orbisv-platform',version:1,notes,labs};
      state.noteId=notes.some(n=>n.id===raw.activeNoteId)?raw.activeNoteId:notes[0]?.id||null;
    } catch {
      state.status='Não foi possível ler o Caderno salvo. O conteúdo anterior foi preservado para recuperação.';state.statusKind='error';
      try {const raw=localStorage.getItem(STORE_KEY);if(raw)localStorage.setItem('orbisvPlatformRecoveryV1',raw);} catch {}
    }
  }
  function status(text,kind='') {
    state.status=text;state.statusKind=kind;
    const node=$('platformStatus');if(node){node.textContent=text;node.className=`platform-status ${kind}`;}
  }
  function persist(immediate=false) {
    clearTimeout(saveTimer);
    const write=()=>{
      saveTimer=null;
      try {
        localStorage.setItem(STORE_KEY,JSON.stringify({...store,activeNoteId:state.noteId,updatedAt:now()}));
        status('Salvo neste dispositivo.','ok');return true;
      } catch {status('Sem espaço para salvar. Exporte o Caderno para conservar suas anotações.','error');return false;}
    };
    if(immediate)return write();
    status('Salvando…');saveTimer=setTimeout(write,250);
  }
  function saveLab() {
    const id=state.loadedLabId;if(!id)return;
    const {objects,AppUI:ui,engine}=runtime;
    scenes.set(id,objects.serialize());
    store.labs[id]={mode:ui.activeMode,drafts:clone(ui.drafts),view:engine.getView(),projectName:ui.currentProjectName,savedAt:now()};
    objects.save();persist();
  }
  function nativeChanged() {if(state.loadedLabId && state.page==='lab') saveLab();}
  function resetEditor() {
    const {AppUI:ui,engine}=runtime;
    ui.closeAllModals();ui.closeObjectMenu();ui.closeManual();if(ui.tourState)ui.endTour(true);
    ui.editingId=null;ui.editingColor=null;ui.selectedIds.clear();ui.selectionMode=false;
    engine.selectedId=null;engine.inspectMode=false;engine.inspectX=null;engine.pointer=null;
    engine.clearNotablePoints();engine.hidePointTooltip();engine.invalidateCache();
    ui.$.inspectCard.hidden=true;ui.$.selectionBadge.hidden=true;
    const inspect=$('inspectBtn');inspect.classList.remove('active');inspect.setAttribute('aria-pressed','false');
  }
  function openLab(id) {
    const lab=LABS[id];if(!lab)return;
    if(lab.kind==='workbench'){openWorkbench(id);return;}
    const {objects,AppUI:ui,engine}=runtime;
    if(state.loadedLabId)saveLab();
    const same=state.loadedLabId===id,saved=store.labs[id];
    state.page='lab';state.areaId=lab.areaId;state.lastLabId=id;
    document.body.classList.add('platform-editor-open');$('platformLabBar').hidden=false;
    $('platformLabArea').textContent=lab.areaTitle;$('platformLabTitle').textContent=lab.title;
    $('platformSkip').href='#graphCanvas';
    if (!same) {
      resetEditor();objects.setStorageNamespace(id);
      objects.restore([],false);objects.undoStack=[];objects.redoStack=[];objects.events=[];
      if(scenes.has(id))objects.loadPayload(scenes.get(id));else objects.load();
      ui.drafts=cleanDrafts(saved?.drafts);
      if(!saved && lab.draft)Object.assign(ui.drafts[lab.mode],clone(lab.draft));
      ui.currentProjectName=saved?.projectName||lab.title;
      state.loadedLabId=id;
      ui.setMode(saved?.mode||lab.mode,false);
      engine.resize();
      if(saved?.view)engine.setView(saved.view);else {engine.center();engine.resetCamera3D();}
      ui.syncViewControls();ui.renderAll();ui.syncProjectHome();
    }
    ui.updateResponsiveState();engine.resize();engine.requestRender();
    requestAnimationFrame(()=>{engine.resize();engine.canvas.focus({preventScroll:true});});
  }

  function openWorkbench(id) {
    saveLab();global.OrbisWorkbench.close();
    const lab=LABS[id];state.page='bench';state.areaId=lab.areaId;state.lastLabId=id;
    runtime.AppUI.closeAllModals();runtime.AppUI.closeObjectMenu();runtime.AppUI.closeManual();
    if(runtime.AppUI.tourState)runtime.AppUI.endTour(true);
    document.body.classList.remove('platform-editor-open');$('platformLabBar').hidden=true;$('platformSkip').href='#platformContent';
    renderMenu();global.OrbisWorkbench.mount(id,$('platformContent'));
    $('platformHub').scrollTop=0;$('platformContent').focus({preventScroll:true});
  }

  function routeHref(page, id) {
    if(page==='lab')return `#laboratorio/${id}`;
    if(page==='catalog')return id?`#area/${id}`:'#simuladores';
    return page==='notebook'?'#caderno':'#inicio';
  }
  function navigate(page,id) {
    const target=routeHref(page,id);
    if(location.hash===target)applyRoute();else location.hash=target;
  }
  function applyRoute() {
    if(routeBusy)return;routeBusy=true;
    try {
      global.OrbisWorkbench.close();
      const path=location.hash.slice(1).split('/');
      if(path[0]==='laboratorio' && LABS[path[1]]) {openLab(path[1]);return;}
      if(state.page==='lab')saveLab();
      runtime.AppUI.closeAllModals();runtime.AppUI.closeObjectMenu();runtime.AppUI.closeManual();
      if(runtime.AppUI.tourState)runtime.AppUI.endTour(true);
      document.body.classList.remove('platform-editor-open');$('platformLabBar').hidden=true;$('platformSkip').href='#platformContent';
      state.page=path[0]==='caderno'?'notebook':['simuladores','area'].includes(path[0])?'catalog':'home';
      state.areaId=path[0]==='area' && AREAS.some(a=>a.id===path[1])?path[1]:null;
      render();$('platformHub').scrollTop=0;$('platformContent').focus({preventScroll:true});
    } finally {routeBusy=false;}
  }
  function renderMenu() {
    $('platformMenu').innerHTML=AREAS.map(area=>`<div class="platform-menu-group${state.areaId===area.id?' open':''}"><button type="button" class="platform-menu-area" data-platform-area="${area.id}" ${state.areaId===area.id?'aria-current="page"':''}><span>${esc(area.short)}</span><small>${area.labs.length} práticas</small></button><div class="platform-menu-labs">${area.labs.map(lab=>`<button type="button" class="platform-menu-lab" data-platform-lab="${lab.id}">${esc(lab.title)}</button>`).join('')}</div></div>`).join('');
    document.querySelectorAll('.platform-nav [data-platform-page]').forEach(btn=>{if(btn.dataset.platformPage===state.page)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
  }
  function labCard(lab) {
    return `<button class="platform-lab-card" type="button" data-platform-lab="${lab.id}"><span class="platform-lab-icon" aria-hidden="true">${esc(lab.icon)}</span><span class="platform-lab-copy"><strong>${esc(lab.title)}</strong><span>${esc(lab.summary)}</span><small>${esc(lab.focus)} <span aria-hidden="true">›</span></small></span></button>`;
  }
  function areaCard(area) {
    return `<button class="platform-card platform-area-card" type="button" data-platform-area="${area.id}"><span class="platform-card-tag">CONTEÚDO</span><span class="platform-area-symbol" aria-hidden="true">${esc(area.symbol)}</span><strong>${esc(area.title)}</strong><span class="platform-area-description">${esc(area.description)}</span><span class="platform-card-footer"><span>${area.labs.length} laboratórios</span><span class="platform-card-arrow" aria-hidden="true">›</span></span></button>`;
  }
  function breadcrumb(label) {return `<div class="platform-breadcrumb"><button type="button" data-platform-page="home">Início</button><span aria-hidden="true">/</span><span>${esc(label)}</span></div>`;}
  function renderHome() {
    return `<section class="platform-hero"><div><span class="platform-kicker">LABORATÓRIO DE MATEMÁTICA</span><h1>Matemática em <em>qualquer dimensão.</em></h1><p>Um espaço para o professor demonstrar, o aluno experimentar e todos registrarem suas descobertas.</p><div class="platform-actions"><button class="platform-primary" type="button" data-platform-page="catalog">Explorar simuladores</button><button class="platform-secondary" type="button" data-platform-page="notebook">Abrir Caderno</button></div></div><aside class="platform-signal"><img class="platform-signal-brand" src="assets/orbisv-logo-official.png" alt="OrbisV — Visualize · Explore · Descubra"><div><strong>Explore. Compare. Registre.</strong><span>Funções, construções e cenas em duas ou três dimensões.</span></div></aside></section><div class="platform-section-head"><div><h2>Escolha seu conteúdo</h2><p>Acesse as áreas livremente, conforme a sua atividade.</p></div></div><div class="platform-cards">${AREAS.map(areaCard).join('')}</div>`;
  }
  function renderCatalog() {
    const area=AREAS.find(a=>a.id===state.areaId);
    if(!area)return `${breadcrumb('Simuladores')}<section class="platform-catalog-head"><div><span class="platform-kicker">CATÁLOGO · ${Object.keys(LABS).length} LABORATÓRIOS</span><h1>Simuladores</h1><p>Selecione o conteúdo que deseja trabalhar.</p></div></section><div class="platform-cards">${AREAS.map(areaCard).join('')}</div>`;
    const groups=[...new Set(area.labs.map(l=>l.group))];
    return `${breadcrumb('Simuladores')}<section class="platform-catalog-head"><div><span class="platform-kicker">${area.labs.length} LABORATÓRIOS</span><h1>${esc(area.title)}</h1><p>${esc(area.description)}</p></div><button class="platform-secondary" type="button" data-platform-page="catalog">Todas as áreas</button></section><div class="platform-catalog-tools"><label>Buscar ferramenta<input type="search" id="platformLabSearch" placeholder="Digite um assunto ou uma operação"></label><label>Grupo de conteúdos<select id="platformGroupFilter"><option value="">Todos os conteúdos</option>${groups.map(group=>`<option value="${esc(group)}">${esc(group)}</option>`).join('')}</select></label></div><p id="platformSearchCount" class="wb-method" role="status">${area.labs.length} laboratórios disponíveis.</p>${groups.map(group=>`<section class="platform-content-group" data-catalog-group="${esc(group)}"><h2>${esc(group)} <small>${area.labs.filter(l=>l.group===group).length} ferramentas</small></h2><div class="platform-catalog-grid">${area.labs.filter(l=>l.group===group).map(labCard).join('')}</div></section>`).join('')}`;
  }
  function filterCatalog() {
    const input=$('platformLabSearch');if(!input)return;
    const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const q=norm(input.value),group=$('platformGroupFilter').value;let count=0;
    document.querySelectorAll('[data-catalog-group]').forEach(section=>{
      let visible=0;section.querySelectorAll('[data-platform-lab]').forEach(card=>{
        const ok=(!group||section.dataset.catalogGroup===group)&&norm(card.textContent).includes(q);
        card.hidden=!ok;if(ok){visible++;count++;}
      });section.hidden=!visible;
    });$('platformSearchCount').textContent=count?`${count} laboratório(s) encontrado(s).`:'Nenhum laboratório corresponde à busca.';
  }
  const currentNote=()=>store.notes.find(n=>n.id===state.noteId)||null;
  function notesList() {
    return store.notes.length?store.notes.map(n=>`<button type="button" class="platform-note-item${n.id===state.noteId?' active':''}" data-note-id="${esc(n.id)}" aria-pressed="${n.id===state.noteId}"><strong>${esc(n.title||'Anotação sem título')}</strong><small>${esc(date(n.updatedAt))}${n.snapshot?n.snapshot.kind==='calculation'?' · experimento registrado':' · cena registrada':''}</small></button>`).join(''):'<p class="platform-note-empty">Crie sua primeira anotação ou registre uma cena no laboratório.</p>';
  }
  function snapshotHtml(note) {
    const s=note.snapshot;if(!s)return '';
    if(s.kind==='calculation')return global.OrbisWorkbench.snapshotHtml(s);
    return `<section class="platform-snapshot"><strong>Cena registrada · ${esc(s.labTitle)}</strong><span>${s.objects.length} objeto(s) · ${esc(date(s.savedAt))}</span><details><summary>Consultar dados da cena</summary>${s.objects.length?s.objects.map(o=>`<div class="platform-snapshot-object"><strong>${esc(runtime.AppUI.objectLabel(o))}</strong><dl>${Object.entries(o.data).map(([key,value])=>`<div><dt>${esc(DATA_LABELS[key]||key)}</dt><dd>${esc(typeof value==='object'?JSON.stringify(value):(Object.hasOwn(DATA_VALUES,value)?DATA_VALUES[value]:value))}</dd></div>`).join('')}</dl></div>`).join(''):'<p>Cena vazia.</p>'}</details><div class="platform-actions"><button class="platform-secondary" data-note-restore type="button">Reabrir cena</button><button class="platform-secondary" data-note-project type="button">Exportar cena</button></div></section>`;
  }
  function renderNotebook() {
    if(!currentNote())state.noteId=store.notes[0]?.id||null;
    const note=currentNote();
    return `${breadcrumb('Caderno')}<section class="platform-notebook-head"><div><span class="platform-kicker">ANOTAÇÕES E REGISTROS</span><h1>Caderno</h1><p>Seu espaço para cálculos, hipóteses e observações.</p></div><div class="platform-notebook-actions">${state.lastLabId?`<button class="platform-secondary" type="button" data-platform-lab="${state.lastLabId}">Voltar ao laboratório</button>`:''}<button class="platform-secondary" type="button" data-note-import>Importar</button><button class="platform-secondary" type="button" data-note-export>Exportar</button><button class="platform-primary" type="button" data-note-new>Nova anotação</button></div></section><p id="platformStatus" class="platform-status ${state.statusKind}" role="status" aria-live="polite">${esc(state.status||'As anotações são salvas neste dispositivo.')}</p><div class="platform-notebook-grid"><section class="platform-note-list" aria-label="Lista de anotações"><div class="platform-note-list-head"><strong>Anotações</strong><span>${store.notes.length} de ${MAX_NOTES}</span></div><div class="platform-note-items">${notesList()}</div></section><section class="platform-note-editor" aria-label="Editor de anotação">${note?`<label for="platformNoteTitle">Título</label><input id="platformNoteTitle" class="platform-note-title" data-note-field="title" value="${esc(note.title)}" maxlength="140" placeholder="Anotação sem título"><label for="platformNoteText">Anotações</label><textarea id="platformNoteText" class="platform-note-text" data-note-field="text" maxlength="${MAX_TEXT}" placeholder="Escreva seus cálculos, observações e próximos passos…">${esc(note.text)}</textarea>${snapshotHtml(note)}<div class="platform-note-meta"><span>Atualização: ${esc(date(note.updatedAt))}</span><div class="platform-note-actions"><button class="platform-secondary" type="button" data-note-delete>Excluir</button><button class="platform-primary" type="button" data-note-save>Salvar</button></div></div>`:'<p class="platform-note-empty">Selecione uma anotação ou use “Nova anotação” para começar.</p>'}</section></div>`;
  }
  function render() {
    renderMenu();$('platformContent').innerHTML=state.page==='catalog'?renderCatalog():state.page==='notebook'?renderNotebook():renderHome();
  }
  function createNote(snapshot=null) {
    if(store.notes.length>=MAX_NOTES){runtime.AppUI.showToast(`Limite de ${MAX_NOTES} anotações. Exporte e organize o Caderno para criar outra.`,true);return null;}
    const note={id:uid(),title:snapshot?snapshot.labTitle:'',text:'',createdAt:now(),updatedAt:now(),labId:snapshot?.labId||'',snapshot};
    store.notes.unshift(note);state.noteId=note.id;persist(true);return note;
  }
  function recordScene() {
    if(state.page!=='lab' || !state.loadedLabId)return;
    const lab=LABS[state.loadedLabId];
    const snapshot=cleanSnapshot({labId:lab.id,labTitle:lab.title,mode:runtime.AppUI.activeMode,savedAt:now(),objects:runtime.objects.items,view:runtime.engine.getView(),projectName:runtime.AppUI.currentProjectName});
    if(createNote(snapshot)){saveLab();navigate('notebook');}
  }
  function notebookProject(note=currentNote()) {
    const s=note?.snapshot;if(!s)throw new Error('A anotação não contém uma cena.');
    return {format:'orbisv-project',version:2,appVersion:'8.0.0',name:s.projectName||note.title,savedAt:s.savedAt,scene:{objects:clone(s.objects),view:clone(s.view)},ui:{mode:s.mode}};
  }
  async function restoreScene() {
    const note=currentNote();if(!note?.snapshot)return;
    if(note.snapshot.kind==='calculation'){global.OrbisWorkbench.restore(note.snapshot);return;}
    const project=notebookProject(note);runtime.objects.validateProject(project);
    const ok=await runtime.AppUI.confirm('A cena registrada será aberta no laboratório de origem. Você poderá desfazer essa abertura pelo botão Desfazer.','Reabrir cena do Caderno?');
    if(!ok)return;
    openLab(note.snapshot.labId);runtime.objects.importProject(project);
    runtime.AppUI.currentProjectName=project.name;runtime.AppUI.setMode(project.ui.mode,false);
    if(project.scene.view)runtime.engine.setView(project.scene.view);
    runtime.AppUI.renderAll();runtime.AppUI.syncProjectHome();saveLab();persist(true);
    history.replaceState(null,'',routeHref('lab',note.snapshot.labId));
  }
  async function deleteNote() {
    const note=currentNote();if(!note)return;
    const ok=await runtime.AppUI.confirm(`Excluir “${note.title||'Anotação sem título'}” e o registro de cena associado?`,'Excluir anotação?');
    if(!ok)return;
    store.notes=store.notes.filter(n=>n.id!==note.id);state.noteId=store.notes[0]?.id||null;persist(true);render();
  }
  function download(value,filename) {runtime.AppUI.download(JSON.stringify(value,null,2),'application/json',filename);}
  function exportNotebook() {
    persist(true);download({format:'orbisv-platform',version:1,exportedAt:now(),notes:clone(store.notes)},'OrbisV-Caderno.json');
  }
  async function importNotebook(file) {
    if(!file)return;
    try {
      if(file.size>MAX_FILE)throw new Error('O arquivo excede 16 MB.');
      const incoming=validateNotebook(JSON.parse(await file.text()));
      const existing=new Map(store.notes.map(n=>[n.id,n]));const additions=[];
      for(const note of incoming){const old=existing.get(note.id);if(old && JSON.stringify(old)===JSON.stringify(note))continue;if(old)note.id=uid();existing.set(note.id,note);additions.push(note);}
      if(store.notes.length+additions.length>MAX_NOTES)throw new Error(`A importação ultrapassaria o limite de ${MAX_NOTES} anotações. Nenhuma anotação foi alterada.`);
      store.notes.unshift(...additions);state.noteId=additions[0]?.id||state.noteId;
      const saved=persist(true);render();if(saved)status(`${additions.length} anotação(ões) adicionada(s). Seus registros anteriores foram mantidos.`,'ok');
    } catch(error){status(error instanceof SyntaxError?'O arquivo não contém JSON válido.':error.message,'error');}
    finally{$('platformNotebookImport').value='';}
  }
  function handleClick(event) {
    const target=event.target.closest('button,a');if(!target)return;
    if(target.matches('[data-platform-page],[data-platform-home],[data-platform-area],[data-platform-lab],[data-platform-back]'))event.preventDefault();
    if(target.hasAttribute('data-platform-a11y')){runtime.AppUI.syncA11yControls();runtime.AppUI.openModal('a11ySheet');return;}
    if(target.dataset.platformLab){navigate('lab',target.dataset.platformLab);return;}
    if(target.dataset.platformArea){navigate('catalog',target.dataset.platformArea);return;}
    if(target.dataset.platformPage){navigate(target.dataset.platformPage);return;}
    if(target.hasAttribute('data-platform-back')){navigate('catalog',LABS[state.loadedLabId]?.areaId);return;}
    if(target.hasAttribute('data-platform-home')){navigate('home');return;}
    if(target.hasAttribute('data-platform-record')){recordScene();return;}
    if(target.dataset.noteId){state.noteId=target.dataset.noteId;persist(true);render();return;}
    if(target.hasAttribute('data-note-new')){if(createNote()){render();$('platformNoteTitle').focus();}return;}
    if(target.hasAttribute('data-note-save')){persist(true);render();return;}
    if(target.hasAttribute('data-note-delete')){deleteNote();return;}
    if(target.hasAttribute('data-note-restore')){restoreScene().catch(e=>runtime.AppUI.showToast(e.message,true));return;}
    if(target.hasAttribute('data-note-project')){download(notebookProject(),'OrbisV-Cena.orbisv');return;}
    if(target.hasAttribute('data-note-export')){exportNotebook();return;}
    if(target.hasAttribute('data-note-import')){$('platformNotebookImport').click();}
  }
  function init() {
    runtime=global.OrbisVRuntime;defaults=clone(runtime.AppUI.drafts);loadStore();
    // Preserve an existing unscoped session in the first laboratory on upgrade.
    if(runtime.objects.items.length){
      const legacy=new GraphObjects();legacy.setStorageNamespace('fund-funcoes');
      if(!legacy.load()){legacy.loadPayload(runtime.objects.serialize());legacy.save();scenes.set('fund-funcoes',legacy.serialize());store.labs['fund-funcoes']={mode:runtime.AppUI.activeMode,drafts:clone(defaults),view:runtime.engine.getView(),projectName:runtime.AppUI.currentProjectName};}
    }
    const input=document.createElement('input');input.id='platformNotebookImport';input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.appendChild(input);
    input.addEventListener('change',()=>importNotebook(input.files?.[0]));
    $('platformHub').addEventListener('click',handleClick);$('platformLabBar').addEventListener('click',handleClick);
    $('platformHub').addEventListener('input',event=>{
      if(event.target.id==='platformLabSearch'||event.target.id==='platformGroupFilter'){filterCatalog();return;}
      const field=event.target.dataset.noteField,note=currentNote();if(!note || !['title','text'].includes(field))return;
      note[field]=event.target.value.slice(0,field==='title'?140:MAX_TEXT);note.updatedAt=now();persist();
      const list=document.querySelector('.platform-note-items');if(list)list.innerHTML=notesList();
    });
    global.addEventListener('hashchange',applyRoute);
    const barObserver=new ResizeObserver(()=>{document.documentElement.style.setProperty('--platform-bar-height',`${$('platformLabBar').offsetHeight||58}px`);if(state.page==='lab')runtime.engine.resize();});
    barObserver.observe($('platformLabBar'));
    const flush=()=>{saveLab();persist(true);};
    global.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
    global.OrbisPlatform={recordCalculation:(raw,text='')=>{try{const snapshot=cleanSnapshot(raw);const note=createNote(snapshot);if(note){note.text=text;persist(true);navigate('notebook');}}catch(e){runtime.AppUI.showToast(e.message,true);}},nativeChanged,openLab:id=>navigate('lab',id),navigate,recordSnapshot:recordScene,data:()=>clone(store)};
    applyRoute();
  }
  if(global.OrbisVRuntime?.ready)init();else global.addEventListener('orbisv:ready',init,{once:true});
})(window);
