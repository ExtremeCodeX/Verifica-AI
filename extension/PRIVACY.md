# Privacidade — VerificaAI para navegador

A extensão só captura a seleção ou o artigo de uma página quando você solicita, pelo popup ou pelo menu de contexto. Uma prévia editável é apresentada antes do envio. Não há coleta automática do histórico de navegação, cookies ou formulários. Não contornamos paywalls.

Ao confirmar uma checagem, o texto selecionado e a chave Groq são enviados à API configurada. A API usa a Groq para análise e consulta o Google News e os veículos necessários à apuração. Essas solicitações podem revelar os termos investigados a esses serviços. Use apenas APIs em que confia. A instância padrão é https://verifica-ai-five.vercel.app.

A chave pode ficar salva no armazenamento local do perfil do navegador, sem criptografia e sem sincronização. No modo “Não salvar nesse dispositivo”, ela é usada apenas em memória, transitando entre o popup e o executor interno em segundo plano, e não é gravada no armazenamento da extensão. A chave nunca é enviada a content scripts ou páginas visitadas. Confirmar esse modo remove a chave persistida anteriormente, sem garantir apagamento forense de cópias ou backups. A extensão não protege uma máquina infectada: malware pode capturar a chave em uso. Revogue a chave no Groq em caso de comprometimento.

Até 50 resultados e até 10 rascunhos/erros recentes ficam locais, além de análises em execução. Esses registros incluem o conteúdo que você escolheu verificar, título e URL de origem; não incluem a chave. “Não salvar nesse dispositivo” controla apenas a chave, não o histórico. Exclua registros individualmente ou limpe-os em Configuração e histórico. Análises ativas são preservadas até terminar ou interromper.

Não há contas, anúncios, analytics ou telemetria na extensão. O histórico não é sincronizado com o site nem enviado ao servidor como histórico. O servidor usa a chave enquanto processa a solicitação e não deve persistir conteúdo ou credenciais; instâncias de terceiros podem ter outras práticas. A Groq e os provedores de hospedagem possuem políticas próprias.

A permissão de acesso ao servidor é solicitada para o endpoint escolhido. O navegador pode mostrar uma autorização mais ampla por domínio/portas, conforme suas regras de match patterns. A implementação só envia solicitações ao endpoint configurado. Páginas externas não recebem a chave.

Nenhuma aba de análise é aberta. Fechar/reabrir ou atualizar o popup não interrompe uma checagem já iniciada: um executor interno mantém a conexão e salva o resultado localmente. Fechar o navegador, recarregar/desativar a extensão ou perder a conexão pode interromper a execução. Não há retomada automática nem garantia de cancelamento da cota já consumida no servidor. Resultados concluídos são preservados; tentativas adicionais exigem confirmação explícita.

Código e suporte: https://github.com/ExtremeCodeX/VerificaAI. Site: https://verifica-ai-five.vercel.app.
