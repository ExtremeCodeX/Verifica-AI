// O documento offscreen (Chrome) ou background persistente (Firefox) possui este worker.
// Nenhuma credencial é serializada em storage; fechar o popup não destrói este contexto.
export function createRunner(onEvent, onSettled) {
    let worker = null, activeId = null;
    let eventQueue = Promise.resolve();
    function cleanup() { worker?.terminate(); worker = null; activeId = null; }
    return {
        activeIds() { return activeId ? [activeId] : []; },
        start(payload) {
            if (activeId) throw new Error('Já existe uma verificação em execução.');
            activeId = payload.id;
            try { worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); }
            catch { cleanup(); payload.key = ''; throw new Error('Não foi possível criar o executor da extensão.'); }
            worker.onmessage = ({ data }) => {
                if (data.type === 'event') {
                    eventQueue = eventQueue.then(async () => {
                        try { await onEvent(data.id, data.event); worker?.postMessage({ type: 'ack', sequenceId: data.sequenceId }); }
                        catch { worker?.postMessage({ type: 'ack', sequenceId: data.sequenceId, error: 'Não foi possível salvar o estado local da análise.' }); }
                    });
                } else if (data.type === 'settled') {
                    eventQueue = eventQueue.then(async () => { cleanup(); await onSettled(data.id); }).catch(() => {});
                }
            };
            worker.onerror = () => {
                const id = activeId; cleanup();
                eventQueue = eventQueue.then(async () => {
                    await onEvent(id, { type: 'failure', msg: 'O executor da extensão foi interrompido. Confira a conexão antes de tentar novamente.' });
                    await onSettled(id);
                }).catch(() => {});
            };
            try { worker.postMessage({ ...payload, type: 'start' }); }
            catch { cleanup(); throw new Error('Não foi possível iniciar o executor da extensão.'); }
            finally { payload.key = ''; }
        },
        cancel(id) { if (activeId === id) worker?.postMessage({ type: 'cancel' }); }
    };
}
