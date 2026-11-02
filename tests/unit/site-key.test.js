import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const code = await readFile(new URL('../../static/script/script.js', import.meta.url), 'utf8');
function page(pathname, stored = {}) {
    const values = new Map(Object.entries(stored));
    const nodes = Object.fromEntries(['apiKeyInput', 'apiKeyTemporary', 'apiKeySave', 'apiKeyPrivacy', 'apiKeyModal'].map(id => [id, { value: '', checked: false, style: {}, focus() {}, addEventListener() {} }]));
    const context = vm.createContext({
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) },
        document: { documentElement: { setAttribute() {} }, getElementById: id => nodes[id], querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
        window: { location: { pathname } }, alert(message) { throw new Error(message); }
    });
    vm.runInContext(code, context);
    return { context, nodes, values };
}
test('site temporário remove chave persistida e mantém segredo apenas em memória', () => {
    const { context, nodes, values } = page('/resultado', { groq_api_key: 'gsk_old' });
    nodes.apiKeyInput.value = 'gsk_temporary'; nodes.apiKeyTemporary.checked = true;
    context.saveApiKey();
    assert.equal(context.getApiKey(), 'gsk_temporary'); assert.equal(values.has('groq_api_key'), false);
    assert.ok(!JSON.stringify([...values]).includes('gsk_')); assert.equal(nodes.apiKeyInput.value, '');
    const reload = page('/resultado', Object.fromEntries(values)); assert.equal(reload.context.getApiKey(), '');
});
test('site adia chave para resultado sem serializar segredo entre páginas', () => {
    const { context, nodes, values } = page('/', { groq_api_key: 'gsk_old' });
    nodes.apiKeyTemporary.checked = true;
    context.updateApiKeyMode(); assert.equal(nodes.apiKeyInput.disabled, true);
    context.saveApiKey(); assert.equal(context.getApiKey(), '');
    assert.equal(values.has('groq_api_key'), false); assert.equal(values.get('groq_key_temporary'), 'true');
});
test('site mantém compatibilidade do modo persistente', () => {
    const { context, nodes, values } = page('/resultado'); nodes.apiKeyInput.value = 'gsk_persistent';
    context.saveApiKey(); assert.equal(values.get('groq_api_key'), 'gsk_persistent'); assert.equal(context.getApiKey(), 'gsk_persistent');
});
