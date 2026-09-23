(function (global) {
  'use strict';

  const STORAGE_CURRENT = 'orbisvSessionV1';
  const STORAGE_PREVIOUS = 'orbisvSessionPreviousV1';
  const STORAGE_RECOVERY = 'orbisvSessionRecoveryV1';
  const LEGACY_KEY = 'graphCalcSessionV2';
  const SESSION_VERSION = 2;
  const DEFAULT_MAX_ITEMS = 240;
  const DEFAULT_MAX_UNDO = 240;
  const DEFAULT_MAX_EVENTS = 500;
  const PERSISTED_UNDO = 24;
  const PERSISTED_REDO = 24;
  const PERSISTED_EVENTS = 300;
  const MAX_POLYGON_VERTICES = 2000;
  const MAX_NAME_LENGTH = 120;
  const MAX_ABS_NUMBER = 1e12;
  const ALLOWED_TYPES = new Set(['function','parametric','vector','point','line','circle','ellipse','polygon','washers','curve3d','line3d']);
  let nextId = 1;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function finite(value, label = 'valor') {
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n) > MAX_ABS_NUMBER) throw new Error(`${label} inválido ou fora da faixa suportada.`);
    return n;
  }
  function optionalFinite(value, label) {
    if (value === undefined || value === null || value === '') return undefined;
    return finite(value, label);
  }
  function cleanExpression(value, label = 'expressão') {
    const raw = String(value ?? '').trim();
    if (!raw) throw new Error(`${label} vazia.`);
    const normalized = global.MathEngine?.normalize ? global.MathEngine.normalize(raw) : raw;
    if (global.MathEngine?.compile) global.MathEngine.compile(normalized, {});
    return normalized;
  }
  function validColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#46e6ff'; }

  class GraphObjects {
    constructor(onChange) {
      this.items = [];
      this.onChange = onChange || function () {};
      // A namespace keeps each OrbisV laboratory independent while preserving
      // the native object/session mechanics used by the editor.
      this.storageNamespace = '';
      this.undoStack = [];
      this.redoStack = [];
      this.events = [];
      this.maxItems = DEFAULT_MAX_ITEMS;
      this.maxUndo = DEFAULT_MAX_UNDO;
      this.maxEvents = DEFAULT_MAX_EVENTS;
      this.lastSaveStatus = { ok: true, degraded: false, message: '' };
    }

    get storageKeys() {
      const suffix = this.storageNamespace ? `:${this.storageNamespace}` : '';
      return {
        current: `${STORAGE_CURRENT}${suffix}`,
        previous: `${STORAGE_PREVIOUS}${suffix}`,
        recovery: `${STORAGE_RECOVERY}${suffix}`
      };
    }

    setStorageNamespace(namespace = '') {
      const value = String(namespace || '').trim().toLowerCase();
      if (value && !/^[a-z0-9-]{1,80}$/.test(value)) throw new Error('Namespace de sessão inválido.');
      this.storageNamespace = value;
      return this.storageNamespace;
    }

    snapshot() { return clone(this.items); }
    ensureCapacity(extra = 1) {
      const amount = Math.max(0, Number(extra) || 0);
      if (this.items.length + amount > this.maxItems) throw new Error(`A operação resultaria em ${this.items.length + amount} objetos. O limite seguro atual é ${this.maxItems}.`);
    }
    restore(snapshot, notify = true) {
      const source = Array.isArray(snapshot) ? snapshot.slice(0, this.maxItems) : [];
      this.items = source.map((item, index) => this.sanitizeObject(item, index));
      nextId = this.items.reduce((m, item) => Math.max(m, Number(item.id) || 0), 0) + 1;
      if (notify) this.notify({ action: 'restaurar estado', kind: 'restore' });
    }
    notify(meta) { this.onChange(meta || { action: 'alteração', kind: 'change' }); }
    recordEvent(action, detail = '', kind = 'change') {
      this.events.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action: String(action || '').slice(0, 160), detail: String(detail || '').slice(0, 500), kind: String(kind || 'change').slice(0, 80), at: nowIso() });
      if (this.events.length > this.maxEvents) this.events.length = this.maxEvents;
    }
    commit(previous, action, detail = '', kind = 'change') {
      this.undoStack.push({ items: previous, action, detail });
      if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
      this.redoStack = [];
      this.recordEvent(action, detail, kind);
      this.notify({ action, detail, kind });
    }
    getById(id) { return this.items.find((o) => o.id === Number(id)); }

    add(type, data, color, extras = {}) {
      this.ensureCapacity(1);
      if (!ALLOWED_TYPES.has(type)) throw new Error(`Tipo de objeto não suportado: ${type}.`);
      const previous = this.snapshot();
      const obj = this.sanitizeObject({ id: nextId++, type, color: color || '#46e6ff', visible: true, locked: false, name: '', data: clone(data), ...clone(extras) }, this.items.length);
      this.items.push(obj);
      this.commit(previous, 'Objeto adicionado', this.describe(obj), 'add');
      return obj;
    }
    update(id, data, extras = null) {
      const item = this.getById(id); if (!item || item.locked) return false;
      const previous = this.snapshot();
      const candidate = { ...item, data: clone(data), ...(extras ? clone(extras) : {}) };
      const sanitized = this.sanitizeObject(candidate, this.items.indexOf(item));
      Object.assign(item, sanitized);
      this.commit(previous, 'Objeto editado', this.describe(item), 'edit');
      return true;
    }
    remove(id, force = false) {
      const item = this.getById(id); if (!item || (item.locked && !force)) return false;
      const previous = this.snapshot();
      this.items = this.items.filter((o) => o.id !== item.id);
      this.commit(previous, 'Objeto excluído', this.describe(item), 'delete');
      return true;
    }
    toggle(id) {
      const item = this.getById(id); if (!item) return false;
      const previous = this.snapshot(); item.visible = !item.visible;
      this.commit(previous, item.visible ? 'Objeto exibido' : 'Objeto ocultado', this.describe(item), 'visibility');
      return true;
    }
    setLocked(id, locked) {
      const item = this.getById(id); if (!item) return false;
      const previous = this.snapshot(); item.locked = locked === undefined ? !item.locked : Boolean(locked);
      this.commit(previous, item.locked ? 'Objeto bloqueado' : 'Objeto desbloqueado', this.describe(item), 'lock');
      return true;
    }
    duplicate(id, colorOverride = null) {
      const item = this.getById(id); if (!item) return null;
      this.ensureCapacity(1);
      const previous = this.snapshot();
      const copy = clone(item); copy.id = nextId++; copy.locked = false; copy.name = item.name ? `${item.name} cópia`.slice(0, MAX_NAME_LENGTH) : ''; if (colorOverride) copy.color = String(colorOverride);
      if (copy.data && Number.isFinite(copy.data.x)) copy.data.x += 0.4;
      if (copy.data && Number.isFinite(copy.data.y)) copy.data.y += 0.4;
      const sanitized = this.sanitizeObject(copy, this.items.length);
      this.items.push(sanitized);
      this.commit(previous, 'Objeto duplicado', this.describe(sanitized), 'duplicate');
      return sanitized;
    }
    reorder(id, direction) {
      const index = this.items.findIndex((o) => o.id === Number(id)); if (index < 0) return false;
      const target = direction === 'up' ? index + 1 : direction === 'down' ? index - 1 : Number(direction);
      if (!Number.isInteger(target) || target < 0 || target >= this.items.length || target === index) return false;
      const previous = this.snapshot();
      const [item] = this.items.splice(index, 1); this.items.splice(target, 0, item);
      this.commit(previous, 'Ordem dos objetos alterada', this.describe(item), 'reorder');
      return true;
    }
    batch(ids, operation) {
      const set = new Set((ids || []).map(Number)); if (!set.size) return false;
      if (operation === 'duplicate') this.ensureCapacity(this.items.filter((o) => set.has(o.id)).length);
      const previous = this.snapshot(); let changed = false; let detail = `${set.size} objeto(s)`;
      if (operation === 'hide') { this.items.forEach((o) => { if (set.has(o.id) && o.visible) { o.visible = false; changed = true; } }); }
      if (operation === 'show') { this.items.forEach((o) => { if (set.has(o.id) && !o.visible) { o.visible = true; changed = true; } }); }
      if (operation === 'delete') { const before = this.items.length; this.items = this.items.filter((o) => !set.has(o.id) || o.locked); changed = this.items.length !== before; }
      if (operation === 'duplicate') {
        const copies = this.items.filter((o) => set.has(o.id)).map((o, index) => this.sanitizeObject({ ...clone(o), id: nextId++, locked: false }, this.items.length + index));
        if (copies.length) { this.items.push(...copies); changed = true; detail = `${copies.length} objeto(s)`; }
      }
      if (!changed) return false;
      const labels = { hide: 'Objetos ocultados', show: 'Objetos exibidos', delete: 'Objetos excluídos', duplicate: 'Objetos duplicados' };
      this.commit(previous, labels[operation] || 'Objetos alterados', detail, 'batch'); return true;
    }
    clear(force = false) {
      if (!this.items.length) return false;
      const previous = this.snapshot();
      if (force) this.items = []; else this.items = this.items.filter((o) => o.locked);
      if (this.items.length === previous.length) return false;
      this.commit(previous, 'Cena limpa', `${previous.length - this.items.length} objeto(s) removido(s)`, 'clear'); return true;
    }
    undo() {
      const entry = this.undoStack.pop(); if (!entry) return false;
      this.redoStack.push({ items: this.snapshot(), action: entry.action, detail: entry.detail });
      if (this.redoStack.length > this.maxUndo) this.redoStack.shift();
      this.restore(entry.items, false);
      this.recordEvent(`Desfazer: ${entry.action}`, entry.detail, 'undo');
      this.notify({ action: `Desfazer: ${entry.action}`, detail: entry.detail, kind: 'undo' }); return true;
    }
    redo() {
      const entry = this.redoStack.pop(); if (!entry) return false;
      this.undoStack.push({ items: this.snapshot(), action: entry.action, detail: entry.detail });
      if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
      this.restore(entry.items, false);
      this.recordEvent(`Refazer: ${entry.action}`, entry.detail, 'redo');
      this.notify({ action: `Refazer: ${entry.action}`, detail: entry.detail, kind: 'redo' }); return true;
    }
    describe(obj) {
      if (!obj) return '';
      if (obj.type === 'function') return `f(x) = ${obj.data.expression}`;
      if (obj.type === 'parametric') return `x(t) = ${obj.data.xExpr}; y(t) = ${obj.data.yExpr}`;
      if (obj.type === 'vector') return `(${obj.data.x1}, ${obj.data.y1}) → (${obj.data.x2}, ${obj.data.y2})`;
      if (obj.type === 'point') return `P = (${obj.data.x}, ${obj.data.y})`;
      if (obj.type === 'circle') return `Círculo r = ${obj.data.r}`;
      if (obj.type === 'ellipse') return `Elipse a = ${obj.data.a}, b = ${obj.data.b}`;
      if (obj.type === 'line') return `${obj.data.a}x + ${obj.data.b}y + ${obj.data.c} = 0`;
      if (obj.type === 'polygon') return `Polígono com ${(obj.data.vertices || []).length} vértices`;
      if (obj.type === 'washers') return `${obj.data.method === 'washers' ? 'Anéis' : 'Discos'} em torno do eixo ${obj.data.axis || 'x'} · V ≈ ${Number.isFinite(obj.data.volume) ? obj.data.volume.toFixed(4) : '—'}`;
      if (obj.type === 'curve3d') return `r(t) = (${obj.data.xExpr}, ${obj.data.yExpr}, ${obj.data.zExpr})`;
      if (obj.type === 'line3d') return obj.data.method === 'twoPoints' ? 'Reta 3D por dois pontos' : `Reta 3D com direção (${obj.data.a}, ${obj.data.b}, ${obj.data.c})`;
      return obj.type;
    }

    sanitizeData(type, data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dados matemáticos inválidos.');
      if (type === 'function') {
        const expression = cleanExpression(data.expression, 'Expressão da função');
        const xMin = optionalFinite(data.xMin, 'Limite inicial do domínio');
        const xMax = optionalFinite(data.xMax, 'Limite final do domínio');
        if (Number.isFinite(xMin) && Number.isFinite(xMax) && xMin >= xMax) throw new Error('O domínio inicial deve ser menor que o final.');
        return { expression, ...(xMin !== undefined ? { xMin } : {}), ...(xMax !== undefined ? { xMax } : {}) };
      }
      if (type === 'parametric') {
        const xExpr = cleanExpression(data.xExpr, 'x(t)'); const yExpr = cleanExpression(data.yExpr, 'y(t)');
        const tMin = finite(data.tMin, 't mínimo'); const tMax = finite(data.tMax, 't máximo');
        if (!(tMin < tMax)) throw new Error('O intervalo de t deve ser crescente.');
        return { xExpr, yExpr, tMin, tMax };
      }
      if (type === 'vector') return { x1: finite(data.x1,'x₁'), y1: finite(data.y1,'y₁'), x2: finite(data.x2,'x₂'), y2: finite(data.y2,'y₂') };
      if (type === 'point') return { x: finite(data.x,'x'), y: finite(data.y,'y') };
      if (type === 'line') {
        const out = { a: finite(data.a,'a'), b: finite(data.b,'b'), c: finite(data.c,'c') };
        if (Math.abs(out.a) < 1e-14 && Math.abs(out.b) < 1e-14) throw new Error('Os coeficientes a e b não podem ser ambos zero.'); return out;
      }
      if (type === 'circle') { const out = { cx: finite(data.cx,'cx'), cy: finite(data.cy,'cy'), r: finite(data.r,'raio') }; if (!(out.r > 0)) throw new Error('O raio deve ser positivo.'); return out; }
      if (type === 'ellipse') { const out = { cx: finite(data.cx,'cx'), cy: finite(data.cy,'cy'), a: finite(data.a,'semieixo a'), b: finite(data.b,'semieixo b') }; if (!(out.a > 0 && out.b > 0)) throw new Error('Os semieixos devem ser positivos.'); return out; }
      if (type === 'polygon') {
        if (!Array.isArray(data.vertices) || data.vertices.length < 3 || data.vertices.length > MAX_POLYGON_VERTICES) throw new Error(`O polígono deve ter entre 3 e ${MAX_POLYGON_VERTICES} vértices.`);
        return { vertices: data.vertices.map((v, i) => { if (!Array.isArray(v) || v.length < 2) throw new Error(`Vértice ${i + 1} inválido.`); return [finite(v[0],`x do vértice ${i + 1}`), finite(v[1],`y do vértice ${i + 1}`)]; }) };
      }
      if (type === 'washers') {
        const method = data.method === 'washers' ? 'washers' : 'disks'; const axis = data.axis === 'y' ? 'y' : 'x'; const view = data.view === '2d' ? '2d' : '3d';
        const outerExpr = cleanExpression(data.outerExpr, 'Raio externo'); const innerExpr = method === 'washers' ? cleanExpression(data.innerExpr || '0','Raio interno') : '0';
        const a = finite(data.a,'Limite inicial'); const b = finite(data.b,'Limite final'); if (!(a < b)) throw new Error('O intervalo de integração deve ser crescente.');
        const analysis = global.MathEngine?.analyzeRevolution?.({ method, axis, outerExpr, innerExpr, a, b });
        if (analysis && !analysis.valid) throw new Error(analysis.error || 'Sólido de revolução inválido.');
        return { method, axis, view, outerExpr, innerExpr, a, b, volume: analysis?.volume ?? optionalFinite(data.volume,'Volume'), maxOuter: analysis?.maxOuter ?? optionalFinite(data.maxOuter,'Raio externo máximo'), maxInner: analysis?.maxInner ?? optionalFinite(data.maxInner,'Raio interno máximo') };
      }
      if (type === 'curve3d') {
        const xExpr = cleanExpression(data.xExpr,'x(t)'); const yExpr = cleanExpression(data.yExpr,'y(t)'); const zExpr = cleanExpression(data.zExpr,'z(t)');
        const tMin = finite(data.tMin,'t mínimo'); const tMax = finite(data.tMax,'t máximo'); if (!(tMin < tMax)) throw new Error('O intervalo de t deve ser crescente.');
        return { xExpr, yExpr, zExpr, tMin, tMax };
      }
      if (type === 'line3d') {
        if (data.method === 'twoPoints') {
          const out = { method:'twoPoints', x1:finite(data.x1,'x₁'), y1:finite(data.y1,'y₁'), z1:finite(data.z1,'z₁'), x2:finite(data.x2,'x₂'), y2:finite(data.y2,'y₂'), z2:finite(data.z2,'z₂') };
          if (Math.hypot(out.x2-out.x1,out.y2-out.y1,out.z2-out.z1) < 1e-12) throw new Error('Os dois pontos da reta precisam ser distintos.'); return out;
        }
        const out = { method:'pointVector', x0:finite(data.x0,'x₀'), y0:finite(data.y0,'y₀'), z0:finite(data.z0,'z₀'), a:finite(data.a,'a'), b:finite(data.b,'b'), c:finite(data.c,'c') };
        if (Math.hypot(out.a,out.b,out.c) < 1e-12) throw new Error('O vetor diretor não pode ser nulo.'); return out;
      }
      throw new Error(`Tipo de objeto não suportado: ${type}.`);
    }

    sanitizeObject(raw, index = 0) {
      if (!raw || typeof raw !== 'object' || !ALLOWED_TYPES.has(raw.type)) throw new Error(`Objeto ${index + 1} possui tipo inválido ou não suportado.`);
      const idRaw = Number(raw.id); const id = Number.isSafeInteger(idRaw) && idRaw > 0 ? idRaw : index + 1;
      return { id, type: raw.type, color: validColor(raw.color), visible: raw.visible !== false, locked: Boolean(raw.locked), name: typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME_LENGTH) : '', data: this.sanitizeData(raw.type, raw.data) };
    }

    serialize(options = {}) {
      const compact = Boolean(options.compact);
      return {
        format: 'orbisv-session', version: SESSION_VERSION, savedAt: nowIso(), items: clone(this.items),
        undoStack: compact ? [] : clone(this.undoStack.slice(-PERSISTED_UNDO)),
        redoStack: compact ? [] : clone(this.redoStack.slice(-PERSISTED_REDO)),
        events: clone(this.events.slice(0, compact ? 80 : PERSISTED_EVENTS))
      };
    }
    trySetStorage(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
    save() {
      const keys = this.storageKeys;
      const previous = (() => { try { return localStorage.getItem(keys.current); } catch { return null; } })();
      let payload;
      try { payload = JSON.stringify(this.serialize()); } catch (error) { this.lastSaveStatus = { ok:false, degraded:false, message:error?.message || 'Falha ao serializar a sessão.' }; return false; }
      let ok = this.trySetStorage(keys.current, payload); let degraded = false;
      if (!ok) {
        try { localStorage.removeItem(keys.previous); } catch {}
        try { localStorage.removeItem(keys.recovery); } catch {}
        try { payload = JSON.stringify(this.serialize({ compact:true })); } catch {}
        ok = this.trySetStorage(keys.current, payload); degraded = ok;
      }
      if (!ok) { this.lastSaveStatus = { ok:false, degraded:false, message:'O navegador não conseguiu salvar a sessão local. Exporte o projeto para evitar perda de dados.' }; return false; }
      if (previous && previous !== payload) this.trySetStorage(keys.previous, previous);
      try {
        const recoveryRaw = localStorage.getItem(keys.recovery); let shouldWriteRecovery = !recoveryRaw;
        if (recoveryRaw) { try { const r = JSON.parse(recoveryRaw); shouldWriteRecovery = Date.now() - new Date(r.savedAt || 0).getTime() > 5 * 60 * 1000; } catch { shouldWriteRecovery = true; } }
        if (shouldWriteRecovery) this.trySetStorage(keys.recovery, payload);
      } catch {}
      this.lastSaveStatus = { ok:true, degraded, message: degraded ? 'Sessão salva em modo compacto por limite de armazenamento do navegador.' : '' };
      return true;
    }
    loadPayload(raw) {
      if (!raw || !Array.isArray(raw.items) || raw.items.length > this.maxItems) return false;
      try {
        const ids = new Set();
        const cleanItems = raw.items.map((item, index) => this.sanitizeObject(item, index)).map((item, index) => {
          let id = item.id; if (ids.has(id)) id = index + 1; while (ids.has(id)) id += 1; ids.add(id); return { ...item, id };
        });
        this.items = cleanItems; nextId = this.items.reduce((m, item) => Math.max(m, item.id), 0) + 1;
        this.undoStack = Array.isArray(raw.undoStack) ? clone(raw.undoStack.slice(-this.maxUndo)).filter((e) => Array.isArray(e?.items) && e.items.length <= this.maxItems) : [];
        this.redoStack = Array.isArray(raw.redoStack) ? clone(raw.redoStack.slice(-this.maxUndo)).filter((e) => Array.isArray(e?.items) && e.items.length <= this.maxItems) : [];
        this.events = Array.isArray(raw.events) ? clone(raw.events.slice(0, this.maxEvents)) : [];
        return true;
      } catch { return false; }
    }
    parseStorageKey(key) { try { const text = localStorage.getItem(key); return text ? JSON.parse(text) : null; } catch { return null; } }
    load() {
      const keys = this.storageKeys;
      const sources = [[keys.current,'Sessão principal'],[keys.previous,'Cópia anterior'],[keys.recovery,'Recuperação automática']];
      for (const [key,label] of sources) {
        const raw = this.parseStorageKey(key);
        if (raw && this.loadPayload(raw)) {
          if (key !== keys.current) { this.recordEvent('Sessão recuperada', label, 'recovery'); this.save(); }
          return true;
        }
      }
      // Legacy migration only belongs to the unscoped editor session. A lab
      // namespace must start from its own clean scene when no lab data exists.
      if (this.storageNamespace) return false;
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (legacy?.version === 2 && Array.isArray(legacy.items) && legacy.items.length <= this.maxItems) { this.restore(legacy.items, false); this.recordEvent('Sessão anterior migrada', 'Dados importados da Calculadora Gráfica', 'migration'); this.save(); return true; }
      } catch {}
      return false;
    }
    recoveryCandidate() {
      const keys = this.storageKeys;
      const candidates = [this.parseStorageKey(keys.recovery), this.parseStorageKey(keys.previous)];
      return candidates.find((raw) => raw && Array.isArray(raw.items) && raw.items.length <= this.maxItems) || null;
    }
    validateProject(project) {
      if (!project || project.format !== 'orbisv-project' || !Array.isArray(project.scene?.objects)) throw new Error('Arquivo OrbisV inválido ou incompatível.');
      const version = Number(project.version || 1);
      if (!Number.isInteger(version) || version < 1 || version > 2) throw new Error(`Versão de projeto não suportada: ${project.version}.`);
      const objects = project.scene.objects;
      if (objects.length > this.maxItems) throw new Error(`O projeto possui ${objects.length} objetos. O limite seguro atual é ${this.maxItems}.`);
      const ids = new Set();
      objects.forEach((obj, index) => {
        const clean = this.sanitizeObject(obj, index); const id = clean.id;
        if (ids.has(id)) throw new Error(`O projeto contém identificadores duplicados (${id}).`); ids.add(id);
      });
      return { version, objectCount: objects.length };
    }
    sanitizedProjectObjects(project) { this.validateProject(project); return project.scene.objects.map((raw, index) => this.sanitizeObject(raw, index)); }
    importProject(project) {
      const imported = this.sanitizedProjectObjects(project);
      const previous = this.snapshot(); this.items = imported; nextId = this.items.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0) + 1;
      this.undoStack.push({ items: previous, action: 'abrir projeto', detail: project.name || '' }); if (this.undoStack.length > this.maxUndo) this.undoStack.shift(); this.redoStack = [];
      this.recordEvent('Projeto aberto', project.name || 'Projeto OrbisV', 'project'); this.notify({ action: 'Projeto aberto', detail: project.name || '', kind: 'project' });
      return imported.length;
    }
    mergeProject(project) {
      const imported = this.sanitizedProjectObjects(project); this.ensureCapacity(imported.length);
      const previous = this.snapshot(); const copies = imported.map((obj) => ({ ...clone(obj), id: nextId++ }));
      this.items.push(...copies); this.redoStack = [];
      this.commit(previous, 'Projeto mesclado', `${project.name || 'Projeto OrbisV'} · ${copies.length} objeto(s)`, 'project-merge'); return copies.length;
    }
    get visible() { return this.items.filter((o) => o.visible); }
  }

  GraphObjects.limits = Object.freeze({ maxItems: DEFAULT_MAX_ITEMS, maxUndo: DEFAULT_MAX_UNDO, maxEvents: DEFAULT_MAX_EVENTS, maxPolygonVertices: MAX_POLYGON_VERTICES });
  global.GraphObjects = GraphObjects;
})(window);
