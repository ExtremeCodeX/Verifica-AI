export const api = globalThis.browser || globalThis.chrome;
export const action = api.action || api.browserAction;
export const send = message => api.runtime.sendMessage(message).then(response => {
    if (!response?.ok) throw new Error(response?.error || 'Não foi possível acessar a extensão.');
    return response.data;
});

export async function restrictStorage() {
    if (api.storage.local.setAccessLevel) await api.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}
