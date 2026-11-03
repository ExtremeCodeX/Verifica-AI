import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const defaultArticle = '<article><h1>Matéria para revisão</h1><p>O levantamento público documentou 42 ocorrências no período, com dados preliminares e ressalvas sobre a metodologia. Os resultados ainda precisam de confirmação independente.</p></article>';
const verdict = { type: 'result', veredicto: 'VERDADEIRA', grau_veracidade: 88, resumo: 'Resultado sintético para testar o envio.' };

test('prévia e limites da extensão, com API e permissões simuladas', { timeout: 120000 }, async t => {
    let articleHtml = defaultArticle, requests = [];
    // Servidor efêmero restrito ao loopback: o worker offscreen usa HTTP real,
    // mas nunca acessa um portal, uma API externa ou credenciais reais.
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/check/start') {
            let body = ''; for await (const part of req) body += part;
            requests.push(JSON.parse(body));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token: '12345678-1234-1234-1234-123456789012' }));
        } else if (url.pathname.startsWith('/api/check/stream/')) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.end(`data: ${JSON.stringify(verdict)}\n\n`);
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html lang="pt-BR"><head><title>Teste local</title></head><body>${articleHtml}</body></html>`);
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const output = '/tmp/opencode/verificaai-tests';
    await mkdir(output, { recursive: true });
    const temp = await mkdtemp(path.join(output, 'review-'));
    const extension = path.join(temp, 'extension');
    await cp(path.resolve('dist/extension/chrome'), extension, { recursive: true });
    const manifestPath = path.join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    // Só a cópia isolada recebe permissão para o endpoint fictício dos testes.
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(manifestPath, JSON.stringify(manifest));
    const context = await chromium.launchPersistentContext(path.join(temp, 'profile'), {
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
        args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    t.after(() => context.close());
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const origin = `chrome-extension://${new URL(worker.url()).host}`;
    async function completed(popup) {
        await popup.locator('#result .verdict-card.verdadeira').waitFor({ timeout: 10000 }).catch(async error => {
            const jobs = await worker.evaluate(async () => (await chrome.storage.local.get('jobs')).jobs.map(({ status, error }) => ({ status, error })));
            assert.fail(`${error.message}\nEstado: ${JSON.stringify(jobs)}\nMensagem: ${await popup.locator('#status').textContent()}`);
        });
    }
    async function setup(subtest, html = defaultArticle) {
        articleHtml = html; requests = [];
        await worker.evaluate(async endpoint => {
            await chrome.storage.local.set({ jobs: [], ui: { view: 'search' }, settings: { endpoint, temporary: true, options: { max_artigos: 3 } } });
            await chrome.storage.local.remove('groq_api_key');
        }, endpoint);
        const source = await context.newPage(); await source.goto(`${endpoint}/article`);
        const tabId = await worker.evaluate(async endpoint => (await chrome.tabs.query({})).find(tab => tab.url === `${endpoint}/article`).id, endpoint);
        const popup = await context.newPage(); await popup.goto(`${origin}/popup/index.html`);
        subtest.after(async () => { await popup.close(); await source.close(); });
        async function capture(mode = 'page') {
            const response = await popup.evaluate(({ tabId, mode }) => chrome.runtime.sendMessage({ type: 'capture', tabId, mode }), { tabId, mode });
            assert.equal(response.ok, true, response.error);
            await popup.locator('#review').waitFor({ state: 'visible' });
            const job = await popup.evaluate(id => chrome.runtime.sendMessage({ type: 'get', id }), response.data);
            assert.equal(job.ok, true); return job.data;
        }
        return { source, popup, capture };
    }
    await t.test('seleção manual mantém espaços, quebras, citações e texto excluído pelo modo página', async subtest => {
        const literal = '  “A notícia é preliminar” — Ana.\n\n42 registros; ressalva final.  ';
        const { source, popup, capture } = await setup(subtest, `<article><h1>Seleção</h1></article><pre class="advertisement" contenteditable="true">${literal}</pre>`);
        const selected = await source.evaluate(() => {
            const range = document.createRange(); range.selectNodeContents(document.querySelector('pre'));
            const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            return selection.toString();
        });
        assert.equal(selected, literal);
        const job = await capture('selection');
        assert.equal(job.text, literal); assert.equal(job.extraction.method, 'selection');
        assert.equal(await popup.locator('#text').inputValue(), literal);
        assert.equal(requests.length, 0);
    });
    await t.test('aceita exatamente 20.000 unidades UTF-16 e envia a prévia integral', async subtest => {
        const { popup, capture } = await setup(subtest);
        const job = await capture();
        const prefix = 'Ciência 📰\n\n“Dados preliminares”: ';
        const text = prefix + 'x'.repeat(20000 - prefix.length);
        await popup.locator('#text').fill(text); await popup.locator('#api-key').fill('gsk_browser_test');
        await popup.locator('#start').click();
        await completed(popup);
        assert.equal(requests.length, 1); assert.equal(requests[0].noticia, text);
        const stored = await worker.evaluate(async id => (await chrome.storage.local.get('jobs')).jobs.find(item => item.id === id), job.id);
        assert.equal(stored.text, text); assert.equal(stored.status, 'done');
    });
    await t.test('rejeita 20.001 unidades UTF-16 com emojis sem cortar ou enviar', async subtest => {
        const { popup, capture } = await setup(subtest);
        const job = await capture();
        const text = '😀'.repeat(10000) + '!';
        await popup.locator('#text').fill(text);
        await popup.locator('#start').click();
        await popup.locator('#status').filter({ hasText: 'O limite é de 20.000' }).waitFor();
        assert.equal(await popup.locator('#text').inputValue(), text); assert.equal(requests.length, 0);
        await popup.waitForFunction(async ({ id, text }) => (await chrome.storage.local.get('jobs')).jobs.find(item => item.id === id)?.text === text, { id: job.id, text });
    });
    await t.test('captura acima de 500.000 caracteres exige trecho manual sem truncamento', async subtest => {
        const { popup, capture } = await setup(subtest, `<article><h1>Matéria muito extensa</h1><p>${'x'.repeat(500001)}</p></article>`);
        const job = await capture();
        assert.equal(job.text, ''); assert.match(job.notice, /Página grande demais/);
        await popup.locator('#notice').filter({ hasText: 'Página grande demais' }).waitFor();
        assert.equal(await popup.locator('#text').inputValue(), ''); assert.equal(requests.length, 0);
    });
    await t.test('edição persiste ao reabrir popup sem iniciar análise automaticamente', async subtest => {
        const { popup, capture } = await setup(subtest);
        const job = await capture();
        const text = 'Trecho revisado pelo leitor.\n\nA ressalva e os números 42 e 12,5% precisam ser mantidos.';
        await popup.locator('#text').fill(text);
        await popup.waitForFunction(async ({ id, text }) => (await chrome.storage.local.get('jobs')).jobs.find(item => item.id === id)?.text === text, { id: job.id, text });
        await popup.close();
        const reopened = await context.newPage(); subtest.after(() => reopened.close());
        await reopened.goto(`${origin}/popup/index.html`);
        await reopened.locator('#review').waitFor({ state: 'visible' });
        assert.equal(await reopened.locator('#text').inputValue(), text); assert.equal(requests.length, 0);
    });
    await t.test('mudança durante pedido de permissão bloqueia envio até nova confirmação', async subtest => {
        const { popup, capture } = await setup(subtest);
        await capture(); await popup.locator('#api-key').fill('gsk_browser_test');
        await popup.evaluate(() => {
            chrome.permissions.request = () => new Promise(resolve => { window.resolvePermission = resolve; });
        });
        await popup.locator('#start').click();
        await popup.waitForFunction(() => typeof window.resolvePermission === 'function');
        const revised = 'Texto alterado durante a autorização, preservando a ressalva.';
        await popup.locator('#text').fill(revised);
        await popup.evaluate(() => window.resolvePermission(true));
        await popup.locator('#status').filter({ hasText: 'A prévia foi alterada' }).waitFor();
        assert.equal(requests.length, 0); assert.equal(await popup.locator('#text').inputValue(), revised);
        await popup.evaluate(() => { chrome.permissions.request = async () => true; });
        await popup.locator('#api-key').fill('gsk_browser_test'); await popup.locator('#start').click();
        await completed(popup);
        assert.equal(requests.length, 1); assert.equal(requests[0].noticia, revised);
    });
});
