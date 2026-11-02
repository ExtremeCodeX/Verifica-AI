export const OFFICIAL_ENDPOINT = 'https://verifica-ai-five.vercel.app';
export const MAX_TEXT = 20000;
export const ACTIVE_STATES = ['starting', 'running'];
export const DEFAULT_OPTIONS = Object.freeze({ max_artigos: 10, idioma_forca: 'auto', tamanho_resumo: 'medio', modelo: 'openai/gpt-oss-120b', rigoroso: false });

export function normalizeEndpoint(value) {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
        throw new Error('Use apenas a origem da API, sem caminho, credenciais ou parâmetros.');
    }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
        throw new Error('Use HTTPS. HTTP é permitido apenas em localhost ou 127.0.0.1.');
    }
    return url.origin;
}

export function hostPermission(endpoint) {
    const url = new URL(normalizeEndpoint(endpoint));
    // Match patterns não incluem portas. A requisição continua restrita ao endpoint escolhido.
    return `${url.protocol}//${url.hostname}/*`;
}

export function normalizeOptions(value = {}) {
    return {
        max_artigos: Math.min(20, Math.max(3, Number.parseInt(value.max_artigos, 10) || 10)),
        idioma_forca: ['auto', 'pt', 'en'].includes(value.idioma_forca) ? value.idioma_forca : 'auto',
        tamanho_resumo: ['curto', 'medio', 'detalhado'].includes(value.tamanho_resumo) ? value.tamanho_resumo : 'medio',
        modelo: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].includes(value.modelo) ? value.modelo : 'openai/gpt-oss-120b',
        rigoroso: value.rigoroso === true
    };
}

export function validateText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Selecione ou escreva o trecho que deseja verificar.');
    if (text.trim().length > MAX_TEXT) throw new Error('O limite é de 20.000 caracteres. Escolha um trecho; o texto não foi cortado.');
    return text.trim();
}

export function safeUrl(value) {
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; }
    catch { return null; }
}

const string = (v, max = 12000) => typeof v === 'string' ? v.slice(0, max) : '';
const list = (v) => Array.isArray(v) ? v.slice(0, 50) : [];
export function normalizeResult(value) {
    const verdicts = ['VERDADEIRA', 'FALSA', 'PARCIALMENTE VERDADEIRA', 'NÃO ENCONTRADA NOS SITES'];
    if (!value || !verdicts.includes(value.veredicto)) throw new Error('A API retornou um veredito inválido.');
    return {
        veredicto: value.veredicto,
        grau_veracidade: value.veredicto === 'NÃO ENCONTRADA NOS SITES' || !Number.isFinite(value.grau_veracidade) ? null : Math.min(100, Math.max(0, value.grau_veracidade)),
        resumo: string(value.resumo), recomendacao: string(value.recomendacao),
        encontrada_em: list(value.encontrada_em).map(v => string(v, 300)),
        partes_corretas: list(value.partes_corretas).map(v => string(v, 2000)),
        erros_encontrados: list(value.erros_encontrados).map(v => ({ trecho: string(v?.trecho, 2000), problema: string(v?.problema, 2000), versao_correta: string(v?.versao_correta, 2000) })),
        artigos_relacionados: list(value.artigos_relacionados).map(v => ({ titulo: string(v?.titulo, 500), fonte: string(v?.fonte, 300), idioma: string(v?.idioma, 20), url: safeUrl(v?.url) })),
        comparacao_fontes: list(value.comparacao_fontes).map(v => ({ fonte: string(v?.fonte, 300), posicao: ['confirma', 'contradiz', 'neutro'].includes(v?.posicao) ? v.posicao : 'neutro', resumo_posicao: string(v?.resumo_posicao, 4000) }))
    };
}

export function verdictStyle(result) {
    return ({ VERDADEIRA: ['true', '#0B5D4E', 'V'], FALSA: ['false', '#9E1B32', 'F'], 'PARCIALMENTE VERDADEIRA': ['partial', '#855300', 'P'] })[result?.veredicto] || ['neutral', '#555B75', '?'];
}

export function httpError(status) {
    return ({ 401: 'Chave Groq rejeitada. Confira ou troque a chave.', 413: 'Texto acima do limite de 20.000 caracteres.', 429: 'Limite de solicitações ou cota atingido. Aguarde antes de tentar novamente.', 503: 'Servidor ocupado. Tente novamente mais tarde.', 404: 'API ou token indisponível. Confira o endpoint; tokens não podem ser reutilizados.' })[status] || 'Não foi possível concluir a solicitação à API. Confira a conexão e o endpoint.';
}
