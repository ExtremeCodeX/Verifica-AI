/**
 * ─────────────────────────────────────────────────────────────
 *   historico.js — Gestão da Página de Histórico (100% local)
 * ─────────────────────────────────────────────────────────────
 * O histórico é armazenado exclusivamente no localStorage do
 * navegador do usuário (ver script.js). Nenhum dado é enviado
 * ou compartilhado com o servidor.
 */

var historicoGlobal = [];
var historicoDataMap = {};

document.addEventListener('DOMContentLoaded', function () {
    carregarHistorico();
});

function carregarHistorico() {
    var container = document.getElementById('historicoList');
    var btnClear = document.getElementById('btnClearHistory');
    if (!container) return;

    historicoGlobal = lerHistoricoLocal();

    if (historicoGlobal.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma verificação registrada no histórico até o momento.</div>';
        if (btnClear) btnClear.style.display = 'none';
        return;
    }

    if (btnClear) btnClear.style.display = 'block';
    container.innerHTML = '';

    historicoDataMap = {};
    historicoGlobal.forEach(function (item) {
        historicoDataMap[item.id] = item;
        container.appendChild(criarCardHistorico(item));
    });
}

function criarCardHistorico(item) {
    var card = document.createElement('div');
    card.className = 'historico-card';

    var res = item.resultado || {};
    var veredicto = res.veredicto || 'NÃO ENCONTRADA NOS SITES';
    var grau = res.grau_veracidade != null ? res.grau_veracidade : (res.pontuacao_confianca != null ? res.pontuacao_confianca : null);
    var grauStr = (grau != null && veredicto !== 'NÃO ENCONTRADA NOS SITES') ? grau + '%' : 'N/A';

    var cssMap = {
        'VERDADEIRA': 'verdadeira',
        'FALSA': 'falsa',
        'PARCIALMENTE VERDADEIRA': 'parcial',
        'NÃO ENCONTRADA NOS SITES': 'nao-encontrada'
    };
    var labelMap = {
        'VERDADEIRA': 'Factual / Verídica',
        'FALSA': 'Falsa / Invenção',
        'PARCIALMENTE VERDADEIRA': 'Parcialmente Verdadeira',
        'NÃO ENCONTRADA NOS SITES': 'Dados Insuficientes'
    };

    var cssClass = cssMap[veredicto] || 'nao-encontrada';
    var labelTexto = labelMap[veredicto] || 'Verificação Realizada';

    var dataFormatada = 'Data desconhecida';
    try {
        var d = new Date(item.data);
        dataFormatada = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}

    card.innerHTML = 
        '<div class="card-top">' +
            '<span class="verdict-badge ' + cssClass + '">' + labelTexto + '</span>' +
            '<span class="card-date">' + dataFormatada + '</span>' +
        '</div>' +
        '<div class="card-noticia">"' + escaparHtmlLocal(item.noticia || '') + '"</div>' +
        '<div class="card-footer">' +
            '<span class="card-conf">Grau de Veracidade: <strong>' + grauStr + '</strong></span>' +
            '<div class="card-actions">' +
                '<button class="btn-sm" onclick="verDetalhes(\'' + escaparAtributo(item.id) + '\')">Detalhes</button>' +
                '<button class="btn-sm danger" onclick="deletarItem(\'' + escaparAtributo(item.id) + '\')">Excluir</button>' +
            '</div>' +
        '</div>';

    return card;
}

function escaparHtmlLocal(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Escapa valores usados dentro de atributos inline (onclick="...").
function escaparAtributo(str) {
    return String(str == null ? '' : str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&/g, '&amp;');
}

function verDetalhes(id) {
    var item = historicoDataMap[id];
    if (!item) return;

    var modal = document.getElementById('detalhesModal');
    var content = document.getElementById('detalhesContent');
    var titulo = document.getElementById('detalhesTitulo');
    if (!modal || !content) return;

    titulo.textContent = 'Detalhes da Verificação';
    var res = item.resultado || {};
    var grau = res.grau_veracidade != null ? res.grau_veracidade : (res.pontuacao_confianca != null ? res.pontuacao_confianca : 'N/A');
    var grauStr = grau !== 'N/A' ? grau + '%' : 'N/A';

    var html = 
        '<div class="detalhe-bloco"><h4>Notícia Verificada</h4><p><em>"' + escaparHtmlLocal(item.noticia || '') + '"</em></p></div>' +
        '<div class="detalhe-bloco"><h4>Veredicto</h4><p><strong>' + escaparHtmlLocal(res.veredicto || 'N/A') + '</strong> (Grau de Veracidade: ' + escaparHtmlLocal(grauStr) + ')</p></div>';

    if (res.resumo) {
        html += '<div class="detalhe-bloco"><h4>Resumo da Análise</h4><p>' + escaparHtmlLocal(res.resumo) + '</p></div>';
    }

    if (res.recomendacao) {
        html += '<div class="detalhe-bloco"><h4>Recomendação</h4><p>' + escaparHtmlLocal(res.recomendacao) + '</p></div>';
    }

    if (res.artigos_relacionados && res.artigos_relacionados.length > 0) {
        html += '<div class="detalhe-bloco"><h4>Artigos Consultados</h4><ul>';
        res.artigos_relacionados.forEach(function (art) {
            var href = escaparHtmlLocal(urlSegura(art.url));
            html += '<li><a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color:var(--ink); text-decoration: underline;">' + escaparHtmlLocal(art.titulo) + ' (' + escaparHtmlLocal(art.fonte || 'Fonte') + ')</a></li>';
        });
        html += '</ul></div>';
    }

    content.innerHTML = html;
    modal.style.display = 'flex';
}

function closeDetalhesModal() {
    var modal = document.getElementById('detalhesModal');
    if (modal) modal.style.display = 'none';
}

function deletarItem(id) {
    if (!confirm('Deseja excluir este item do histórico?')) return;

    var lista = lerHistoricoLocal().filter(function (item) {
        return item.id !== id;
    });

    if (!salvarHistoricoLocal(lista)) {
        alert('Não foi possível salvar o histórico neste navegador (armazenamento indisponível ou cheio).');
        return;
    }

    carregarHistorico();
}

function limparHistorico() {
    if (!confirm('Tem certeza que deseja apagar TODO o histórico de verificações deste navegador?')) return;

    if (!salvarHistoricoLocal([])) {
        alert('Não foi possível limpar o histórico neste navegador (armazenamento indisponível).');
        return;
    }

    carregarHistorico();
}
