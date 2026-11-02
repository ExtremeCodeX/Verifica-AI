import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const output = '/tmp/opencode/verificaai-tests';
await mkdir(output, { recursive: true });
const screenshotDir = path.join(output, 'review');
await mkdir(screenshotDir, { recursive: true });
async function screenshot(page, name) {
    if (process.env.CAPTURE_REVIEW === '0') return;
    await page.evaluate(() => new Promise(resolve => { window.scrollTo(0, 0); document.getElementById('main')?.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
    const clip = page.url().startsWith('chrome-extension:') ? await page.evaluate(() => ({ x: 0, y: 0, width: Math.min(innerWidth, document.documentElement.clientWidth), height: Math.min(innerHeight, document.body.getBoundingClientRect().height) })) : null;
    await page.screenshot({ path: path.join(screenshotDir, name), ...(clip ? { clip } : { fullPage: true }), animations: 'disabled' });
}
const result = {
    type: 'result', veredicto: 'VERDADEIRA', grau_veracidade: 88, resumo: 'As fontes confirmam os fatos centrais. '.repeat(18),
    encontrada_em: ['Agência de exemplo'], partes_corretas: ['Fato confirmado'],
    erros_encontrados: [{ trecho: 'Trecho de teste', problema: 'Contexto faltante', versao_correta: 'Contexto correto' }],
    artigos_relacionados: [{ titulo: '<img src=x onerror=alert(1)> Matéria de teste', fonte: 'Agência de exemplo', url: 'https://example.org/fonte', idioma: 'pt' }, { titulo: 'Contexto documental da alegação', fonte: 'Jornal de exemplo', url: 'https://example.com/contexto', idioma: 'pt' }],
    comparacao_fontes: [{ fonte: 'Agência de exemplo', posicao: 'confirma', resumo_posicao: 'Confirma a data com documentos públicos.' }, { fonte: 'Jornal de exemplo', posicao: 'neutro', resumo_posicao: 'Apresenta contexto histórico sem confirmar todos os detalhes.' }], recomendacao: 'Consulte as fontes.'
};

test('popup completo: fechamento, reinício do service worker, SSE e histórico sem abas', { timeout: 120000 }, async () => {
    let starts = 0, streams = 0, failure = false, delay = 800, holdStream = false;
    const server = http.createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/api/check/start') {
            let body = ''; for await (const part of req) body += part;
            const input = JSON.parse(body); starts++;
            if (input.apiKey !== 'gsk_browser_test') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"erro":"chave"}'); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"token":"12345678-1234-1234-1234-123456789012"}'); return;
        }
        if (pathname.startsWith('/api/check/stream/')) {
            streams++; res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
            res.write('data: {"type":"step","step":1,"msg":"Extraindo termos"}\n\n');
            if (holdStream) return; // O teste de concorrência encerra este stream via cancelamento.
            setTimeout(() => {
                if (failure) { res.end(); return; }
                // Fragmentação intencional, com UTF-8 e múltiplos frames.
                const frame = `data: ${JSON.stringify(result)}\r\n\r\n`;
                res.write(frame.slice(0, 30)); res.end(frame.slice(30));
            }, delay); return;
        }
        if (pathname === '/article' || pathname === '/another') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html lang="pt"><head><title>Matéria pública de teste</title></head><body><article><h1>Uma notícia verificável</h1>${'<p>Uma alegação pública sobre o Brasil e sua história contém detalhes documentais, datas e fontes independentes para comparação factual. Este conteúdo é sintético e existe somente para testar a captura da extensão.</p>'.repeat(12)}</article><form><input value="PRIVATE_FORM_DATA"></form></body></html>`); return;
        }
        let file = pathname.startsWith('/static/') ? pathname.slice(1) : `templates/${({ '/': 'index', '/resultado': 'resultado', '/historico': 'historico' })[pathname]}.html`;
        if (file.includes('..')) { res.writeHead(404); res.end(); return; }
        try {
            const content = await readFile(path.join(root, file));
            res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8' }); res.end(content);
        } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const temp = await mkdtemp(path.join(output, 'run-'));
    const extension = path.join(temp, 'extension');
    await cp(path.join(root, 'dist/extension/chrome'), extension, { recursive: true });
    // Apenas a cópia isolada de teste recebe a permissão do servidor simulado.
    const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
    let context;
    try {
        context = await chromium.launchPersistentContext(path.join(temp, 'profile'), {
            executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
            args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
        });
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
        await worker.evaluate(async endpoint => {
            await chrome.storage.local.set({ settings: { endpoint, temporary: true, options: { max_artigos: 3 } } });
        }, endpoint);

        const site = await context.newPage();
        await site.goto(endpoint); await site.locator('#apiKeyModal').waitFor({ state: 'visible' });
        await site.locator('#apiKeyTemporary').check();
        assert.equal(await site.locator('#apiKeyInput').isDisabled(), true);
        await site.locator('#apiKeySave').click();
        await site.locator('#inputSearch').fill('O Brasil sediou a Copa do Mundo de 2014.');
        await site.evaluate(() => buscar());
        await site.waitForURL('**/resultado');
        await site.locator('#apiKeyInput').fill('gsk_browser_test');
        await site.locator('#apiKeySave').click();
        await site.locator('#verdictLabel').filter({ hasText: 'Factual / Verídica' }).waitFor();
        assert.equal(await site.evaluate(() => localStorage.getItem('groq_api_key')), null);
        assert.ok(!(await site.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes('gsk_browser_test'));
        await screenshot(site, 'site-key-desktop.png');
        await site.setViewportSize({ width: 390, height: 844 });
        await site.evaluate(() => openApiKeyModal());
        await screenshot(site, 'site-key-mobile.png');

        const article = await context.newPage(); await article.goto(`${endpoint}/article`);
        const sourceTab = await worker.evaluate(async endpoint => (await chrome.tabs.query({})).find(tab => tab.url === `${endpoint}/article`), endpoint);
        const popup = await context.newPage(); await popup.goto(`${extensionOrigin}/popup/index.html`);
        await popup.setViewportSize({ width: 580, height: 520 });
        await popup.evaluate(() => document.fonts.ready);
        await screenshot(popup, 'popup-home.png');
        const tabsBefore = await worker.evaluate(async () => (await chrome.tabs.query({})).length);
        const capture = await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: 'capture', tabId, mode: 'page' }), sourceTab.id);
        assert.equal(capture.ok, true, capture.error);
        await popup.locator('#review').waitFor({ state: 'visible' });
        assert.ok((await popup.locator('#text').inputValue()).includes('alegação pública'));
        assert.ok(!(await popup.locator('#text').inputValue()).includes('PRIVATE_FORM_DATA'));
        assert.equal(await worker.evaluate(async () => (await chrome.tabs.query({})).length), tabsBefore);
        await screenshot(popup, 'popup-review.png');
        assert.ok(await popup.locator('#start').evaluate(button => {
            const rect = button.getBoundingClientRect(), main = document.getElementById('main').getBoundingClientRect();
            return rect.bottom <= main.bottom + 1;
        }), 'A confirmação deve aparecer na prévia sem rolagem inicial.');
        await popup.locator('#api-key').fill('gsk_browser_test');
        await popup.locator('#start').click();
        await popup.locator('#progress').waitFor({ state: 'visible' });
        await screenshot(popup, 'popup-progress.png');
        await popup.close();
        const popupAgain = await context.newPage(); await popupAgain.goto(`${extensionOrigin}/popup/index.html`);
        await popupAgain.setViewportSize({ width: 580, height: 520 });
        await popupAgain.locator('#result .verdict-card.verdadeira').waitFor();
        assert.equal(starts, 2); assert.equal(streams, 2);
        assert.equal(await worker.evaluate(async () => (await chrome.tabs.query({})).length), tabsBefore);
        assert.equal(await popupAgain.locator('#api-key').inputValue(), '');
        const storage = await worker.evaluate(() => chrome.storage.local.get(null));
        assert.equal(storage.groq_api_key, undefined); assert.ok(!JSON.stringify(storage).includes('gsk_browser_test'));
        await popupAgain.waitForFunction(async () => (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length === 0);
        assert.ok(storage.jobs[0].result.erros_encontrados[0].versao_correta);
        assert.equal(await popupAgain.locator('#result img').count(), 0);
        assert.ok((await popupAgain.locator('#result').textContent()).includes('<img src=x'));
        await popupAgain.evaluate(() => document.fonts.ready);
        const typefaces = await popupAgain.evaluate(() => ({
            body: getComputedStyle(document.body).fontFamily,
            heading: getComputedStyle(document.querySelector('.verdict-label')).fontFamily,
            score: getComputedStyle(document.querySelector('.verdict-score')).fontFamily,
            loaded: document.fonts.check('400 17px "Source Serif Pro"') && document.fonts.check('600 32px "Newsreader"') && document.fonts.check('500 32px "IBM Plex Mono"')
        }));
        assert.ok(typefaces.body.includes('Source Serif Pro')); assert.ok(typefaces.heading.includes('Newsreader')); assert.ok(typefaces.score.includes('IBM Plex Mono')); assert.equal(typefaces.loaded, true);
        await screenshot(popupAgain, 'popup-result.png');
        const compact = await popupAgain.evaluate(() => ({ height: document.body.getBoundingClientRect().height, pageScroll: document.documentElement.scrollHeight > innerHeight, mainScroll: document.getElementById('main').scrollHeight - document.getElementById('main').clientHeight }));
        assert.ok(compact.height <= 520 && !compact.pageScroll, 'O popup deve ter altura limitada e apenas rolagem interna.');
        assert.ok(compact.mainScroll <= 2, `Resumo inicial deve caber sem rolagem longa (excesso ${compact.mainScroll}px).`);
        const expand = popupAgain.locator('button[aria-controls="result-summary"]');
        await expand.click(); assert.equal(await expand.getAttribute('aria-expanded'), 'true');
        assert.equal(await popupAgain.locator('#result-summary').textContent(), result.resumo);
        await popupAgain.getByRole('button', { name: 'Recolher resumo' }).click();
        await popupAgain.getByRole('tab', { name: 'Fontes', exact: true }).click();
        assert.equal(await popupAgain.locator('#panel-sources .artigo-link').count(), 2);
        await popupAgain.getByRole('tab', { name: 'Comparar', exact: true }).click();
        assert.equal(await popupAgain.locator('.comparacao-coluna').count(), 2);
        await screenshot(popupAgain, 'popup-comparison.png');
        await popupAgain.getByRole('tab', { name: 'Comparar', exact: true }).press('ArrowRight');
        await popupAgain.getByRole('tabpanel', { name: 'Detalhes' }).waitFor({ state: 'visible' });
        await popupAgain.locator('summary').filter({ hasText: 'Conteúdo enviado' }).click();
        assert.ok((await popupAgain.locator('.input-text').textContent()).includes('alegação pública'));
        await popupAgain.setViewportSize({ width: 580, height: 520 });
        const countBefore = starts;
        await popupAgain.locator('#nav-history').click();
        await popupAgain.locator('#history button').filter({ hasText: 'Abrir análise' }).first().click();
        await popupAgain.locator('#result .verdict-card').waitFor();
        assert.equal(starts, countBefore);
        const badge = await worker.evaluate(tabId => chrome.action.getBadgeText({ tabId }), sourceTab.id);
        assert.equal(badge, 'V');
        await article.goto(`${endpoint}/another`);
        assert.equal(await worker.evaluate(tabId => chrome.action.getBadgeText({ tabId }), sourceTab.id), '');

        // Modo persistente, migração para temporário, histórico e limpeza.
        const options = popupAgain;
        await options.locator('#nav-settings').click();
        await options.locator('#temporary').uncheck(); await options.locator('#key').fill('gsk_browser_test');
        await options.locator('#settings button[type="submit"]').click();
        await options.locator('#status').filter({ hasText: 'Preferências salvas' }).waitFor();
        assert.equal((await worker.evaluate(() => chrome.storage.local.get('groq_api_key'))).groq_api_key, 'gsk_browser_test');
        await options.locator('#temporary').check(); await options.locator('#settings button[type="submit"]').click();
        await options.locator('#key-status').filter({ hasText: 'Nenhuma chave salva' }).waitFor();
        assert.equal((await worker.evaluate(() => chrome.storage.local.get('groq_api_key'))).groq_api_key, undefined);
        await screenshot(options, 'popup-settings.png');

        // Seleção literal e falha de SSE não se tornam veredito.
        const selected = await popupAgain.evaluate(tabId => chrome.runtime.sendMessage({ type: 'capture', tabId, mode: 'selection' }), sourceTab.id);
        assert.equal(selected.ok, true);
        const second = popupAgain; await second.locator('#review').waitFor({ state: 'visible' });
        await second.locator('#text').fill('Alegação selecionada'); await second.locator('#api-key').fill('gsk_browser_test');
        failure = true;
        await second.locator('#start').click();
        await second.locator('#retry').waitFor({ state: 'visible' });
        assert.ok((await second.locator('#status').textContent()).includes('interrompida'));
        assert.equal(await second.locator('#result .verdict-card').count(), 0);

        // Seleção real, cliques repetidos e limite de concorrência.
        failure = false; holdStream = true;
        const selectedText = await article.evaluate(() => {
            const range = document.createRange(); range.selectNodeContents(document.querySelector('article p'));
            const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); return selection.toString();
        });
        const thirdJob = await popupAgain.evaluate(tabId => chrome.runtime.sendMessage({ type: 'capture', tabId, mode: 'selection' }), sourceTab.id);
        const third = popupAgain; await third.locator('#review').waitFor({ state: 'visible' });
        assert.equal(await third.locator('#text').inputValue(), selectedText);
        await third.locator('#api-key').fill('gsk_browser_test');
        await third.evaluate(() => { document.getElementById('review').requestSubmit(); document.getElementById('review').requestSubmit(); });
        await third.locator('#progress').waitFor({ state: 'visible' });
        await third.locator('#progress-detail').filter({ hasText: 'Extraindo termos' }).waitFor();
        const startsWithThird = starts;
        const fourthJob = await popupAgain.evaluate(tabId => chrome.runtime.sendMessage({ type: 'capture', tabId, mode: 'page' }), sourceTab.id);
        const fourth = popupAgain; await fourth.locator('#review').waitFor({ state: 'visible' });
        await fourth.locator('#api-key').fill('gsk_browser_test'); await fourth.locator('#start').click();
        await fourth.locator('#status').filter({ hasText: 'Já existe uma verificação' }).waitFor();
        assert.equal(starts, startsWithThird);
        await popupAgain.evaluate(id => chrome.runtime.sendMessage({ type: 'cancel', id }), thirdJob.data);
        await popupAgain.waitForFunction(async id => (await chrome.storage.local.get('jobs')).jobs.find(job => job.id === id)?.status === 'error', thirdJob.data);

        // O executor deve sobreviver até ao encerramento do service worker MV3.
        holdStream = false; delay = 2200;
        await fourth.locator('#api-key').fill('gsk_browser_test'); await fourth.locator('#start').click();
        await fourth.locator('#progress').waitFor({ state: 'visible' });
        await fourth.locator('#progress-detail').filter({ hasText: 'Extraindo termos' }).waitFor();
        const startsBeforeWorkerRestart = starts;
        await fourth.close();
        const cdp = await context.newCDPSession(article);
        await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers'); await cdp.detach();
        const restored = await context.newPage(); await restored.goto(`${extensionOrigin}/popup/index.html`);
        await restored.setViewportSize({ width: 580, height: 520 });
        await restored.locator('#result .verdict-card.verdadeira').waitFor();
        assert.equal(starts, startsBeforeWorkerRestart);
        assert.equal((await restored.evaluate(() => chrome.storage.local.get('jobs'))).jobs.find(job => job.id === fourthJob.data).status, 'done');
        assert.ok(!JSON.stringify(await restored.evaluate(() => chrome.storage.local.get(null))).includes('gsk_browser_test'));

        // Tema escuro e painel compacto, segunda captura visual de confirmação.
        await restored.locator('#nav-settings').click();
        await restored.locator('summary').filter({ hasText: 'Pesquisa avançada' }).click();
        await restored.locator('#theme').selectOption('dark'); await restored.locator('#settings button[type="submit"]').click();
        await restored.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        await screenshot(restored, 'popup-settings-dark.png');

        await restored.locator('#nav-history').click(); await screenshot(restored, 'popup-history-dark.png');
        restored.on('dialog', dialog => dialog.accept());
        await restored.locator('#clear').click();
        await restored.locator('#history').filter({ hasText: 'Nenhuma análise salva' }).waitFor();
        assert.equal((await restored.evaluate(() => chrome.storage.local.get('jobs'))).jobs.length, 0);
    } finally { await context?.close(); await new Promise(resolve => server.close(resolve)); }
});
