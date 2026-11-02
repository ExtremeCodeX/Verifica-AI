import test from 'node:test';
import assert from 'node:assert/strict';

const stored = {};
let restriction;
globalThis.chrome = { storage: { local: {
    async get(key) { return { [key]: stored[key] }; },
    async set(value) { Object.assign(stored, structuredClone(value)); },
    async remove(key) { delete stored[key]; },
    async setAccessLevel(value) { restriction = value; }
} } };
const { settings, saveSettings, savedKey } = await import('../../extension/shared/settings.js');

test('extensão remove segredo persistido ao confirmar modo temporário e restringe storage', async () => {
    const config = await settings();
    await saveSettings({ ...config, temporary: false }, 'gsk_persistent');
    assert.equal(await savedKey(), 'gsk_persistent');
    await saveSettings({ ...config, temporary: true }, 'gsk_temporary');
    assert.equal(await savedKey(), ''); assert.equal(stored.groq_api_key, undefined);
    assert.ok(!JSON.stringify(stored).includes('gsk_'));
    assert.deepEqual(restriction, { accessLevel: 'TRUSTED_CONTEXTS' });
});
test('extensão não persiste propriedades inesperadas nas preferências', async () => {
    await saveSettings({ endpoint: 'https://example.org', temporary: true, apiKey: 'gsk_unexpected', options: { key: 'gsk_unknown' } });
    assert.ok(!JSON.stringify(stored).includes('gsk_'));
});
