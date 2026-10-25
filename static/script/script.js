function initTheme() {
    var savedTheme = localStorage.getItem('verificai_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
}

function updateThemeUI(theme) {
    var label = document.getElementById('themeLabelName');
    var icon = document.getElementById('themeIconAnim');
    if (label) {
        label.textContent = theme === 'dark' ? 'Escuro' : 'Claro';
    }
    if (icon) {
        icon.textContent = theme === 'dark' ? '☾' : '☼';
    }

    // O header permanece azul nos dois temas.
    var logos = document.querySelectorAll('.brand-logo');
    logos.forEach(function(img) {
        img.src = '/static/img/Logo_header.png';
    });
}

function toggleThemeWithAnimation(btn) {
    btn.classList.add('animating');
    setTimeout(function() {
        btn.classList.remove('animating');
    }, 400);

    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('verificai_theme', next);
    updateThemeUI(next);
}

initTheme();

function toggleDrawer() {
    var overlay = document.getElementById('drawerOverlay');
    if (overlay) {
        overlay.classList.toggle('open');
        syncDrawerAria(overlay.classList.contains('open'));
    }
}

function closeDrawer() {
    var overlay = document.getElementById('drawerOverlay');
    if (overlay) {
        overlay.classList.remove('open');
        syncDrawerAria(false);
    }
}

function syncDrawerAria(open) {
    var btn = document.querySelector('.btn-menu-hamburger');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeDrawerOnOverlay(e) {
    if (e.target && e.target.id === 'drawerOverlay') {
        closeDrawer();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var path = window.location.pathname;
    document.querySelectorAll('nav a').forEach(function (a) {
        if (a.getAttribute('href') === path) a.classList.add('active');
    });
    initTheme();
});

function getApiKey() {
    return localStorage.getItem('groq_api_key') || '';
}

function openApiKeyModal() {
    var modal = document.getElementById('apiKeyModal');
    var input = document.getElementById('apiKeyInput');
    if (modal && input) {
        input.value = getApiKey();
        modal.style.display = 'flex';
        input.focus();
    }
}

function closeApiKeyModal() {
    var modal = document.getElementById('apiKeyModal');
    if (modal) modal.style.display = 'none';
}

function toggleApiKeyVisibility() {
    var input = document.getElementById('apiKeyInput');
    var btn = event.target;
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.textContent = 'Ocultar';
        } else {
            input.type = 'password';
            if (btn) btn.textContent = 'Exibir';
        }
    }
}

function saveApiKey() {
    var input = document.getElementById('apiKeyInput');
    if (!input) return;
    var key = input.value.trim();

    if (!key) {
        alert('Por favor, insira uma chave da API Groq válida.');
        return;
    }

    if (!key.startsWith('gsk_')) {
        alert('Aviso: As chaves da API Groq geralmente começam com "gsk_". Verifique se a chave está correta.');
    }

    localStorage.setItem('groq_api_key', key);
    closeApiKeyModal();

    var btn = document.querySelector('.modal-primary, .btn-primary');
    if (btn) {
        var oldText = btn.textContent;
        btn.textContent = 'Salvo com sucesso';
        setTimeout(function() { btn.textContent = oldText; }, 1500);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!getApiKey()) {
        setTimeout(function () {
            openApiKeyModal();
        }, 500);
    }
});

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function toggleAdvanced() {
    var panel   = document.getElementById('advancedPanel');
    var chevron = document.getElementById('chevron');
    var open    = panel.classList.toggle('visible');
    if (chevron) chevron.classList.toggle('open', open);
}

function selectPill(btn, groupId) {
    document.querySelectorAll('#' + groupId + ' .pill').forEach(function (p) {
        p.classList.remove('selected');
    });
    btn.classList.add('selected');
}

function coletarOpcoes() {
    var opcoes = {};

    var slider = document.getElementById('sliderArtigos');
    if (slider) opcoes.max_artigos = parseInt(slider.value, 10);

    var idiomaSel = document.querySelector('#pillIdioma .pill.selected');
    if (idiomaSel) opcoes.idioma_forca = idiomaSel.dataset.value;

    var resumoSel = document.querySelector('#pillResumo .pill.selected');
    if (resumoSel) opcoes.tamanho_resumo = resumoSel.dataset.value;

    var modeloSel = document.getElementById('selectModelo');
    if (modeloSel) opcoes.modelo = modeloSel.value;

    var rigorosoEl = document.getElementById('toggleRigoroso');
    if (rigorosoEl) opcoes.rigoroso = rigorosoEl.checked;

    return opcoes;
}

function buscar() {
    var apiKey = getApiKey();
    if (!apiKey) {
        openApiKeyModal();
        return;
    }

    var input = document.getElementById('inputSearch');
    if (!input) return;

    var noticia = input.value.trim();
    if (!noticia) {
        input.style.outline = '2px solid var(--accent-red)';
        input.placeholder   = 'Por favor, cole uma notícia ou URL válida!';
        setTimeout(function () { input.style.outline = ''; }, 2000);
        return;
    }

    sessionStorage.setItem('noticiaParaVerificar', noticia);
    sessionStorage.setItem('opcoesVerificacao', JSON.stringify(coletarOpcoes()));
    window.location.href = '/resultado';
}

document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('inputSearch');
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                buscar();
            }
        });
    }

    var verdictCard  = document.getElementById('verdictCard');
    if (!verdictCard) return;

    var verdictScore = document.getElementById('verdictScore');
    var verdictLabel = document.getElementById('verdictLabel');
    var verdictSub   = document.getElementById('verdictSub');
    var apurationBox = document.getElementById('apurationBox');
    var resumoCard   = document.getElementById('resumoCard');
    var resumoTexto  = document.getElementById('resumoTexto');
    var artigosCard  = document.getElementById('artigosCard');
    var artigosList  = document.getElementById('artigosList');

    var noticia = sessionStorage.getItem('noticiaParaVerificar');
    var opcoes  = JSON.parse(sessionStorage.getItem('opcoesVerificacao') || '{}');
    var apiKey  = getApiKey();

    if (!apiKey) {
        setVerdict('nao-encontrada', 'ALERTA', 'Chave da API ausente', 'Configure sua chave Groq acessando o menu de Configuração de Chave API.');
        ocultarApuration();
        openApiKeyModal();
        return;
    }

    if (!noticia) {
        setVerdict('nao-encontrada', '—', 'Nenhuma notícia enviada',
                   '<a href="/" style="color:var(--ink); text-decoration: underline;">Retornar à página de pesquisa</a>');
        ocultarApuration();
        return;
    }

    fetch('/api/check/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticia: noticia, opcoes: opcoes, apiKey: apiKey })
    })
    .then(function (r) {
        if (!r.ok) {
            return r.json().then(function(errData) {
                throw new Error(errData.erro || ('HTTP ' + r.status));
            });
        }
        return r.json();
    })
    .then(function (data) {
        if (data.erro) throw new Error(data.erro);
        iniciarStream(data.token);
    })
    .catch(function (err) {
        setVerdict('nao-encontrada', 'ALERTA', 'Erro de autenticação ou conexão', err.message);
        ocultarApuration();
        if (err.message.includes('API') || err.message.includes('chave')) {
            openApiKeyModal();
        }
    });

    function iniciarStream(token) {
        var resultadoRecebido = false;
        var es = new EventSource('/api/check/stream/' + token);

        es.onmessage = function (evt) {
            var data;
            try { data = JSON.parse(evt.data); } catch (e) { return; }

            switch (data.type) {
                case 'step':
                    atualizarEtapaApuracao(data.step, data.msg);
                    break;

                case 'keywords':
                    atualizarDetalheApuracao('Termos selecionados: ' + data.keywords.join(', '));
                    break;

                case 'query':
                    atualizarDetalheApuracao('Pesquisando: "' + data.query + '"');
                    break;

                case 'articles_found':
                    atualizarDetalheApuracao(data.count + ' artigo(s) jornalístico(s) indexado(s)');
                    break;

                case 'reading':
                    var fonteNome = data.fonte ? 'Lendo veículo: ' + data.fonte : 'Lendo conteúdo editorial…';
                    atualizarDetalheApuracao(fonteNome);
                    break;

                case 'result':
                    resultadoRecebido = true;
                    window.resultadoGlobal = data;
                    salvarItemNoHistoricoLocal(noticia, data);
                    es.close();
                    concluirApuration();
                    renderizarResultado(data);
                    break;

                case 'error':
                    es.close();
                    mostrarErroApuration(data.msg || 'Erro desconhecido');
                    break;
            }
        };

        es.onerror = function () {
            es.close();
            if (!resultadoRecebido) {
                setVerdict('nao-encontrada', 'ALERTA', 'Conexão interrompida', 'Por favor, tente novamente.');
                ocultarApuration();
            }
        };
    }

    function atualizarEtapaApuracao(n, msg) {
        var tag = document.getElementById('apurationTag');
        var title = document.getElementById('apurationTitle');
        var detail = document.getElementById('apurationDetail');
        var visual = document.getElementById('apurationVisual');

        if (tag) tag.textContent = 'Etapa ' + n + ' de 4';
        if (title) title.textContent = msg || 'Processando apuração…';

        if (visual) {
            if (n === 1) {
                visual.innerHTML = '<div class="anim-pulse"></div>';
                if (detail) detail.textContent = 'Analisando o texto e extraindo termos para varredura web';
            } else if (n === 2) {
                visual.innerHTML = '<div class="anim-lupa"></div>';
                if (detail) detail.textContent = 'Consultando fontes e portais jornalísticos no Google News';
            } else if (n === 3) {
                visual.innerHTML = '<div class="anim-scan"></div>';
                if (detail) detail.textContent = 'Extraindo e lendo o conteúdo integral das matérias';
            } else if (n === 4) {
                visual.innerHTML = '<div class="anim-pulse" style="animation-duration: 0.7s;"></div>';
                if (detail) detail.textContent = 'Cruzando evidências e emitindo veredicto com Inteligência Artificial';
            }
        }

        for (var i = 1; i <= 4; i++) {
            var dot = document.getElementById('apDot' + i);
            if (dot) {
                dot.classList.remove('active', 'done');
                if (i < n) dot.classList.add('done');
                else if (i === n) dot.classList.add('active');
            }
        }
    }

    function atualizarDetalheApuracao(detalheTexto) {
        var detail = document.getElementById('apurationDetail');
        if (detail) detail.textContent = detalheTexto;
    }

    function concluirApuration() {
        if (apurationBox) {
            apurationBox.classList.add('fade-out');
            setTimeout(function() {
                apurationBox.style.display = 'none';
            }, 400);
        }
        if (verdictCard) {
            verdictCard.style.display = 'flex';
        }
    }

    function ocultarApuration() {
        if (apurationBox) apurationBox.style.display = 'none';
        if (verdictCard) verdictCard.style.display = 'flex';
    }

    function mostrarErroApuration(msgErro) {
        if (apurationBox) apurationBox.style.display = 'none';
        setVerdict('nao-encontrada', 'ALERTA', 'Erro na apuração', msgErro);
    }

    function setVerdict(cssClass, scoreHTML, labelText, subText) {
        if (verdictCard) {
            verdictCard.style.display = 'flex';
            verdictCard.classList.remove('carregando', 'verdadeira', 'falsa', 'parcial', 'nao-encontrada');
            if (cssClass) verdictCard.classList.add(cssClass);
        }
        if (verdictScore) verdictScore.innerHTML = scoreHTML;
        if (verdictLabel) verdictLabel.textContent = labelText;
        if (subText !== undefined && verdictSub) verdictSub.innerHTML = subText;
    }

    function renderizarResultado(resultado) {
        var veredicto = resultado.veredicto || 'NÃO ENCONTRADA NOS SITES';
        var grau = resultado.grau_veracidade != null ? resultado.grau_veracidade : (resultado.pontuacao_confianca != null ? resultado.pontuacao_confianca : null);
        var grauStr = (grau != null && veredicto !== 'NÃO ENCONTRADA NOS SITES') ? grau + '%' : 'N/A';
        var resumo    = resultado.resumo || '';
        var artigos   = resultado.artigos_relacionados || [];

        var cssMap  = {
            'VERDADEIRA':              'verdadeira',
            'FALSA':                   'falsa',
            'PARCIALMENTE VERDADEIRA': 'parcial',
            'NÃO ENCONTRADA NOS SITES':'nao-encontrada'
        };
        var labelMap = {
            'VERDADEIRA':              'Factual / Verídica',
            'FALSA':                   'Falsa / Invenção',
            'PARCIALMENTE VERDADEIRA': 'Parcialmente Verdadeira',
            'NÃO ENCONTRADA NOS SITES':'Dados Insuficientes'
        };

        var css   = cssMap[veredicto]  || 'nao-encontrada';
        var labelTexto = labelMap[veredicto] || 'Verificação Concluída';

        setVerdict(css, grauStr, labelTexto,
                   'Grau de Veracidade Factual: ' + grauStr);

        if (resumo) {
            resumoTexto.textContent = resumo;
            resumoCard.style.display = 'block';
        }

        if (artigos.length > 0) {
            artigosCard.style.display = 'block';
            artigosList.innerHTML = '';
            artigos.slice(0, 6).forEach(function (art) {
                var a         = document.createElement('a');
                a.className   = 'artigo-link';
                a.href        = urlSegura(art.url);
                a.target      = '_blank';
                a.rel         = 'noopener noreferrer';

                var langBadge = art.idioma === 'pt' ? '[PT]' : '[EN]';

                var fonte = document.createElement('span');
                fonte.className   = 'artigo-fonte';
                fonte.textContent = langBadge + ' ' + (art.fonte || 'Fonte');

                var titulo = document.createElement('span');
                titulo.className   = 'artigo-titulo';
                titulo.textContent = (art.titulo || '').slice(0, 80);

                a.appendChild(fonte);
                a.appendChild(titulo);
                artigosList.appendChild(a);
            });

            var btnComp = document.getElementById('btnComparar');
            if (btnComp) {
                btnComp.style.display = artigos.length >= 1 ? 'block' : 'none';
            }
        }
    }
});

function abrirComparacao() {
    var modal = document.getElementById('comparacaoModal');
    var grid = document.getElementById('comparacaoGrid');
    if (!modal || !grid) return;

    var artigos = (window.resultadoGlobal && window.resultadoGlobal.artigos_relacionados) || [];
    var comparacoes = (window.resultadoGlobal && window.resultadoGlobal.comparacao_fontes) || [];

    grid.innerHTML = '';

    if (artigos.length === 0) {
        grid.innerHTML = '<p class="empty-state">Nenhum artigo disponível para comparação analítica.</p>';
        modal.style.display = 'flex';
        return;
    }

    artigos.forEach(function (art) {
        var comp = comparacoes.find(function(c) {
            return c.fonte && art.fonte && c.fonte.toLowerCase().includes(art.fonte.toLowerCase());
        }) || {
            posicao: 'neutro',
            resumo_posicao: art.titulo || 'Matéria consultada pelas fontes.'
        };

        var posClassMap = {
            'confirma': 'posicao-confirma',
            'contradiz': 'posicao-contradiz',
            'neutro': 'posicao-neutro'
        };
        var posLabelMap = {
            'confirma': 'Confirma os Fatos',
            'contradiz': 'Contradiz a Alegação',
            'neutro': 'Abordagem Neutra / Citada'
        };

        var posClass = posClassMap[comp.posicao] || 'posicao-neutro';
        var posLabel = posLabelMap[comp.posicao] || 'Contexto Geral';

        var col = document.createElement('div');
        col.className = 'comparacao-coluna';
        col.innerHTML =
            '<div class="comparacao-fonte-nome">' + escaparHTML(art.fonte || 'Fonte') + '</div>' +
            '<div><span class="comparacao-posicao ' + posClass + '">' + posLabel + '</span></div>' +
            '<div class="comparacao-resumo">"' + escaparHTML(comp.resumo_posicao || art.titulo) + '"</div>' +
            '<a href="' + escaparHTML(urlSegura(art.url)) + '" target="_blank" rel="noopener noreferrer" class="comparacao-link">Ler matéria original ↗</a>';

        grid.appendChild(col);
    });

    modal.style.display = 'flex';
}

function closeComparacaoModal() {
    var modal = document.getElementById('comparacaoModal');
    if (modal) modal.style.display = 'none';
}

function escaparHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

var HISTORICO_STORAGE_KEY = 'verificai_historico';
var HISTORICO_MAX_ITENS = 50;

function gerarIdLocal() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function lerHistoricoLocal() {
    try {
        var dados = JSON.parse(localStorage.getItem(HISTORICO_STORAGE_KEY) || '[]');
        return Array.isArray(dados) ? dados : [];
    } catch (e) {
        return [];
    }
}

function salvarHistoricoLocal(lista) {
    try {
        localStorage.setItem(HISTORICO_STORAGE_KEY, JSON.stringify(lista));
        return true;
    } catch (e) {
        return false;
    }
}

function salvarItemNoHistoricoLocal(noticia, resultado) {
    var lista = lerHistoricoLocal();
    lista.unshift({
        id: gerarIdLocal(),
        data: new Date().toISOString(),
        noticia: noticia,
        resultado: resultado
    });
    return salvarHistoricoLocal(lista.slice(0, HISTORICO_MAX_ITENS));
}

function urlSegura(valor) {
    try {
        var u = new URL(String(valor), window.location.origin);
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch (e) {}
    return '#';
}
