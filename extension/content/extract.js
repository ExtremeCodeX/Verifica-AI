// Executado no mundo isolado apenas por ação do usuário; nenhuma chave chega aqui.
(() => {
    const clone = document.cloneNode(true);
    const restricted = !!clone.querySelector('[itemprop="isAccessibleForFree"][content="false"], .paywall, [data-paywall]');
    // Readability não conhece folhas CSS externas. Espelhar a visibilidade real
    // antes de limpar o clone evita ler texto oculto (inclusive por paywalls).
    function removeInvisible(original, copy) {
        const style = getComputedStyle(original);
        if (style.display === 'none' || style.visibility === 'hidden') { copy.remove(); return; }
        const children = Array.from(copy.children);
        Array.from(original.children).forEach((child, index) => removeInvisible(child, children[index]));
    }
    if (document.body && clone.body) removeInvisible(document.body, clone.body);
    // Descendentes de <details> fechado podem ter display:block no estilo
    // computado, embora só o summary esteja visível para o leitor.
    clone.querySelectorAll('details:not([open])').forEach(node => {
        const summary = node.querySelector(':scope > summary');
        node.replaceChildren(...(summary ? [summary] : []));
    });
    // Apenas marcadores estruturais explícitos, nunca palavras no texto editorial.
    const noise = 'script, style, noscript, template, nav, footer, aside, form, input, textarea, select, button, iframe, [contenteditable], [hidden], [aria-hidden="true"], [role="navigation"], [role="complementary"], [role="dialog"], .comments, #comments, .comment-list, .related-posts, .related-articles, .recommended-articles, .social-share, .share-buttons, .newsletter-signup, .ad-container, .advertisement, .paywall, [data-paywall], [data-ad], [data-ad-slot]';
    clone.querySelectorAll(noise).forEach(node => node.remove());
    clone.querySelectorAll('[style]').forEach(node => {
        if (node.style.display === 'none' || node.style.visibility === 'hidden') node.remove();
    });
    const normalize = text => text.replace(/\s+/g, ' ').trim();
    // Não usa innerText/body como fallback; trabalha somente em conteúdo editorial.
    function plainText(root) {
        const blocks = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'TR', 'FIGCAPTION']);
        function visit(node) {
            if (node.nodeType === 3) return node.textContent;
            if (node.nodeType !== 1) return '';
            if (node.tagName === 'BR') return '\n';
            const text = Array.from(node.childNodes, visit).join('');
            return blocks.has(node.tagName) ? `\n${text}\n` : `${text}${['TD', 'TH'].includes(node.tagName) ? ' | ' : ''}`;
        }
        return visit(root).split('\n').map(normalize).filter(Boolean).join('\n\n');
    }
    function usable(root) {
        const text = plainText(root);
        const bodyOnly = root.cloneNode(true);
        bodyOnly.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(node => node.remove());
        const linkText = Array.from(root.querySelectorAll('a'), node => normalize(node.textContent)).join('');
        return plainText(bodyOnly).length >= 80 && linkText.length < text.length * 0.5;
    }
    const candidates = Array.from(clone.querySelectorAll('[itemprop~="articleBody"], article, [role="article"]'));
    const candidate = candidates.find(usable);
    const heading = candidate?.querySelector('h1') || clone.querySelector('h1');
    const subtitle = normalize((candidate || clone).querySelector('[itemprop~="alternativeHeadline"], .subtitle, .article-subtitle')?.textContent || '');
    const warnings = [];
    let parsed;
    try { parsed = new Readability(clone.cloneNode(true)).parse(); } catch { /* Tentar apenas um contêiner editorial validado. */ }
    const parsedRoot = parsed?.content ? new DOMParser().parseFromString(parsed.content, 'text/html').body : null;
    let root = parsedRoot && usable(parsedRoot) ? parsedRoot : null;
    let method = root ? 'readability' : 'none';
    if (!root && candidate) {
        root = candidate; method = 'article';
        warnings.push('Extração alternativa de um contêiner editorial. Confira se a notícia está completa.');
    }
    const title = normalize(heading?.textContent || parsed?.title || document.title);
    if (!root) return { title, text: '', method, warnings: ['Não foi possível identificar conteúdo editorial suficiente. Selecione ou cole um trecho público; não contornamos paywalls.'] };
    let body = plainText(root);
    // Só elimina duplicatas integrais no começo, sem deduplicar parágrafos da notícia.
    const parts = body.split('\n\n');
    while (parts.length && [title, subtitle].filter(Boolean).includes(parts[0])) parts.shift();
    body = parts.join('\n\n');
    if (body.length < 300) warnings.push('O texto extraído é curto e pode estar incompleto. Confira antes de enviar.');
    if (restricted) warnings.push('A página sinaliza acesso restrito. Apenas o conteúdo disponível foi capturado, sem contornar o bloqueio.');
    return { title, subtitle, text: [title, subtitle, body].filter(Boolean).join('\n\n'), method, warnings };
})();
