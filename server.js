/**
 * =============================================================
 *   VerificaAI — Servidor Express (Node.js)
 * =============================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { executarVerificacao } from './checker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Confia no proxy reverso (nginx, Render, Railway, etc.) para obter o IP real
// do cliente. Ativar somente quando a aplicação estiver atrás de um proxy.
if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

// ── Cabeçalhos de Segurança ──────────────────────────────────
// A CSP mantém 'unsafe-inline' em script-src porque os templates usam
// manipuladores inline (onclick="..."). Isso deve ser removido no futuro,
// migrando os handlers para addEventListener.
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// ── CORS restrito ────────────────────────────────────────────
// Sem CORS_ORIGIN definido, apenas a própria origem pode consumir a API.
// Para permitir domínios específicos: CORS_ORIGIN="https://app.exemplo.com"
const origensPermitidas = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

app.use(cors(origensPermitidas.length > 0
    ? { origin: origensPermitidas }
    : { origin: false }));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// ── Rate limiting ────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente mais tarde.' },
});

const checkLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: 'Muitas verificações solicitadas em pouco tempo. Aguarde um minuto.' },
});

app.use('/api/', apiLimiter);

// ── Dicionário temporário: token → { noticia, opcoes, apiKey, timeoutId } ──
const pendingJobs = new Map();
const JOB_TTL_MS = 2 * 60 * 1000; // 2 minutos
const MAX_PENDING_JOBS = 150;
const MAX_NOTICIA_CHARS = 20000;

const MODELOS_PERMITIDOS = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
const IDIOMAS_PERMITIDOS = new Set(['auto', 'pt', 'en']);
const RESUMOS_PERMITIDOS = new Set(['curto', 'medio', 'detalhado']);

function normalizarOpcoes(opcoes) {
    const entrada = (opcoes && typeof opcoes === 'object') ? opcoes : {};

    const maxArtigos = Number.parseInt(entrada.max_artigos, 10);

    return {
        max_artigos: Number.isFinite(maxArtigos)
            ? Math.min(Math.max(maxArtigos, 3), 20)
            : 10,
        idioma_forca: IDIOMAS_PERMITIDOS.has(entrada.idioma_forca) ? entrada.idioma_forca : 'auto',
        tamanho_resumo: RESUMOS_PERMITIDOS.has(entrada.tamanho_resumo) ? entrada.tamanho_resumo : 'medio',
        modelo: MODELOS_PERMITIDOS.has(entrada.modelo) ? entrada.modelo : 'openai/gpt-oss-120b',
        rigoroso: entrada.rigoroso === true,
    };
}

// ── Rotas de Páginas ─────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/historico', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'historico.html'));
});

app.get('/resultado', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'resultado.html'));
});

app.get('/sobre', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'sobre.html'));
});

// ── Endpoint 1: Iniciar Verificação ──────────────────────────
app.post('/api/check/start', checkLimiter, (req, res) => {
    const { noticia, opcoes, apiKey } = req.body || {};

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('gsk_')) {
        return res.status(401).json({ erro: 'Chave da API Groq (API-KEY) inválida ou ausente. Insira sua chave no pop-up.' });
    }

    if (!noticia || typeof noticia !== 'string' || !noticia.trim()) {
        return res.status(400).json({ erro: "Campo 'noticia' é obrigatório e não pode estar vazio." });
    }

    const noticiaLimpa = noticia.trim();

    if (noticiaLimpa.length > MAX_NOTICIA_CHARS) {
        return res.status(413).json({
            erro: `O texto da notícia excede o limite de ${MAX_NOTICIA_CHARS} caracteres.`,
        });
    }

    if (pendingJobs.size >= MAX_PENDING_JOBS) {
        return res.status(503).json({ erro: 'Servidor ocupado no momento. Tente novamente em instantes.' });
    }

    const token = uuidv4();

    // Remove o job automaticamente caso o cliente nunca abra o stream SSE.
    const timeoutId = setTimeout(() => {
        pendingJobs.delete(token);
    }, JOB_TTL_MS);

    pendingJobs.set(token, {
        noticia: noticiaLimpa,
        opcoes: normalizarOpcoes(opcoes),
        apiKey: apiKey.trim(),
        timeoutId,
    });

    res.json({ token });
});

// ── Endpoint 2: SSE Stream ───────────────────────────────────
app.get('/api/check/stream/:token', (req, res) => {
    const { token } = req.params;
    const job = pendingJobs.get(token);

    if (!job) {
        return res.status(404).json({ erro: 'Token inválido ou expirado.' });
    }

    // Token de uso único
    pendingJobs.delete(token);
    clearTimeout(job.timeoutId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evita buffering no nginx
    res.flushHeaders();

    let encerrado = false;

    // Impede escrita após o cliente desconectar.
    req.on('close', () => {
        encerrado = true;
    });

    const emit = (event) => {
        if (encerrado || res.writableEnded) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    (async () => {
        try {
            const resultado = await executarVerificacao(job.noticia, job.opcoes, job.apiKey, emit);
            if (resultado) {
                emit({ type: 'result', ...resultado });
            } else {
                emit({ type: 'error', msg: 'A verificação não retornou resultado.' });
            }
        } catch (exc) {
            console.error('Erro na verificação:', exc);
            let msg = exc.message || 'Erro desconhecido';
            if (exc.status === 401 || msg.includes('401') || msg.includes('Authentication')) {
                msg = 'Chave da API Groq inválida. Verifique sua chave.';
            }
            emit({ type: 'error', msg });
        } finally {
            if (!res.writableEnded) res.end();
        }
    })();
});

// ── 404 para rotas de API inexistentes ───────────────────────
app.use('/api', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
});

// ── Tratamento centralizado de erros ─────────────────────────
app.use((err, req, res, next) => {
    if (!err) return next();

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
    }

    if (err.type === 'entity.too.large') {
        return res.status(413).json({ erro: 'Corpo da requisição muito grande.' });
    }

    console.error('Erro não tratado:', err);

    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ erro: 'Erro interno do servidor.' });
    }

    res.status(500).send('Erro interno do servidor.');
});

app.listen(PORT, () => {
    console.log(`\n🚀 VerificaAI rodando em: http://localhost:${PORT}\n`);
});
