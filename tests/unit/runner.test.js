import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../extension/runner/host.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
class FakeWorker {
    static latest;
    constructor() { FakeWorker.latest = this; this.messages = []; }
    postMessage(message) { this.messages.push(structuredClone(message)); }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage({ data }); }
}
globalThis.Worker = FakeWorker;

test('executor mantém job fora do popup e elimina referência à chave do payload', async () => {
    const events = [], settled = [];
    const runner = createRunner((id, event) => events.push({ id, event }), id => settled.push(id));
    const payload = { id: 'job', key: 'gsk_fake', text: 'Texto público' };
    runner.start(payload);
    const worker = FakeWorker.latest;
    assert.equal(payload.key, ''); assert.deepEqual(runner.activeIds(), ['job']);
    assert.equal(worker.messages[0].key, 'gsk_fake');
    assert.throws(() => runner.start({ id: 'duplicate' }), /execução/);
    worker.emit({ type: 'event', id: 'job', sequenceId: 1, event: { type: 'step', step: 1 } });
    await tick();
    assert.equal(events.length, 1); assert.equal(worker.messages[1].type, 'ack');
    runner.cancel('job'); assert.equal(worker.messages[2].type, 'cancel');
    worker.emit({ type: 'settled', id: 'job' }); await tick();
    assert.equal(worker.terminated, true); assert.deepEqual(runner.activeIds(), []); assert.deepEqual(settled, ['job']);
});
test('executor propaga falha de persistência sem confirmar evento perdido', async () => {
    const runner = createRunner(() => { throw new Error('storage'); }, () => {});
    runner.start({ id: 'job' }); const worker = FakeWorker.latest;
    worker.emit({ type: 'event', id: 'job', sequenceId: 7, event: { type: 'result' } }); await tick();
    assert.ok(worker.messages[1].error); assert.equal(worker.messages[1].sequenceId, 7);
});
test('falha do worker encerra executor e gera erro técnico, não um veredito', async () => {
    const events = [], settled = [];
    const runner = createRunner((id, event) => events.push(event), id => settled.push(id));
    runner.start({ id: 'job' }); FakeWorker.latest.onerror(); await tick();
    assert.equal(events[0].type, 'failure'); assert.equal(events[0].veredicto, undefined);
    assert.deepEqual(runner.activeIds(), []); assert.deepEqual(settled, ['job']);
});
test('falha ao criar worker não bloqueia análises futuras nem retém chave no payload', () => {
    globalThis.Worker = class { constructor() { throw new Error('CSP'); } };
    const runner = createRunner(() => {}, () => {});
    const payload = { id: 'job', key: 'gsk_fake' };
    try { assert.throws(() => runner.start(payload), /criar o executor/); assert.deepEqual(runner.activeIds(), []); assert.equal(payload.key, ''); }
    finally { globalThis.Worker = FakeWorker; }
});
