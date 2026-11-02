import { api, restrictStorage } from './browser.js';
import { OFFICIAL_ENDPOINT, normalizeEndpoint, normalizeOptions } from './core.js';

export async function settings() {
    const { settings: stored } = await api.storage.local.get('settings');
    return { endpoint: OFFICIAL_ENDPOINT, temporary: false, theme: 'system', ...stored, options: normalizeOptions(stored?.options) };
}

export async function saveSettings(value, key = '') {
    await restrictStorage();
    const next = { endpoint: normalizeEndpoint(value.endpoint), temporary: value.temporary === true, theme: ['light', 'dark'].includes(value.theme) ? value.theme : 'system', options: normalizeOptions(value.options) };
    if (next.temporary) await api.storage.local.remove('groq_api_key');
    else if (key) {
        if (!key.startsWith('gsk_')) throw new Error('A chave Groq deve começar com gsk_.');
        await api.storage.local.set({ groq_api_key: key });
    }
    await api.storage.local.set({ settings: next });
    return next;
}

export async function savedKey() {
    if ((await settings()).temporary) return '';
    return (await api.storage.local.get('groq_api_key')).groq_api_key || '';
}
