import { normalizeEndpoint, normalizeOptions, validateText, httpError, normalizeResult } from './core.js';
import { consumeSSE } from './sse.js';

export async function check({ endpoint, text, key, options, signal, onEvent, fetchImpl = fetch }) {
    endpoint = normalizeEndpoint(endpoint);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    // Limite global; não reconectar um token de uso único.
    const timer = setTimeout(abort, 10 * 60 * 1000);
    try {
        if (!key?.startsWith('gsk_')) throw new Error('Informe uma chave Groq no formato gsk_…');
        const response = await fetchImpl(`${endpoint}/api/check/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noticia: validateText(text), opcoes: normalizeOptions(options), apiKey: key }),
            signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error'
        });
        key = '';
        if (!response.ok) throw new Error(httpError(response.status));
        let data;
        try { data = await response.json(); } catch { throw new Error('A API não retornou um token JSON válido.'); }
        if (typeof data.token !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(data.token)) throw new Error('Token de verificação inválido.');
        const stream = await fetchImpl(`${endpoint}/api/check/stream/${encodeURIComponent(data.token)}`, {
            signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error'
        });
        if (!stream.ok) throw new Error(httpError(stream.status));
        if (!stream.headers.get('content-type')?.includes('text/event-stream')) throw new Error('O endpoint não retornou SSE. Confira a hospedagem da API.');
        await consumeSSE(stream.body, async event => {
            if (event.type === 'error') throw new Error('A apuração falhou. Confira a chave, a cota Groq e a disponibilidade das fontes. Uma nova tentativa pode consumir cota.');
            if (event.type === 'result') event = { type: 'result', ...normalizeResult(event) };
            await onEvent(event);
        });
    } catch (error) {
        if (controller.signal.aborted) throw new Error('Verificação interrompida ou tempo limite atingido. Não há retomada automática.');
        // Não retransmitir erros de fetch que possam incluir dados da requisição.
        if (error instanceof TypeError) throw new Error('Sem conexão com a API. Confira o endpoint e a permissão de acesso.');
        throw error;
    } finally { key = ''; clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
