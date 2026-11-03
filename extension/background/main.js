import { api, action, restrictStorage } from '../shared/browser.js';
import { ACTIVE_STATES, safeUrl, normalizeResult, validateText, verdictStyle, hostPermission } from '../shared/core.js';
import { settings, savedKey, saveSettings } from '../shared/settings.js';
import { createRunner } from '../runner/host.js';

// Toda mutação de jobs passa por esta fila: evita duplo clique e escritas concorrentes.
let queue = Promise.resolve();
function serialize(work) {
    const next = queue.then(work);
    queue = next.catch(() => {});
    return next;
}
const localRunner = api.offscreen ? null : createRunner((id, event) => serialize(() => recordEvent(id, event)), async () => {});
async function runnerIds() {
    if (localRunner) return localRunner.activeIds();
    try {
        const response = await api.runtime.sendMessage({ target: 'runner', type: 'status' });
        return response?.data || [];
    } catch { return []; }
}
async function startRunner(payload) {
    if (localRunner) { localRunner.start(payload); return; }
    const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL('runner/index.html')] });
    if (!contexts.length) await api.offscreen.createDocument({ url: 'runner/index.html', reasons: ['WORKERS'], justification: 'Executar a checagem HTTP/SSE em um worker independente do popup, sem abrir abas.' });
    const response = await api.runtime.sendMessage({ target: 'runner', type: 'start', payload });
    payload.key = '';
    if (!response?.ok) throw new Error('Não foi possível iniciar o executor da extensão.');
}
async function jobs() { return (await api.storage.local.get('jobs')).jobs || []; }
async function save(all) {
    // Até 50 resultados e 10 rascunhos/erros, além de eventuais jobs ativos.
    let complete = 0, other = 0;
    all = all.filter(job => ACTIVE_STATES.includes(job.status) || (job.status === 'done' ? ++complete <= 50 : ++other <= 10));
    try { await api.storage.local.set({ jobs: all }); }
    catch { throw new Error('Armazenamento cheio. Exclua itens do histórico e tente novamente.'); }
}
async function badge(job) {
    try {
        const tab = await api.tabs.get(job.sourceTabId);
        if (!tab.url || tab.url !== job.sourceUrl) return;
        const [, color, text] = verdictStyle(job.result);
        await action.setBadgeBackgroundColor({ tabId: tab.id, color: ACTIVE_STATES.includes(job.status) ? '#29316B' : color });
        await action.setBadgeText({ tabId: tab.id, text: job.status === 'done' ? text : ACTIVE_STATES.includes(job.status) ? '…' : job.status === 'draft' ? '!' : '' });
    } catch { /* A aba original pode ter sido fechada ou perdido a permissão activeTab. */ }
}
async function badgeAfterRemoval(removed) {
    const all = await jobs();
    const samePage = all.filter(item => item.sourceTabId === removed.sourceTabId && item.sourceUrl === removed.sourceUrl);
    const remaining = samePage.find(item => ACTIVE_STATES.includes(item.status)) || samePage.find(item => item.status === 'done');
    await badge(remaining || { ...removed, status: 'deleted' });
}

async function capture(tabId, mode, selection) {
    const tab = await api.tabs.get(tabId);
    const url = safeUrl(tab.url);
    if (!url) throw new Error('Abra uma página HTTP/HTTPS. Páginas internas e lojas de extensões não permitem leitura.');
    let text = '', title = tab.title || url, notice = '', extraction = { method: mode === 'selection' ? 'selection' : 'none' };
    if (mode === 'selection' && typeof selection === 'string') text = selection;
    else {
        try {
            if (mode === 'selection') {
                const results = await api.scripting.executeScript({ target: { tabId }, func: () => window.getSelection()?.toString() || '' });
                text = results[0]?.result || '';
            } else {
                await api.scripting.executeScript({ target: { tabId }, files: ['vendor/Readability.js'] });
                const results = await api.scripting.executeScript({ target: { tabId }, files: ['content/extract.js'] });
                text = results[0]?.result?.text || '';
                title = results[0]?.result?.title || title;
                extraction = { method: results[0]?.result?.method || 'none' };
                notice = (results[0]?.result?.warnings || []).join(' ');
            }
        } catch { notice = 'Não foi possível ler esta página. Cole um trecho público no campo abaixo. Não contornamos bloqueios ou paywalls.'; }
    }
    if (!text && !notice) notice = 'Nenhum artigo ou seleção foi encontrado. Cole o trecho que deseja verificar.';
    // Impedir captura descontrolada, sem cortar conteúdo silenciosamente.
    if (text.length > 500000) { text = ''; notice = 'Página grande demais para captura. Cole um trecho de até 20.000 caracteres.'; }
    const job = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), sourceTabId: tab.id, sourceUrl: url, title: String(title).slice(0, 500), text, notice, extraction, status: 'draft' };
    const all = await jobs();
    all.unshift(job); await save(all);
    await api.storage.local.set({ ui: { selectedId: job.id, view: 'analysis' } });
    await badge(job);
    return job.id;
}

async function recordEvent(id, event) {
    const all = await jobs(); const job = all.find(item => item.id === id);
    if (!job || !ACTIVE_STATES.includes(job.status)) return;
    if (event.type === 'result') {
        job.result = normalizeResult(event); job.status = 'done'; job.progress = 'Apuração concluída';
        job.completedAt = new Date().toISOString();
        all.splice(all.indexOf(job), 1); all.unshift(job);
    } else if (event.type === 'failure') {
        job.status = 'error'; job.error = String(event.msg || 'Falha na apuração.').slice(0, 500);
    } else {
        if (event.type === 'step' && Number.isInteger(event.step)) job.step = Math.min(4, Math.max(1, event.step));
        const progress = ({ step: event.msg, keywords: `Termos: ${(Array.isArray(event.keywords) ? event.keywords : []).join(', ')}`, query: `Pesquisando: ${event.query || ''}`, articles_found: `${event.count} artigos indexados`, reading: `Lendo veículo: ${event.fonte || 'Fonte'}` })[event.type];
        if (!progress) return;
        job.status = 'running'; job.progress = String(progress).slice(0, 500);
    }
    await save(all); await badge(job);
}

async function handle(message, sender) {
    const all = await jobs();
    if (message.type === 'runner-event') { await recordEvent(message.id, message.event); return null; }
    if (message.type === 'runner-settled') {
        if (api.offscreen && !all.some(item => ACTIVE_STATES.includes(item.status))) await api.offscreen.closeDocument().catch(() => {});
        return null;
    }
    if (message.type === 'capture') return capture(message.tabId, message.mode);
    if (message.type === 'list') return all.map(({ text, ...job }) => job);
    const job = all.find(item => item.id === message.id);
    if (message.type === 'clear') {
        const removed = all.filter(item => !ACTIVE_STATES.includes(item.status));
        await save(all.filter(item => ACTIVE_STATES.includes(item.status)));
        for (const item of removed) await badgeAfterRemoval(item);
        return null;
    }
    if (!job) throw new Error('Análise não encontrada. Ela pode ter sido excluída do histórico.');
    if (message.type === 'get') return job;
    if (message.type === 'open') {
        await api.storage.local.set({ ui: { selectedId: job.id, view: 'analysis' } });
        await action.openPopup().catch(() => {});
        return null;
    }
    if (message.type === 'delete') {
        if (ACTIVE_STATES.includes(job.status)) throw new Error('Aguarde a conclusão ou interrompa a análise antes de excluir.');
        await save(all.filter(item => item.id !== job.id)); await badgeAfterRemoval(job); return null;
    }
    if (message.type === 'draft') {
        if (ACTIVE_STATES.includes(job.status) || job.status === 'done') return job;
        if (typeof message.text !== 'string' || message.text.length > 500000) throw new Error('Texto grande demais. Escolha um trecho.');
        job.text = message.text;
    } else if (message.type === 'start') {
        if (all.some(item => ACTIVE_STATES.includes(item.status))) throw new Error('Já existe uma verificação em andamento. Acompanhe-a no popup antes de iniciar outra.');
        const config = await settings();
        if (config.endpoint !== message.endpoint) throw new Error('A API foi alterada. Reabra a prévia antes de confirmar o envio.');
        if (!await api.permissions.contains({ origins: [hostPermission(config.endpoint)] })) throw new Error('Autorize o acesso à API antes de iniciar.');
        let key = message.key || await savedKey();
        try {
            if (typeof key !== 'string' || !key.startsWith('gsk_')) throw new Error('Informe sua chave Groq no formato gsk_…');
            job.text = validateText(message.text);
            await saveSettings({ ...config, temporary: message.temporary === true }, key);
            job.status = 'starting'; job.error = ''; delete job.result; job.step = 1; job.progress = 'Iniciando apuração…';
            await save(all); await badge(job);
            await startRunner({ id: job.id, endpoint: config.endpoint, text: job.text, key, options: config.options });
        } catch (error) {
            if (ACTIVE_STATES.includes(job.status)) { job.status = 'error'; job.error = error.message; await save(all); await badge(job); }
            throw error;
        } finally { key = ''; message.key = ''; }
        return job;
    } else if (message.type === 'cancel') {
        if (localRunner) localRunner.cancel(job.id);
        else await api.runtime.sendMessage({ target: 'runner', type: 'cancel', id: job.id });
        return null;
    } else throw new Error('Ação desconhecida.');
    await save(all); await badge(job); return job;
}

api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || message.target === 'runner') return false;
    const isRunner = sender.url === api.runtime.getURL('runner/index.html');
    const ownPages = ['popup/index.html'].map(path => api.runtime.getURL(path));
    if (['runner-event', 'runner-settled'].includes(message.type) ? !isRunner : !ownPages.includes(sender.url?.split('?')[0])) return false;
    serialize(() => handle(message, sender)).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
    return true;
});

api.runtime.onInstalled.addListener(() => {
    api.contextMenus.removeAll().then(() => {
        api.contextMenus.create({ id: 'selection', title: 'Verificar seleção com VerificaAI', contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
        api.contextMenus.create({ id: 'page', title: 'Verificar esta página com VerificaAI', contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
    });
});
api.contextMenus.onClicked.addListener((info, tab) => {
    serialize(async () => {
        await capture(tab.id, info.menuItemId, info.selectionText);
        await action.openPopup().catch(() => {});
    }).catch(async () => {
        await api.storage.local.set({ captureError: 'Não foi possível capturar esta página. Abra o popup e escolha outro trecho.' });
        await action.setBadgeText({ tabId: tab.id, text: '!' });
    });
});
api.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'loading' || change.url) action.setBadgeText({ tabId, text: '' }).catch(() => {});
});

serialize(async () => {
    await restrictStorage();
    const all = await jobs();
    const alive = await runnerIds();
    for (const job of all) if (ACTIVE_STATES.includes(job.status)) {
        if (!alive.includes(job.id)) { job.status = 'interrupted'; job.error = 'O navegador ou executor foi encerrado. Os resultados anteriores foram preservados. Nova tentativa pode consumir cota.'; }
    }
    await save(all);
}).catch(() => {});
