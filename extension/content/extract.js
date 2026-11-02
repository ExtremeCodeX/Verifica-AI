// Executado no mundo isolado apenas por ação do usuário; nenhuma chave chega aqui.
(() => {
    const clone = document.cloneNode(true);
    clone.querySelectorAll('form, input, textarea, select, [contenteditable]').forEach(node => node.remove());
    const article = new Readability(clone).parse();
    return { title: article?.title || document.title, text: article?.textContent?.trim() || '' };
})();
