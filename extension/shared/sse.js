// Parser incremental: UTF-8 e eventos podem chegar em fragmentos arbitrários.
export async function consumeSSE(body, onEvent) {
    if (!body) throw new Error('O servidor não forneceu um stream.');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', lines = [], dataSize = 0, terminal = false;
    async function line(value) {
        if (!value) {
            if (!lines.length) return;
            const payload = lines.join('\n'); lines = []; dataSize = 0;
            let event;
            try { event = JSON.parse(payload); } catch { throw new Error('O stream contém um evento JSON inválido.'); }
            if (!event || typeof event.type !== 'string') throw new Error('Evento de progresso inválido.');
            await onEvent(event);
            terminal = ['result', 'error'].includes(event.type);
        } else if (value.startsWith('data:')) {
            dataSize += value.length;
            if (dataSize > 1024 * 1024) throw new Error('Evento excede o limite permitido.');
            lines.push(value.slice(5).replace(/^ /, ''));
        }
    }
    try {
        while (!terminal) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            if (buffer.length > 1024 * 1024) throw new Error('Evento excede o limite permitido.');
            let match;
            while (!terminal && (match = (done ? /\r\n|\r|\n/ : /\r\n|\r(?!$)|\n/).exec(buffer))) {
                const current = buffer.slice(0, match.index);
                buffer = buffer.slice(match.index + match[0].length);
                await line(current);
            }
            if (done) break;
        }
        if (!terminal) throw new Error('Conexão interrompida antes do resultado. Não há retomada automática; uma nova tentativa pode consumir cota.');
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
