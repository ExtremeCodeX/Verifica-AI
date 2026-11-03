import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const extractor = await readFile(new URL('../../extension/content/extract.js', import.meta.url), 'utf8');
const readability = await readFile(new URL('../../node_modules/@mozilla/readability/Readability.js', import.meta.url), 'utf8');
const paragraph = 'Em 2 de novembro de 2026, o relatório registrou 42 ocorrências, mas os pesquisadores ressaltaram que os dados são preliminares e não demonstram uma relação de causa e efeito.';

test('extração editorial compartilhada, sem rede ou credenciais', async t => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const page = await browser.newPage();
    async function extract(html, fallback = false) {
        await page.setContent(`<!doctype html><html lang="pt-BR"><head><title>Portal de teste</title></head><body>${html}</body></html>`);
        await page.addScriptTag({ content: readability });
        if (fallback) await page.evaluate(mode => {
            window.Readability = class { parse() {
                if (mode === 'throw') throw new Error('Falha simulada no parser');
                if (mode === 'incomplete') return { title: 'Título sem evidências', content: '<div><p>Incompleto</p></div>' };
                return null;
            } };
        }, fallback);
        const before = await page.content();
        const result = await page.evaluate(source => eval(source), extractor);
        assert.equal(await page.content(), before, 'A captura não pode alterar o documento original.');
        return result;
    }
    await t.test('preserva título, subtítulo, ressalvas, citações, listas e correções, sem resíduos', async () => {
        const result = await extract(`<nav>MENU_PRIVADO</nav><article><h1>Relatório sobre ocorrências</h1><p class="subtitle">Pesquisa ainda não é conclusiva</p>${`<p>${paragraph}</p>`.repeat(6)}<blockquote>“Não há comprovação definitiva”, afirmou Ana.</blockquote><ul><li>42 registros</li><li>3 regiões</li></ul><p>Correção: o total anterior era 41.</p><p>A publicidade foi objeto do estudo, não um anúncio.</p><div class="comments">${'<p>COMENTARIO_INDEVIDO</p>'.repeat(60)}</div><div class="related-articles"><p>RECOMENDACAO_INDEVIDA</p></div><div class="advertisement">ANUNCIO_INDEVIDO</div><div class="newsletter-signup">ASSINATURA_INDEVIDA</div><p hidden>SEGREDO_OCULTO</p><p style="display:none">SEGREDO_INLINE</p><form><textarea>SEGREDO_FORMULARIO</textarea></form></article><footer>RODAPE_INDEVIDO</footer>`);
        assert.equal(result.method, 'readability');
        for (const text of ['Relatório sobre ocorrências', 'Pesquisa ainda não é conclusiva', paragraph, '“Não há comprovação definitiva”', '42 registros', '3 regiões', 'Correção: o total anterior era 41.', 'A publicidade foi objeto do estudo']) assert.ok(result.text.includes(text), text);
        for (const text of ['MENU_PRIVADO', 'COMENTARIO_INDEVIDO', 'RECOMENDACAO_INDEVIDA', 'ANUNCIO_INDEVIDO', 'ASSINATURA_INDEVIDA', 'SEGREDO_', 'RODAPE_INDEVIDO']) assert.ok(!result.text.includes(text), text);
        assert.equal(result.text.match(/Pesquisa ainda não é conclusiva/g).length, 1);
        assert.equal(result.text.match(/Relatório sobre ocorrências/g).length, 1);
        assert.ok(result.text.includes('\n\n'));
    });
    await t.test('fallback restrito ao artigo preserva texto curto e avisa', async () => {
        const result = await extract(`<div>FORA_DO_ARTIGO</div><article><h1>Notícia curta</h1><p>${paragraph}</p></article>`, true);
        assert.equal(result.method, 'article');
        assert.ok(result.text.includes(paragraph));
        assert.ok(!result.text.includes('FORA_DO_ARTIGO'));
        assert.ok(result.warnings.some(text => text.includes('curto')));
        assert.ok(result.warnings.some(text => text.includes('alternativa')));
    });
    await t.test('não usa body como alternativa e rejeita artigo vazio ou dominado por links', async () => {
        for (const html of [`<div>${paragraph.repeat(4)}</div>`, '<article><h1>Vazio</h1></article>', `<article><a href="https://example.org">${paragraph.repeat(4)}</a></article>`]) {
            const result = await extract(html, true);
            assert.equal(result.method, 'none'); assert.equal(result.text, ''); assert.ok(result.warnings.length);
        }
    });
    await t.test('paywall não inclui conteúdo oculto nem tenta desbloquear', async () => {
        const result = await extract(`<style>.locked { display: none; }</style><article><h1>Artigo restrito</h1><p>${paragraph}</p><div class="paywall">Assine para continuar</div><div hidden>${paragraph.repeat(10)} CONTEUDO_BLOQUEADO</div><div class="locked">CONTEUDO_CSS ${paragraph.repeat(10)}</div></article>`);
        assert.ok(!result.text.includes('CONTEUDO_BLOQUEADO'));
        assert.ok(!result.text.includes('CONTEUDO_CSS'));
        assert.ok(!result.text.includes('Assine para continuar'));
        assert.ok(result.warnings.some(text => text.includes('acesso restrito')));
        const empty = await extract('<article><h1>Artigo restrito</h1><div hidden>CONTEUDO_BLOQUEADO</div></article>');
        assert.equal(empty.text, '');
    });
    await t.test('texto longo não é truncado nem resumido', async () => {
        const result = await extract(`<article><h1>Notícia longa</h1>${`<p>${paragraph}</p>`.repeat(140)}<p>RESSALVA_FINAL: os dados podem ser revisados.</p></article>`);
        assert.ok(result.text.length > 20000);
        assert.ok(result.text.includes('RESSALVA_FINAL'));
        assert.equal(result.text.split(paragraph).length - 1, 140);
    });
    await t.test('captura conteúdo dinâmico disponível no momento da ação', async () => {
        await extract('<article><h1>Carregando</h1></article>');
        await page.evaluate(text => { document.querySelector('article').append(Object.assign(document.createElement('p'), { textContent: text })); }, paragraph);
        const result = await page.evaluate(source => eval(source), extractor);
        assert.ok(result.text.includes(paragraph));
    });
    await t.test('fallback reconhece articleBody sem tag article', async () => {
        const result = await extract(`<h1>Dados públicos</h1><div itemprop="articleBody"><p>${paragraph}</p></div>`, true);
        assert.equal(result.method, 'article'); assert.ok(result.text.includes(paragraph));
        assert.ok(result.text.startsWith('Dados públicos\n\n'));
    });
    await t.test('fallback reconhece role article sem tag article', async () => {
        const result = await extract(`<section role="article"><h1>Apuração regional</h1><p>${paragraph}</p></section>`, true);
        assert.equal(result.method, 'article'); assert.ok(result.text.includes(paragraph));
    });
    await t.test('Readability reconhece corpo editorial sem marcadores semânticos', async () => {
        const result = await extract(`<div class="story"><h1>Relatório documentado</h1>${`<p>${paragraph}</p>`.repeat(8)}</div>`);
        assert.equal(result.method, 'readability'); assert.ok(result.text.includes(paragraph));
    });
    await t.test('vários contêineres: ignora chamada curta e mantém fallback isolado', async () => {
        const result = await extract(`<article><h1>Chamada</h1><p>Leia mais</p></article><article><h1>Notícia principal</h1><p>${paragraph}</p></article><article><h1>Outra notícia</h1><p>${paragraph} OUTRO_ARTIGO</p></article>`, true);
        assert.equal(result.title, 'Notícia principal');
        assert.ok(!result.text.includes('OUTRO_ARTIGO')); assert.ok(!result.text.includes('Chamada'));
    });
    await t.test('preserva tabela de dados com cabeçalhos e valores', async () => {
        const result = await extract(`<article><h1>Balanço regional</h1>${`<p>${paragraph}</p>`.repeat(5)}<table><caption>Registros auditados</caption><thead><tr><th>Região</th><th>Total</th></tr></thead><tbody><tr><td>Norte</td><td>42</td></tr><tr><td>Sul</td><td>17</td></tr></tbody></table></article>`);
        for (const value of ['Registros auditados', 'Região | Total', 'Norte | 42', 'Sul | 17']) assert.ok(result.text.includes(value), value);
    });
    await t.test('preserva intertítulos, percentuais, datas e atualização editorial', async () => {
        const result = await extract(`<article><h1>Balanço atualizado</h1>${`<p>${paragraph}</p>`.repeat(5)}<h2>Limites da pesquisa</h2><p>O índice foi de 12,5%, sem significância estatística.</p><h3>Atualização de 03/11/2026</h3><p>O prazo mudou para 15/12/2026, às 14h30.</p></article>`);
        for (const value of ['Limites da pesquisa', '12,5%', 'sem significância estatística', 'Atualização de 03/11/2026', '15/12/2026, às 14h30']) assert.ok(result.text.includes(value), value);
    });
    await t.test('preserva atribuição e texto de links dentro de citações', async () => {
        const result = await extract(`<article><h1>Análise documental</h1>${`<p>${paragraph}</p>`.repeat(5)}<blockquote>“A hipótese não foi confirmada”, disse <a href="https://example.org/pesquisadora">Maria Silva</a>, segundo o <a href="https://example.org/relatorio">relatório original</a>.</blockquote></article>`);
        assert.ok(result.text.includes('“A hipótese não foi confirmada”, disse Maria Silva, segundo o relatório original.'));
    });
    await t.test('remove publicidade e compartilhamento intercalados sem perder parágrafos', async () => {
        const result = await extract(`<article><h1>Matéria com intervalos</h1><p>ABERTURA_EDITORIAL ${paragraph}</p><div data-ad-slot="banner">BANNER_INTRUSIVO</div><div class="share-buttons">COMPARTILHE_INTRUSIVO</div><p>CONTEXTO_EDITORIAL ${paragraph}</p><div class="recommended-articles"><p>${paragraph.repeat(10)} RECOMENDACAO_INTRUSIVA</p></div><p>CONCLUSAO_EDITORIAL ${paragraph}</p></article>`);
        for (const value of ['ABERTURA_EDITORIAL', 'CONTEXTO_EDITORIAL', 'CONCLUSAO_EDITORIAL']) assert.ok(result.text.includes(value));
        for (const value of ['BANNER_INTRUSIVO', 'COMPARTILHE_INTRUSIVO', 'RECOMENDACAO_INTRUSIVA']) assert.ok(!result.text.includes(value));
    });
    await t.test('aplica CSS externo servido localmente em memória', async () => {
        let stylesheetRequests = 0;
        await page.route('https://fixture.invalid/news.css', route => {
            stylesheetRequests++;
            return route.fulfill({ contentType: 'text/css', body: '.external-hidden { display: none; }' });
        });
        try {
            const result = await extract(`<link rel="stylesheet" href="https://fixture.invalid/news.css"><article><h1>Visibilidade externa</h1><p>${paragraph}</p><div class="external-hidden"><p>${paragraph.repeat(5)} SEGREDO_CSS_EXTERNO</p></div></article>`);
            assert.equal(stylesheetRequests, 1); assert.ok(!result.text.includes('SEGREDO_CSS_EXTERNO'));
            assert.ok(result.text.includes(paragraph));
        } finally { await page.unroute('https://fixture.invalid/news.css'); }
    });
    await t.test('remove descendentes de ancestrais ocultos e aria-hidden', async () => {
        const result = await extract(`<article><h1>Conteúdo visível</h1><p>${paragraph}</p><section style="visibility:hidden"><div><p>SEGREDO_ANCESTRAL ${paragraph.repeat(4)}</p></div></section><section aria-hidden="true"><p>SEGREDO_ARIA ${paragraph.repeat(4)}</p></section><details><summary>Informações recolhidas</summary><p>SEGREDO_RECOLHIDO ${paragraph.repeat(4)}</p></details><details open><summary>Contexto disponível</summary><p>CONTEXTO_ABERTO ${paragraph}</p></details></article>`);
        assert.ok(result.text.includes(paragraph)); assert.ok(!result.text.includes('SEGREDO_'));
        assert.ok(result.text.includes('CONTEXTO_ABERTO'));
    });
    await t.test('exceção do Readability usa fallback sem propagar erro do parser', async () => {
        const result = await extract(`<article><h1>Parser indisponível</h1><p>${paragraph}</p></article>`, 'throw');
        assert.equal(result.method, 'article'); assert.ok(result.text.includes(paragraph));
        assert.ok(result.warnings.every(text => !text.includes('Falha simulada')));
    });
    await t.test('retorno incompleto do Readability é substituído por artigo validado', async () => {
        const result = await extract(`<article><h1>Notícia completa</h1><p>${paragraph}</p></article>`, 'incomplete');
        assert.equal(result.method, 'article'); assert.equal(result.title, 'Notícia completa');
        assert.ok(result.text.includes(paragraph)); assert.ok(!result.text.includes('Incompleto'));
    });
    await t.test('título longo sozinho não é evidência suficiente', async () => {
        const result = await extract(`<article><h1>${paragraph.repeat(4)}</h1></article>`);
        assert.equal(result.method, 'none'); assert.equal(result.text, '');
    });
    await t.test('página de navegação sem notícia não produz conteúdo analisável', async () => {
        const result = await extract(`<nav>${`<a href="https://example.org">${paragraph}</a>`.repeat(12)}</nav><form><textarea>${paragraph}</textarea></form><footer>${paragraph}</footer>`);
        assert.equal(result.method, 'none'); assert.equal(result.text, '');
    });
    await t.test('preserva português, emojis e parágrafos repetidos legítimos', async () => {
        const special = '“Atenção à população”: ação, ciência, R$ 1.234,56 e variação de −2% 📊.';
        const result = await extract(`<article><h1>Ciência e informação 📰</h1>${`<p>${paragraph}</p>`.repeat(5)}<p>${special}</p><p>${special}</p></article>`);
        assert.ok(result.text.startsWith('Ciência e informação 📰'));
        assert.equal(result.text.split(special).length - 1, 2);
    });
    await t.test('sem captura automática de conteúdo carregado após a ação', async () => {
        const initial = await extract(`<article><h1>Apuração em andamento</h1><p>${paragraph}</p></article>`);
        await page.evaluate(() => document.querySelector('article').append(Object.assign(document.createElement('p'), { textContent: 'ATUALIZACAO_POSTERIOR' })));
        assert.ok(!initial.text.includes('ATUALIZACAO_POSTERIOR'));
        const nextCapture = await page.evaluate(source => eval(source), extractor);
        assert.ok(nextCapture.text.includes('ATUALIZACAO_POSTERIOR'));
    });
});
