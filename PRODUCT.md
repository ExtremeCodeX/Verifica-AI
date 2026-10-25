# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Jornalistas investigativos, pesquisadores acadêmicos, checadores de fatos e cidadãos exigentes que buscam rigor metodológico e transparência factual absoluta.

## Product Purpose
Sistema acadêmico-jornalístico de verificação de fatos em tempo real. Cruzando alegações textuais ou URLs com fontes jornalísticas indexadas (Google News) através de IA rigorosa, o sistema emite diagnósticos factuais objetivos pontuados por um rigoroso Grau de Veracidade (0-100%), acompanhado de análise comparativa lado a lado de fontes.

## Positioning
Uma ferramenta de auditoria de desinformação construída sob os cânones do jornalismo investigativo e da pesquisa acadêmica: sem ruído visual, sem artifícios de IA genérica, priorizando o dado bruto, o rastreio documental e a sobriedade editorial.

## Operating Context
Interface de trabalho de alta densidade informativa e escaneabilidade, operando localmente via Node.js/Express, com histórico persistente e chave de API gerenciada pelo usuário no navegador (`localStorage`).

## Capabilities and Constraints
- Pipeline documentário em 4 etapas: Extração de termos-chave, varredura de RSS jornalístico, leitura de conteúdo integral e julgamento factual estruturado.
- Grau de Veracidade estrito com limiares acadêmicos: Falso (0-29%), Parcialmente Verdadeiro (30-69%), Factual/Verídico (70-100%), ou `?` na ausência de evidências na web.
- Comparador analítico lado a lado de fontes com categorização de postura (`confirma`, `contradiz`, `neutro`).
- Histórico local em arquivo JSON.

## Brand Commitments
VerificaAI — Desk de Investigação e Checagem Factual. Identidade visual inspirada em jornais de referência e publicações acadêmicas (Broadsheet & Archival).

## Evidence on Hand
Repositório Node.js com motor de busca/scraping em `checker.js`, persistência em `history.js`, rotas em `server.js` e templates limpos.

## Product Principles
1. **Rigor Documental:** Fatos verificados mediante evidência cruzada e rastreável.
2. **Neutralidade e Sobriedade:** Interface livre de adornos decorativos, priorizando a legibilidade de dados.
3. **Transparência Metodológica:** Exibição clara de fontes, trechos conflitantes e limiares de veracidade.

## Accessibility & Inclusion
Contraste acadêmico de alto padrão (preto sobre creme/papel), tipografia serifada de alta legibilidade, espaçamento generoso e ausência de animações distrativas.
