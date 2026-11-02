import { settings } from './settings.js';
import { safeUrl } from './core.js';

export const $ = id => document.getElementById(id);
export function element(tag, text, className) {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className;
    return node;
}
export async function applyTheme() {
    const { theme } = await settings();
    document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
}
function card(title, className = 'resumo-card') {
    const section = element('section', '', className); section.append(element('h3', title)); return section;
}
function articleLink(article) {
    const url = safeUrl(article.url);
    const link = element(url ? 'a' : 'div', '', 'artigo-link');
    if (url) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    link.append(element('span', `${article.idioma ? `[${article.idioma.toUpperCase()}] ` : ''}${article.fonte || 'Fonte'}`, 'artigo-fonte'), element('span', article.titulo || 'Matéria consultada', 'artigo-titulo'));
    return link;
}
export function renderResult(result, container, inputText = '') {
    container.replaceChildren();
    const verdicts = { VERDADEIRA: ['verdadeira', 'Factual / Verídica'], FALSA: ['falsa', 'Falsa / Invenção'], 'PARCIALMENTE VERDADEIRA': ['parcial', 'Parcialmente Verdadeira'] };
    const [style, label] = verdicts[result.veredicto] || ['nao-encontrada', 'Dados Insuficientes'];
    const verdict = element('section', '', `verdict-card ${style}`);
    const info = element('div', '', 'verdict-info');
    info.append(element('h2', label, 'verdict-label'), element('p', 'Grau de Veracidade Factual', 'verdict-sub'));
    verdict.append(element('div', result.grau_veracidade == null ? 'N/A' : `${result.grau_veracidade}%`, 'verdict-score'), info);
    container.append(verdict);
    const tablist = element('div', '', 'result-tabs'); tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', 'Seções da análise');
    const sections = [['overview', 'Resumo'], ['sources', 'Fontes'], ['comparison', 'Comparar'], ['details', 'Detalhes']];
    const panels = new Map(), buttons = new Map();
    for (const [id, label] of sections) {
        const button = element('button', label, 'result-tab'); button.type = 'button'; button.id = `tab-${id}`;
        button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `panel-${id}`);
        const panel = element('div', '', 'result-panel'); panel.id = `panel-${id}`;
        panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id); panel.tabIndex = 0;
        panels.set(id, panel); buttons.set(id, button); tablist.append(button);
        button.addEventListener('click', () => activate(id));
        button.addEventListener('keydown', event => {
            const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const index = sections.findIndex(([key]) => key === id);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length;
            activate(sections[next][0]); buttons.get(sections[next][0]).focus();
        });
    }
    function activate(id) {
        for (const [key] of sections) {
            panels.get(key).hidden = key !== id;
            buttons.get(key).setAttribute('aria-selected', String(key === id)); buttons.get(key).tabIndex = key === id ? 0 : -1;
        }
        document.getElementById('main')?.scrollTo(0, 0);
    }
    container.append(tablist, ...panels.values()); activate('overview');
    const overview = card('Análise Factual da IA');
    const summaryText = element('p', result.resumo || 'A API não forneceu um resumo para esta análise.', 'summary-excerpt'); summaryText.id = 'result-summary';
    const expand = element('button', 'Ler resumo completo', 'text-button'); expand.type = 'button'; expand.hidden = true;
    expand.setAttribute('aria-expanded', 'false'); expand.setAttribute('aria-controls', summaryText.id);
    expand.addEventListener('click', () => {
        const expanded = expand.getAttribute('aria-expanded') !== 'true';
        expand.setAttribute('aria-expanded', String(expanded)); summaryText.classList.toggle('expanded', expanded);
        expand.textContent = expanded ? 'Recolher resumo' : 'Ler resumo completo';
    });
    overview.append(summaryText, expand); panels.get('overview').append(overview);
    const observer = new ResizeObserver(() => {
        if (!summaryText.isConnected) { observer.disconnect(); return; }
        if (!panels.get('overview').hidden && expand.getAttribute('aria-expanded') !== 'true') expand.hidden = summaryText.scrollHeight <= summaryText.clientHeight + 1;
    }); observer.observe(summaryText);
    const articles = card('Fontes Jornalísticas Consultadas', 'artigos-card');
    for (const article of result.artigos_relacionados || []) articles.append(articleLink(article));
    if (!result.artigos_relacionados?.length) articles.append(element('p', 'Nenhuma fonte disponível. Ausência de evidências não significa falsidade.'));
    panels.get('sources').append(articles);
    const comparison = card('Comparação de Fontes', 'artigos-card');
    if (result.comparacao_fontes?.length) {
        const grid = element('div', '', 'comparacao-grid');
        const labels = { confirma: 'Confirma os Fatos', contradiz: 'Contradiz a Alegação', neutro: 'Abordagem Neutra' };
        for (const source of result.comparacao_fontes) {
            const column = element('section', '', 'comparacao-coluna');
            column.append(element('h4', source.fonte, 'comparacao-fonte-nome'), element('span', labels[source.posicao] || labels.neutro, `comparacao-posicao posicao-${source.posicao}`), element('p', source.resumo_posicao, 'comparacao-resumo'));
            grid.append(column);
        }
        comparison.append(grid);
    } else {
        comparison.append(element('p', 'A API não forneceu uma comparação de fontes para esta análise.'));
    }
    panels.get('comparison').append(comparison);
    const textList = (title, values) => {
        if (!values?.length) return;
        const section = card(title); const ul = element('ul', ''); values.forEach(value => ul.append(element('li', value))); section.append(ul); panels.get('details').append(section);
    };
    textList('Veículos que corroboram', result.encontrada_em); textList('Partes corretas', result.partes_corretas);
    if (result.erros_encontrados?.length) {
        const section = card('Erros encontrados');
        for (const error of result.erros_encontrados) section.append(element('h4', error.trecho || 'Trecho analisado'), element('p', error.problema), element('p', `Versão correta: ${error.versao_correta || 'Não informada'}`));
        panels.get('details').append(section);
    }
    if (result.recomendacao) { const recommendation = card('Recomendação editorial'); recommendation.append(element('p', result.recomendacao)); panels.get('details').append(recommendation); }
    if (inputText) {
        const input = element('details', ''); input.append(element('summary', 'Conteúdo enviado'), element('p', inputText, 'input-text'));
        panels.get('details').append(input);
    }
    if (!panels.get('details').childElementCount) panels.get('details').append(element('p', 'Nenhum detalhe adicional foi fornecido.', 'helper'));
}
