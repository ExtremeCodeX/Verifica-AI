# CONTEXT.md — VerificaAI

Este documento resume o estado completo, decisões técnicas, arquitetura e instruções do projeto **VerificaAI** para continuidade em sessões futuras.

---

## 1. Visão Geral do Projeto
* **Nome do Projeto:** VerificaAI
* **Objetivo:** Sistema inteligente de verificação de fatos e notícias em tempo real utilizando Inteligência Artificial (Groq SDK) e raspagem de dados de portais jornalísticos (Google News).
* **Problema que Resolve:** Combate à desinformação (fake news) permitindo que usuários validem rapidamente a veracidade de textos ou URLs através de cruzamento de fontes jornalísticas, análise de viés, pontuação objetiva de grau de veracidade e comparação lado a lado de fontes.

---

## 2. Stack Tecnológica & Dependências
* **Runtime:** Node.js
* **Framework Backend:** Express (`express`)
* **SDK de IA:** `groq-sdk` (Modelos: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`)
* **Raspagem & RSS:** `axios`, `cheerio`, `rss-parser`
* **Utilitários:** `cors`
* **Frontend:** HTML5, CSS3 (Design moderno com Variáveis CSS, Flexbox/Grid, Temas escuros/claros), Vanilla JavaScript (ES6+), Server-Sent Events (SSE) para progresso em tempo real.
* **Armazenamento:**
  * Chave de API Groq: opcionalmente no `localStorage`; “Não salvar nesse dispositivo” mantém a chave apenas em memória na página de resultado.
  * Histórico de verificações: `localStorage` (`verificai_historico`), limitado a 50 itens, sem persistência no servidor.
  * Extensão: armazenamento separado em `storage.local`; chave temporária somente em memória nos contextos internos do popup/executor. Toda a interface fica no popup; fechar/reabrir não interrompe checagens iniciadas.

---

## 3. Arquitetura & Estrutura de Pastas
```text
/
├── server.js            # Servidor Express, rotas da API, endpoints SSE e gerenciamento de sessões
├── checker.js           # Motor de verificação (extração de keywords, busca Google News, scraping Cheerio, Groq AI)
├── package.json         # Dependências e scripts do projeto (npm start)
├── extension/           # Extensão Chrome/Edge e Firefox; ver extension/README.md
├── scripts/             # Build e empacotamento da extensão
├── tests/               # Testes unitários e fluxos Chromium com API simulada
├── static/
│   ├── script/
│   │   ├── script.js    # Lógica do front-end (pesquisa, SSE, modal de API Key, renderização de resultados, comparador)
│   │   └── historico.js # Lógica da página de histórico (carregamento, cards, detalhes, exclusão)
│   └── style/
│       ├── styleglobal.css   # Variáveis globais, reset e layout base
│       ├── style-pesquisa.css# Estilos da página inicial / hero
│       ├── style-resultado.css# Estilos do card de veredicto, terminal SSE, artigos e modal de comparação
│       └── style-historico.css# Estilos da página de histórico e modal de detalhes
└── templates/
    ├── index.html       # Página inicial (pesquisa e painel avançado)
    ├── resultado.html   # Página de progresso em tempo real e resultado detalhado com comparador de fontes
    └── historico.html   # Página de histórico de verificações salvas
```

---

## 4. Decisões Técnicas & Regras de Negócio

### A. Grau de Veracidade & Limiares
A pontuação de veracidade avalia a proporção de fatos verdadeiros vs. falsos encontrados na web:
* **0% a 29% ➔ ❌ Falsa / Invenção** (Alegação majoritariamente falsa, invenção ou distorcida).
* **30% a 69% ➔ ⚠️ Parcialmente Verdadeira** (Fundo de verdade misturado com exageros ou omissões).
* **70% a 100% ➔ ✅ Factual / Verídica** (Fatos centrais integralmente confirmados por fontes confiáveis).
* **Caso Sem Dados:** Se nenhum artigo for encontrado ou a notícia for classificada como *"NÃO ENCONTRADA NOS SITES"*, exibe-se **`?`** no lugar da porcentagem.

### B. Segurança & Privacidade de Chave API
* Os usuários configuram sua própria chave da API Groq gratuita através de um modal acessível pelo cabeçalho (`⚙ Chave API`).
* A chave pode ser salva no `localStorage` ou usada somente em memória. Ela é enviada à API e à Groq para a checagem, sem persistência no servidor. O modo temporário remove uma chave previamente salva após confirmação. Não há cofre criptografado ou proteção garantida contra malware.

### C. Comparador de Múltiplas Fontes (Visão Lado a Lado)
* A IA analisa e categoriza a posição de cada fonte consultada (`confirma`, `contradiz` ou `neutro`).
* Na página de resultados, um botão **"🔍 Comparar Fontes Lado a Lado"** abre um modal em grid comparando o posicionamento e trechos de cada veículo de imprensa consultado.

---

## 5. Estado Atual do Projeto

### ✅ O que já foi implementado e está funcionando:
1. **Migração completa para Node.js:** Servidor Express rodando de forma ágil e independente.
2. **Pipeline de Verificação em 4 Etapas (com SSE):**
   - Extração de palavras-chave inteligentes com Groq.
   - Busca de artigos no Google News RSS + reformulação automática de queries.
   - Scraping e leitura de conteúdo textual via `cheerio` e `axios`.
   - Diagnóstico estruturado em JSON pela IA.
3. **Interface Gráfica Moderna:** Páginas de Pesquisa, Resultado e Histórico estilizadas.
4. **Histórico local no navegador:** Salva, lista, exibe detalhes e permite apagar verificações, sem banco ou arquivo de histórico no servidor.
5. **Grau de Veracidade:** Substituiu o conceito vago de confiança por limiares objetivos (0-29%, 30-69%, 70-100% e `?`).
6. **Comparador Lado a Lado de Fontes:** Modal interativo comparando a postura das fontes jornalísticas.

### 🚧 Próximos Passos Sugeridos (Futuras Implementações):
* Extensão de navegador: build local para Chrome/Edge 127+ (MV3/offscreen com worker) e Firefox 140+ (MV2/background persistente com worker). Captura explícita, revisão, progresso, dossiê, configuração e histórico inteiramente no popup, usando CSS e logo reais do site. Fechar o popup não interrompe a análise; resultados ficam locais. Publicação e validação manual completa dos navegadores pendentes; instruções em `extension/README.md`.
* Painel de estatísticas e tendências de desinformação (`/dashboard`).
* Exportação de relatório em PDF para fins acadêmicos/jornalísticos.
* Sistema opcional de feedback do usuário ("A IA errou?").

---

## 6. Como Executar / Testar

### Pré-requisitos:
* Node.js instalado na máquina.
* Uma chave gratuita da API Groq ([Obter no Groq Console](https://console.groq.com/keys)).

### Comandos:
1. **Instalar Dependências:**
   ```bash
   npm install
   ```
2. **Iniciar o Servidor:**
   ```bash
   npm start
   ```
3. **Acessar no Navegador:**
   ```text
   http://localhost:3000
   ```
   *(Na primeira execução, clique em "⚙ Chave API" no topo para inserir sua chave da API Groq).*
