import { check } from '../shared/client.js';

let controller;
const acknowledgements = new Map();
let sequence = 0;
function eventToHost(id, event) {
    const sequenceId = ++sequence;
    return new Promise((resolve, reject) => {
        acknowledgements.set(sequenceId, { resolve, reject });
        postMessage({ type: 'event', id, event, sequenceId });
    });
}
self.onmessage = async ({ data }) => {
    if (data.type === 'ack') {
        const pending = acknowledgements.get(data.sequenceId);
        acknowledgements.delete(data.sequenceId);
        if (data.error) pending?.reject(new Error(data.error)); else pending?.resolve();
        return;
    }
    if (data.type === 'cancel') { controller?.abort(); return; }
    if (data.type !== 'start') return;
    controller = new AbortController();
    try {
        const task = check({ ...data, signal: controller.signal, onEvent: event => eventToHost(data.id, event) });
        data.key = '';
        await task;
    } catch (error) {
        await eventToHost(data.id, { type: 'failure', msg: error.message }).catch(() => {});
    } finally {
        data.key = ''; controller = null;
        postMessage({ type: 'settled', id: data.id });
    }
};
