import { api, send } from '../shared/browser.js';
import { settings, saveSettings, savedKey } from '../shared/settings.js';
import { ACTIVE_STATES, hostPermission, normalizeEndpoint, validateText } from '../shared/core.js';
import { $, element, applyTheme, renderResult } from '../shared/ui.js';

let sourceTab, config, selectedId, currentJob, view = 'search', submitting = false, refreshVersion = 0, resultId;
const states = { draft: 'Aguardando revisão', starting: 'Iniciando', running: 'Em apuração', done: 'Concluída', error: 'Falha na apuração', interrupted: 'Interrompida' };
function status(text = '', error = false, announcementOnly = false) { $('status').textContent = text; $('status').classList.toggle('error', error); $('status').classList.toggle('sr-only', announcementOnly); }
async function navigate(next, id = selectedId) {
    selectedId = id;
    view = next;
    await api.storage.local.set({ ui: { selectedId, view } });
    await refresh();
    $('main').scrollTo(0, 0);
}
function showView() {
    if (document.documentElement.dataset.view !== view) document.documentElement.style.removeProperty('height');
    document.documentElement.dataset.view = view;
    for (const name of ['search', 'analysis', 'history', 'settings']) $(`view-${name}`).hidden = view !== name;
    for (const name of ['search', 'history', 'settings']) {
        $(`nav-${name}`).classList.toggle('active', view === name || (name === 'search' && view === 'analysis'));
        $(`nav-${name}`).setAttribute('aria-current', view === name || (name === 'search' && view === 'analysis') ? 'page' : 'false');
    }
}
// Só ajustar à janela DEPOIS que o navegador lhe atribuir um tamanho real.
// Usar vw/dvh no CSS da raiz prende o autosizing ao viewport inicial de 25px.
function fitAllocatedPopup() {
    if (innerWidth < 360 || innerHeight < 150) return;
    const root = document.documentElement;
    const desired = root.dataset.view === 'search' ? (root.dataset.resume === 'true' ? 440 : 360) : 520;
    if (innerHeight < desired && root.getBoundingClientRect().height > innerHeight) root.style.height = `${innerHeight}px`;
}
window.addEventListener('resize', () => requestAnimationFrame(fitAllocatedPopup));
function temporaryDescription() {
    $('privacy').textContent = $('api-temporary').checked
        ? 'Chave apenas em memória. Confirmar remove uma chave salva antes.'
        : '';
    $('privacy').hidden = !$('api-temporary').checked;
}
async function prepareReview(job) {
    config = await settings();
    if (currentJob?.id !== job.id || document.activeElement !== $('text')) $('text').value = job.text || '';
    if (currentJob?.id !== job.id || $('review').hidden) {
        $('api-temporary').checked = config.temporary;
        $('api-key').value = '';
    }
    $('credentials').hidden = !!await savedKey();
    $('endpoint-description').textContent = `API: ${config.endpoint} · ${config.options.max_artigos} artigos · ${config.options.modelo}${config.options.rigoroso ? ' · modo rigoroso' : ''}. Ajuste em Chave API.`;
    $('capture-method').textContent = ({ readability: 'Artigo via Readability', article: 'Contêiner editorial', selection: 'Seleção manual', none: 'Captura insuficiente' })[job.extraction?.method] || 'Texto para revisão';
    temporaryDescription(); count();
}
function count() { $('count').textContent = `${$('text').value.length.toLocaleString('pt-BR')} / 20.000 caracteres`; }
async function renderJob(job) {
    const active = ACTIVE_STATES.includes(job.status), completed = job.status === 'done';
    $('title').textContent = job.title;
    $('title').title = job.title;
    $('source').href = job.sourceUrl; $('source').textContent = new URL(job.sourceUrl).hostname; $('source').title = job.sourceUrl;
    $('notice').hidden = !job.notice; $('notice').textContent = job.notice || '';
    if (!active && !completed) await prepareReview(job);
    $('review').hidden = active || completed;
    $('progress').hidden = !active;
    $('retry').hidden = !['error', 'interrupted'].includes(job.status);
    if (active) {
        const step = job.step || 1;
        $('step').textContent = `Etapa ${step} de 4`;
        $('progress-title').textContent = ['Extraindo termos essenciais', 'Consultando fontes jornalísticas', 'Lendo as matérias', 'Cruzando evidências'][step - 1];
        $('progress-detail').textContent = job.progress || 'Preparando apuração…';
        $('progress-animation').className = step === 2 ? 'anim-lupa' : step === 3 ? 'anim-scan' : 'anim-pulse';
        document.querySelectorAll('.ap-dot').forEach((dot, index) => { dot.classList.toggle('active', index === step - 1); dot.classList.toggle('done', index < step - 1); });
    }
    if (job.error) status(job.error, true);
    else if (completed) status('Análise concluída · salva no histórico', false, true);
    else status();
    if (completed && resultId !== job.id) { renderResult(job.result, $('result'), job.text); resultId = job.id; }
    if (!completed) { $('result').replaceChildren(); resultId = null; }
    currentJob = job;
}
function renderHistory(jobs) {
    $('history').replaceChildren();
    if (!jobs.length) $('history').append(element('p', 'Nenhuma análise salva.', 'helper'));
    for (const job of jobs) {
        const item = element('section', '', 'history-item');
        item.append(element('h2', job.title), element('p', `${new Date(job.createdAt).toLocaleString('pt-BR')} · ${job.result?.veredicto || states[job.status] || job.status}`, 'helper'));
        const actions = element('div', '', 'actions');
        const open = element('button', ACTIVE_STATES.includes(job.status) ? 'Acompanhar apuração' : 'Abrir análise', 'btn-secondary');
        open.type = 'button'; open.addEventListener('click', () => navigate('analysis', job.id).catch(showError));
        const remove = element('button', 'Excluir', 'text-button'); remove.type = 'button'; remove.disabled = ACTIVE_STATES.includes(job.status);
        remove.addEventListener('click', () => send({ type: 'delete', id: job.id }).then(refresh).catch(showError));
        actions.append(open, remove); item.append(actions); $('history').append(item);
    }
}
async function refresh() {
    const version = ++refreshVersion;
    const [jobs, { ui }] = await Promise.all([send({ type: 'list' }), api.storage.local.get('ui')]);
    if (version !== refreshVersion) return;
    view = ['search', 'analysis', 'history', 'settings'].includes(ui?.view) ? ui.view : 'search';
    selectedId = ui?.selectedId || selectedId;
    const selected = jobs.find(job => job.id === selectedId);
    const resume = jobs.find(job => ACTIVE_STATES.includes(job.status)) || selected || jobs[0];
    $('resume').hidden = !resume;
    document.documentElement.dataset.resume = String(!!resume);
    $('resume').textContent = resume ? `${ACTIVE_STATES.includes(resume.status) ? 'Acompanhar apuração' : resume.status === 'draft' ? 'Continuar revisão' : 'Abrir última análise'}: ${resume.title}` : '';
    $('resume').onclick = resume ? () => navigate('analysis', resume.id).catch(showError) : null;
    if (view === 'analysis' && !selected) view = 'search';
    showView();
    if (view === 'analysis') {
        const job = await send({ type: 'get', id: selected.id });
        if (version === refreshVersion) await renderJob(job);
    } else if (view === 'history') renderHistory(jobs);
}
function showError(error) { status(error.message || 'Não foi possível concluir esta ação.', true); }
for (const name of ['search', 'history', 'settings']) $(`nav-${name}`).addEventListener('click', () => {
    status();
    if (name === 'settings') loadSettings().catch(showError);
    navigate(name).catch(showError);
});
$('home-logo').addEventListener('click', () => navigate('search').catch(showError));
$('back').addEventListener('click', () => navigate('search').catch(showError));
for (const mode of ['page', 'selection']) $(mode).addEventListener('click', async () => {
    $('page').disabled = $('selection').disabled = true;
    try {
        const id = await send({ type: 'capture', tabId: sourceTab?.id, mode });
        currentJob = null; await navigate('analysis', id);
    } catch (error) { showError(error); }
    finally { $('page').disabled = $('selection').disabled = false; }
});
$('text').addEventListener('input', () => {
    count();
    if (selectedId) send({ type: 'draft', id: selectedId, text: $('text').value }).catch(showError);
});
$('api-temporary').addEventListener('change', temporaryDescription);
$('review').addEventListener('submit', async event => {
    event.preventDefault(); if (submitting) return;
    submitting = true; $('start').disabled = true;
    try {
        const id = selectedId, endpoint = config.endpoint, original = $('text').value;
        const text = validateText(original);
        if (text !== original) {
            $('text').value = text; count();
            await send({ type: 'draft', id, text });
            throw new Error('Espaços externos removidos. Revise o texto atualizado e confirme o envio novamente.');
        }
        const permission = api.permissions.request({ origins: [hostPermission(config.endpoint)] });
        if (!await permission) throw new Error('Permissão de acesso à API negada. Nada foi enviado.');
        if (selectedId !== id || config.endpoint !== endpoint || $('text').value !== text) throw new Error('A prévia foi alterada. Revise o texto e confirme o envio novamente.');
        const request = send({ type: 'start', id, text, endpoint, key: $('api-key').value.trim(), temporary: $('api-temporary').checked });
        $('api-key').value = '';
        await request; await refresh();
    } catch (error) {
        $('api-key').value = ''; $('credentials').hidden = false; showError(error);
    } finally { submitting = false; $('start').disabled = false; }
});
$('retry').addEventListener('click', () => { $('retry').hidden = true; $('text').focus(); status('Revise o conteúdo e confirme o envio. Uma nova tentativa pode consumir cota.'); });
$('stop').addEventListener('click', () => {
    if (confirm('Interromper recebimento? Isso não garante cancelar o trabalho ou a cota já consumida no servidor.')) send({ type: 'cancel', id: selectedId }).catch(showError);
});
$('clear').addEventListener('click', () => {
    if (confirm('Excluir resultados e rascunhos locais? Apurações em andamento serão mantidas.')) send({ type: 'clear' }).then(refresh).catch(showError);
});

function settingsPrivacy() {
    $('key').disabled = $('temporary').checked;
    if ($('temporary').checked) $('key').value = '';
    $('settings-privacy').textContent = $('temporary').checked
        ? 'A chave será pedida antes da checagem, sem salvar. Confirmar remove a chave salva anteriormente.'
        : '';
    $('settings-privacy').hidden = !$('temporary').checked;
}
async function loadSettings() {
    config = await settings(); $('endpoint').value = config.endpoint; $('temporary').checked = config.temporary;
    $('articles').value = config.options.max_artigos; $('language').value = config.options.idioma_forca;
    $('summary').value = config.options.tamanho_resumo; $('model').value = config.options.modelo;
    $('strict').checked = config.options.rigoroso; $('theme').value = config.theme;
    $('key').value = ''; $('key').type = 'password'; $('show-key').textContent = 'Exibir';
    settingsPrivacy(); await refreshKeyStatus();
}
async function refreshKeyStatus() { $('key-status').textContent = await savedKey() ? 'Uma chave está salva neste navegador.' : 'Nenhuma chave salva.'; }
$('temporary').addEventListener('change', settingsPrivacy);
$('show-key').addEventListener('click', () => { const reveal = $('key').type === 'password'; $('key').type = reveal ? 'text' : 'password'; $('show-key').textContent = reveal ? 'Ocultar' : 'Exibir'; });
$('remove-key').addEventListener('click', async () => { await api.storage.local.remove('groq_api_key'); $('key').value = ''; await refreshKeyStatus(); status('Chave removida deste navegador.'); });
$('settings').addEventListener('submit', async event => {
    event.preventDefault();
    try {
        const endpoint = normalizeEndpoint($('endpoint').value);
        const granted = await api.permissions.request({ origins: [hostPermission(endpoint)] });
        if (!granted) throw new Error('Permissão negada. As preferências não foram alteradas.');
        config = await saveSettings({ endpoint, temporary: $('temporary').checked, theme: $('theme').value, options: {
            max_artigos: $('articles').value, idioma_forca: $('language').value, tamanho_resumo: $('summary').value, modelo: $('model').value, rigoroso: $('strict').checked
        } }, $('key').value.trim());
        $('key').value = ''; await refreshKeyStatus(); await applyTheme(); status('Preferências salvas. Apurações já iniciadas não foram alteradas.');
    } catch (error) { showError(error); }
});
api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.jobs || changes.ui)) refresh().catch(showError);
});
try {
    await applyTheme(); [sourceTab] = await api.tabs.query({ active: true, currentWindow: true });
    await loadSettings(); await refresh();
    requestAnimationFrame(() => requestAnimationFrame(fitAllocatedPopup));
    const { captureError } = await api.storage.local.get('captureError');
    if (captureError) { status(captureError, true); await api.storage.local.remove('captureError'); }
} catch (error) { showError(error); }
