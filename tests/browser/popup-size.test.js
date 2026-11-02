import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Abrir popup/index.html numa aba com viewport fixo NÃO testa o autosizing real.
test('popup aberto pelo ícone tem dimensões reais e logo visível', { timeout: 45000 }, async () => {
    const temporary = '/tmp/opencode/verificaai-tests';
    await mkdir(temporary, { recursive: true });
    const extension = path.join(process.cwd(), 'dist/extension/chrome');
    const context = await chromium.launchPersistentContext(await mkdtemp(path.join(temporary, 'real-popup-')), {
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
        args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    try {
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        await worker.evaluate(() => chrome.action.openPopup());
        const cdp = await context.newCDPSession(context.pages()[0]);
        const target = (await cdp.send('Target.getTargets')).targetInfos.find(item => item.url.endsWith('/popup/index.html'));
        assert.ok(target, 'O botão deve abrir o popup nativo da extensão.');
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
        let sequence = 0;
        const requests = new Map();
        cdp.on('Target.receivedMessageFromTarget', event => {
            if (event.sessionId !== sessionId) return;
            const message = JSON.parse(event.message);
            const pending = requests.get(message.id);
            if (pending) { requests.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result); }
        });
        async function command(method, params = {}) {
            const id = ++sequence;
            const response = new Promise((resolve, reject) => requests.set(id, { resolve, reject }));
            await cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) });
            return response;
        }
        async function evaluate(expression) {
            const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
            return response.result.value;
        }
        // Esperar layout real e inicialização, sem alterar viewport via Emulation.
        const ready = `async () => { await document.fonts.ready; await new Promise(resolve => {
            if (document.documentElement.dataset.view) return resolve();
            const observer = new MutationObserver(() => { if (document.documentElement.dataset.view) { observer.disconnect(); resolve(); } });
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-view'] });
        }); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }`;
        await evaluate(`(${ready})()`);
        const measure = `(() => {
            const logo = document.querySelector('.brand-logo'), rect = logo.getBoundingClientRect();
            return { width: innerWidth, height: innerHeight, bodyWidth: document.body.getBoundingClientRect().width, logoLoaded: logo.complete && logo.naturalWidth > 0,
                logoVisible: rect.width > 80 && rect.height > 20 && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
                footerVisible: document.querySelector('footer').getBoundingClientRect().bottom <= innerHeight + 1 };
        })()`;
        const home = await evaluate(measure);
        assert.equal(home.width, 580, JSON.stringify(home));
        assert.equal(home.bodyWidth, home.width, 'Não deve existir faixa vazia entre o corpo e a borda da janela.');
        assert.equal(home.height, 360, JSON.stringify(home));
        assert.ok(home.logoLoaded && home.logoVisible && home.footerVisible, JSON.stringify(home));
        if (process.env.CAPTURE_REVIEW !== '0') {
            const screenshot = await command('Page.captureScreenshot', { format: 'png' });
            await mkdir(path.join(temporary, 'review'), { recursive: true });
            await writeFile(path.join(temporary, 'review/popup-native-home.png'), Buffer.from(screenshot.data, 'base64'));
        }
        // Uma segunda tela deve redimensionar a mesma janela, sem abas ou foco extra.
        await evaluate(`document.getElementById('nav-settings').click()`);
        await evaluate(`new Promise((resolve, reject) => { const deadline = Date.now() + 5000; const check = () => {
            const footer = document.querySelector('footer').getBoundingClientRect();
            if (document.documentElement.dataset.view === 'settings' && innerWidth === 580 && innerHeight >= 300 && innerHeight <= 520 && footer.bottom <= innerHeight + 1) resolve();
            else if (Date.now() > deadline) reject(new Error('Popup sem layout estável: ' + JSON.stringify({ width: innerWidth, height: innerHeight, footer: footer.bottom })));
            else requestAnimationFrame(check);
        }; check(); })`);
        const settings = await evaluate(measure);
        assert.equal(settings.width, 580, JSON.stringify(settings));
        assert.equal(settings.bodyWidth, settings.width, 'As configurações devem ocupar toda a largura do popup.');
        assert.ok(settings.height >= 300 && settings.height <= 520, JSON.stringify(settings));
        assert.ok(settings.logoLoaded && settings.logoVisible && settings.footerVisible, JSON.stringify(settings));
        if (process.env.CAPTURE_REVIEW !== '0') {
            const screenshot = await command('Page.captureScreenshot', { format: 'png' });
            await writeFile(path.join(temporary, 'review/popup-native-settings.png'), Buffer.from(screenshot.data, 'base64'));
        }
        await cdp.detach();
    } finally { await context.close(); }
});
