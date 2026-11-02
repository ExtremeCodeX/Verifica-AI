import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeEndpoint, hostPermission, normalizeOptions, normalizeResult, validateText, safeUrl, verdictStyle } from '../../extension/shared/core.js';
import { consumeSSE } from '../../extension/shared/sse.js';
import { check } from '../../extension/shared/client.js';

const result = { type: 'result', veredicto: 'VERDADEIRA', grau_veracidade: 85, resumo: 'Evidência válida.' };
test('largura do popup é explícita também no body, usado no autosizing Firefox', async () => {
    const css = await readFile(new URL('../../extension/popup/style.css', import.meta.url), 'utf8');
    const body = css.match(/(?:^|\n)body\s*\{([^}]+)\}/)?.[1];
    assert.ok(body && /(?:^|;)\s*width:\s*580px\s*;/.test(body), 'body não pode depender de width:100% no popup Firefox.');
});
function body(text, size = 1) {
    const bytes = new TextEncoder().encode(text);
    return new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size)); controller.close(); } });
}
test('endpoint só aceita HTTPS público ou HTTP loopback explícito', () => {
    assert.equal(normalizeEndpoint('https://verifica-ai-five.vercel.app/'), 'https://verifica-ai-five.vercel.app');
    assert.equal(normalizeEndpoint('http://localhost:3000'), 'http://localhost:3000');
    assert.equal(hostPermission('http://127.0.0.1:3000'), 'http://127.0.0.1/*');
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com?key=secret', 'file:///etc/passwd', 'javascript:alert(1)']) assert.throws(() => normalizeEndpoint(url));
});
test('opções e texto respeitam o contrato do backend', () => {
    assert.equal(normalizeOptions({ modelo: 'inventado', max_artigos: 99 }).modelo, 'openai/gpt-oss-120b');
    assert.equal(normalizeOptions({ max_artigos: 99 }).max_artigos, 20);
    assert.equal(validateText(' teste '), 'teste');
    assert.throws(() => validateText('x'.repeat(20001)));
    assert.throws(() => validateText(' '));
});
test('resultado usa allowlist, URLs seguras e N/A para ausência de evidências', () => {
    const normalized = normalizeResult({ ...result, apiKey: 'secret', erros_encontrados: [{ versao_correta: 'correto' }], artigos_relacionados: [{ url: 'javascript:alert(1)' }] });
    assert.equal(normalized.apiKey, undefined);
    assert.equal(normalized.artigos_relacionados[0].url, null);
    assert.equal(normalized.erros_encontrados[0].versao_correta, 'correto');
    assert.equal(normalizeResult({ veredicto: 'NÃO ENCONTRADA NOS SITES', grau_veracidade: 90 }).grau_veracidade, null);
    assert.equal(safeUrl('https://a:b@example.com'), null);
    assert.equal(verdictStyle({ veredicto: 'FALSA' })[2], 'F');
    assert.throws(() => normalizeResult({ veredicto: 'NOVO' }));
});
test('SSE incremental suporta UTF-8, CRLF, comentários e terminal', async () => {
    const events = [];
    await consumeSSE(body(`: heartbeat\r\ndata: {"type":"step","msg":"Apuração"}\r\n\r\ndata: ${JSON.stringify(result)}\r\n\r\n`), event => events.push(event));
    assert.equal(events[0].msg, 'Apuração'); assert.equal(events[1].veredicto, 'VERDADEIRA');
});
test('SSE rejeita JSON inválido e término sem resultado; error é terminal', async () => {
    await assert.rejects(consumeSSE(body('data: lixo\n\n'), () => {}), /inválido/);
    await assert.rejects(consumeSSE(body('data: {"type":"step"}\n\n'), () => {}), /interrompida/);
    const events = []; await consumeSSE(body('data: {"type":"error"}\n\n'), event => events.push(event)); assert.equal(events.length, 1);
});
test('cliente usa uma solicitação de início e um stream, sem chave na URL', async () => {
    const requests = [], events = [];
    const fetchImpl = async (url, options) => {
        requests.push({ url, options });
        if (requests.length === 1) return Response.json({ token: '12345678-1234-1234-1234-123456789012' });
        return new Response(body(`data: ${JSON.stringify(result)}\n\n`), { headers: { 'Content-Type': 'text/event-stream' } });
    };
    await check({ endpoint: 'http://localhost:3000', text: 'Alegação', key: 'gsk_test', onEvent: event => events.push(event), fetchImpl });
    assert.equal(requests.length, 2); assert.equal(events[0].grau_veracidade, 85);
    assert.ok(requests.every(r => !r.url.includes('gsk_')));
    assert.equal(JSON.parse(requests[0].options.body).apiKey, 'gsk_test');
    assert.equal(requests[1].options.body, undefined);
});
test('cliente nunca reconecta ou apresenta mensagem remota com segredo', async () => {
    let count = 0;
    await assert.rejects(check({ endpoint: 'https://example.com', text: 'Texto', key: 'gsk_secret', onEvent() {}, fetchImpl: async () => {
        count++; return new Response('gsk_secret', { status: 401 });
    } }), error => !error.message.includes('gsk_secret') && /rejeitada/.test(error.message));
    assert.equal(count, 1);
});
test('manifests diferenciam background, não pedem acesso permanente à navegação', async () => {
    for (const name of ['chrome', 'firefox']) {
        const manifest = JSON.parse(await readFile(new URL(`../../extension/manifests/${name}.json`, import.meta.url)));
        assert.equal(manifest.manifest_version, name === 'chrome' ? 3 : 2);
        assert.ok(!manifest.host_permissions);
        assert.ok(!manifest.permissions.includes('history'));
        assert.ok(!manifest.permissions.includes('tabs'));
        assert.ok(!manifest.content_scripts);
        assert.ok(!(manifest.content_security_policy.extension_pages || manifest.content_security_policy).includes('unsafe-inline'));
        assert.ok(name === 'chrome' ? manifest.background.service_worker : manifest.background.scripts);
        if (name === 'chrome') assert.ok(manifest.permissions.includes('offscreen'));
        else assert.equal(manifest.background.persistent, true);
    }
});
