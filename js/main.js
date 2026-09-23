(function () {
  'use strict';
  const canvas = document.getElementById('graphCanvas');
  const objects = new GraphObjects();
  const engine = new GraphEngine(canvas, objects);
  // Public runtime bridge used by the platform navigation. The native editor
  // remains the source of truth for graphing, editing, undo/redo and import.
  window.OrbisVRuntime = { objects, engine, AppUI };
  AppUI.init(objects, engine);
  window.OrbisVRuntime.ready = true;
  window.dispatchEvent(new CustomEvent('orbisv:ready'));
  window.addEventListener('error', (event) => {
    if (!event?.error) return;
    AppUI.reportRuntimeError?.(event.error, 'execução');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason instanceof Error ? event.reason : new Error(String(event?.reason || 'Falha assíncrona não identificada.'));
    AppUI.reportRuntimeError?.(reason, 'operação assíncrona');
  });
  window.OrbisManualBridge = { handle(action){ if(String(action).startsWith('platform:')){AppUI.closeManual();window.OrbisPlatform?.navigate(action.split(':')[1]);}else AppUI.handleManualAction(action,{fromManual:true}); }, focus(){ try{ window.focus(); }catch{} }, close(){ AppUI.closeManual(); } };
  if (!objects.items.length) engine.center();
  else engine.requestRender();
  const recalibrate = () => { engine.resize(); engine.requestRender(); };
  requestAnimationFrame(() => requestAnimationFrame(recalibrate));
  setTimeout(recalibrate, 120);
  document.addEventListener('fullscreenchange', recalibrate);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js?v=8.0.0', { scope: './', updateViaCache: 'none' });
        registration.update().catch(()=>{});
        let reloadedForUpdate = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloadedForUpdate || sessionStorage.getItem('orbisv-sw-reloaded-v8.0.0') === '1') return;
          reloadedForUpdate = true;
          sessionStorage.setItem('orbisv-sw-reloaded-v8.0.0','1');
          location.reload();
        });
      } catch (error) {
        console.warn('OrbisV: não foi possível registrar o service worker.', error);
      }
    }, { once: true });
  }
})();
