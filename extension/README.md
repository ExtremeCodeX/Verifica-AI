# Extensão VerificaAI

Clientes WebExtensions com código compartilhado para Chrome/Edge (Manifest V3, Chrome 127+) e Firefox (Manifest V2 com background persistente, Firefox 140+). Toda a interface fica no popup: pesquisa, revisão, progresso, dossiê, comparador, configuração e histórico. Não há IA embarcada nem código remoto: a extensão consome o mesmo contrato HTTP/SSE do site.

## Preparar

Requer Node.js >=20.18.1 e npm. Na raiz:

```bash
npm ci
npm run build:extension
```

- **Chrome/Edge:** abra `chrome://extensions` ou `edge://extensions`, ative o modo desenvolvedor, escolha “Carregar sem compactação” e selecione `dist/extension/chrome`.
- **Firefox:** abra `about:debugging#/runtime/this-firefox`, escolha “Carregar extensão temporária” e selecione `dist/extension/firefox/manifest.json`. Instalações temporárias não persistem após reiniciar o navegador. Distribuição permanente exige assinatura.
- **ZIPs:** `npm run package:extension` (requer o utilitário `zip`). Os pacotes ficam em `dist/extension/`; esse comando não publica em nenhuma loja.

O build copia Readability e sua licença Apache-2.0 de `@mozilla/readability`, além de Newsreader, Source Serif Pro e IBM Plex Mono dos pacotes Fontsource, com suas licenças. Não há fontes carregadas remotamente. O ícone é uma versão de 128 px do favicon existente do projeto. Os manifests-fonte ficam em `extension/manifests/`; não carregue diretamente a pasta-fonte.

## Utilizar

1. Abra **Chave API** no próprio popup e selecione a API em “Pesquisa avançada e conexão”: `https://verifica-ai-five.vercel.app` (padrão) ou, com `npm start`, `http://localhost:3000`. Quem usa a API hospedada não precisa instalar Node.js nem executar um servidor na máquina.
2. Salve sua chave Groq ou marque “Não salvar nesse dispositivo”. No modo temporário, informe a chave no popup antes de confirmar a análise. Não há senha mestra nem alegação de proteção contra infostealers.
3. Na página desejada, use “Verificar página”/“Verificar seleção” ou o menu de contexto. Páginas internas do navegador e lojas podem impedir captura.
4. Revise o texto e confirme o envio. Mais de 20.000 caracteres exige escolher um trecho; nada é cortado silenciosamente.
5. Pode fechar o popup e continuar navegando: a análise segue em segundo plano. Ao reabrir, você encontra o progresso ou o resultado. Apenas uma análise executa de cada vez; outros rascunhos podem aguardar. Nenhuma aba ou janela de análise é aberta.
6. Consulte veredito, Grau de Veracidade, todas as fontes e comparador dentro do popup. Os indicadores V/P/F/? no ícone identificam o resultado, sem depender apenas da cor.
7. Exclua resultados e rascunhos em **Histórico**, também dentro do popup. Site e extensão não compartilham chave ou histórico.

Fechar ou atualizar apenas o popup não interrompe uma checagem iniciada. Se o navegador fechar, a extensão for recarregada/desativada ou a conexão cair, a execução pode ser interrompida e não é retomada automaticamente. Resultados concluídos continuam no histórico local. Não reutilize o token SSE. Uma nova tentativa pode consumir cota; interromper recebimento não cancela necessariamente o backend.

## Interface e acessibilidade

O popup usa o logo `static/img/Logo_header.png` e cópias locais das folhas de estilo reais do site (`styleglobal.css`, `style-pesquisa.css` e `style-resultado.css`). O build remove somente o import remoto de fontes; `shared/fonts.css` carrega os WOFF2 empacotados. `popup/style.css` adapta espaço e navegação sem criar uma identidade visual paralela. Cards de veredito, progresso, fontes e comparação reutilizam as classes do site. Há temas claro, escuro e conforme o sistema.

Na versão 1.1.2, o popup tem largura explícita de 580 px; a pesquisa usa 360 px de altura (440 px com uma análise recente) e as demais telas têm limite de 520 px. A raiz não depende de `vw`/`dvh`: esses limites causavam um ciclo no autosizing do Chrome que reduzia a janela a 25 × 25 px. Após o navegador atribuir dimensões reais, a altura é ajustada em pixels quando o espaço disponível for menor. Cabeçalho e rodapé permanecem visíveis; só a área central rola quando necessário. O dossiê é dividido em **Resumo**, **Fontes**, **Comparar** e **Detalhes**, com navegação por teclado nas abas. O resumo começa recolhido em até três linhas e pode ser expandido integralmente; o conteúdo enviado fica em Detalhes. Os conteúdos completos são preservados. A prévia usa um campo editável com rolagem própria e informações secundárias recolhidas, sem cortar o texto que será analisado. Configurações avançadas e históricos extensos ainda podem exigir rolagem interna. Chrome e Firefox recebem os mesmos arquivos de interface.

Os formulários têm labels associados, os controles usam foco visível (`:focus-visible`) e as mensagens de andamento usam `role="status"` (com `aria-live="polite"` na análise). A renderização usa `textContent` e URLs HTTP/HTTPS validadas; links externos usam `noopener noreferrer`. A presença desses recursos não equivale a uma auditoria WCAG concluída.

A validação automatizada usa Chromium com API simulada e verifica fechamento/reabertura do popup, ausência de abas novas e encerramento forçado do service worker durante uma checagem, sem duplicar chamadas. Isso não representa validação funcional em Firefox/Edge, ainda pendente no checklist abaixo.

`tests/browser/popup-size.test.js` também abre o **popup nativo pelo botão da extensão** (`action.openPopup`), sem viewport simulado, e verifica dimensões, carregamento/visibilidade da logo, rodapé e redimensionamento ao trocar de tela. Isso cobre uma regressão que o teste anterior, abrindo o HTML em uma aba de tamanho pré-definido, não detectava.

A versão **1.1.3** define a largura de 580 px também no `body`, e não apenas no `html`. Isso segue o [algoritmo de dimensionamento de popups do Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Popups#popup_resizing), que mede o corpo em documentos standards: `width: 100%` deixava a janela preferir uma largura maior que o conteúdo, criando uma faixa lateral vazia. O teste de regressão fixa essa regra e o teste nativo Chromium verifica que corpo e janela têm a mesma largura. A validação nativa automatizada do Firefox continua pendente.

A revisão final teve parecer **SHIP restrito a Chromium e à fidelidade ao site**, não certificação WCAG. Permanecem pendências P2 herdadas para futura auditoria de acessibilidade: contraste do acento escuro `#6371D6`, gestão de foco ao trocar telas e anúncio das etapas da apuração. Testes funcionais em Firefox continuam pendentes.

## Organização

- `background/`: fila serial de jobs, captura explícita, menus, badge e coordenação do executor.
- `content/`: Readability sobre uma cópia do DOM, sem formulários e sem acesso à chave.
- `runner/`: worker que executa HTTP/SSE independentemente do popup. No Chrome/Edge, um documento offscreen com motivo `WORKERS` hospeda o worker e é fechado ao terminar. No Firefox, o background persistente hospeda o mesmo worker. A chave temporária só transita em memória entre contextos internos confiáveis, nunca por storage ou content scripts.
- `popup/`: toda a interação visível, incluindo configuração, histórico, prévia e dossiê; nunca é responsável pelo stream.
- `shared/`: validação, cliente SSE incremental, configurações e renderização com `textContent` e URLs HTTP/HTTPS validadas.

`storage.local`: `settings` (endpoint, modo temporário, tema, opções), `groq_api_key` (somente modo persistente), `jobs` e `ui` (tela e análise selecionada). Os jobs guardam id, timestamps, origem, texto, etapa, estado e resultado normalizado. Resultados: máximo 50; outros estados não ativos: máximo 10. Escritas de jobs são serializadas no background. A chave nunca faz parte de um job nem de mensagens para content scripts. Onde suportado, o storage é restrito a contextos confiáveis. Rascunhos e resultados da versão anterior são mantidos; jobs ativos sem executor sobrevivente ficam interrompidos, sem repetição automática.

## Testes

```bash
npm test
npm run test:browser
```

Os testes não usam credenciais reais. Os testes de navegador usam Playwright/Chromium e uma API HTTP/SSE simulada; `CHROMIUM_PATH` pode indicar o executável. A compatibilidade Firefox deve também passar pelo checklist manual antes de distribuição.

As capturas de teste ficam em `/tmp/opencode/verificaai-tests/review`; use `CAPTURE_REVIEW=0` para executar somente as verificações funcionais. Neste ambiente, `web-ext lint` validou o pacote Firefox sem erros, com dois avisos de `innerHTML` dentro do Readability. Essa biblioteca opera sobre uma cópia do documento; a extensão consome apenas seu texto, nunca renderiza o HTML extraído. Os avisos não foram ocultados nem a biblioteca alterada.

Checklist manual em Chrome, Edge e Firefox:

- Captura de artigo, seleção, página dinâmica, página restrita e paywall sem bypass.
- Permissão negada, API local desligada, HTTP público recusado, HTTPS configurável.
- Popup fechado/reaberto, duplo clique, segunda análise, encerramento do executor e reinício do navegador.
- Badge limpo ao navegar; resultado antigo nunca aplicado a outra URL.
- Erros de chave, quota, limite, token expirado e conexão interrompida separados de vereditos.
- Chave temporária ausente de todos os storages; troca de modo remove chave antiga; exclusão de histórico e quota de storage.
- Dossiê sem nova chamada, links seguros, navegação por teclado, foco, claro/escuro e zoom.

## Distribuição e limites

Verifique o backend oficial com uma chave de teste autorizada antes de publicar: buffering/timeouts de hospedagem e o mapa de tokens em memória podem variar entre instâncias serverless. Nenhuma alteração de infraestrutura é feita automaticamente por esta implementação. A extensão não pode resolver perda de token entre instâncias por reconexão.

Prepare política pública baseada em `PRIVACY.md`, screenshots reais, descrições de permissões e testes nos navegadores-alvo. O identificador Firefox e as declarações de coleta devem ser revisados pelo responsável pela publicação, conforme as exigências vigentes da loja. Não há publicação automática.
