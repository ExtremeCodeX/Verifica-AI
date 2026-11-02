import { createRunner } from './host.js';

const runtime = chrome.runtime;
const runner = createRunner(
    async (id, event) => {
        const response = await runtime.sendMessage({ target: 'background', type: 'runner-event', id, event });
        if (!response?.ok) throw new Error('Falha ao salvar progresso.');
    },
    id => runtime.sendMessage({ target: 'background', type: 'runner-settled', id }).catch(() => {})
);
runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== runtime.id || message.target !== 'runner' || sender.tab || (sender.url && sender.url !== runtime.getURL('background/main.js'))) return false;
    try {
        if (message.type === 'status') respond({ ok: true, data: runner.activeIds() });
        else if (message.type === 'start') { runner.start(message.payload); respond({ ok: true }); }
        else if (message.type === 'cancel') { runner.cancel(message.id); respond({ ok: true }); }
        else respond({ ok: false });
    } catch { respond({ ok: false }); }
    return false;
});
