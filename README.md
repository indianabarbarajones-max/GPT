# Studio Flow

Primeira versão de um app de gestão para studios de yoga, em português. O foco inicial é padronizar a comunicação e a divulgação de quem trabalha com WhatsApp e planilhas.

## O que funciona

- **Comunicação:** modelos editáveis para interessados, aulas experimentais, acompanhamento, renovação e indicação. Cópia de texto ou abertura de um rascunho no WhatsApp; o envio é feito pela pessoa responsável. Lembretes de acompanhamento entram na rotina.
- **Conteúdo:** planejamento por canal e etapa, edição de legendas e sequência semanal reutilizável. O status “programado” é uma organização interna; não publica nas redes.
- **Alunos:** cadastro, busca, planos e situação. O plano não gera cobranças automaticamente.
- **Agenda:** aulas, horários, instrutores e inscrições respeitando as vagas. Inscrição é reserva, não presença confirmada.
- **Financeiro:** receitas, despesas, vencimentos, confirmação manual e exportação CSV. Os totais mensais agrupam lançamentos pelo vencimento, não pela data de pagamento; não são um extrato bancário.
- **Rotina e crescimento:** tarefas diárias reutilizáveis e metas com progresso manual.
- **Assistente:** resumos e modelos locais por regras. Integração opcional com IA generativa preparada no servidor.

A primeira execução cria dados fictícios do **Studio Aurora**. O banner de demonstração permanece visível. O nome, o responsável e a meta mensal podem ser personalizados. Os registros são persistidos em SQLite; atualizar a página ou reiniciar o servidor não apaga as alterações.

## Experimentar sem instalar programas

A demonstração `Studio-Flow-Abrir.html` contém tudo em um arquivo. No computador, abra-o no Chrome, Edge ou Safari. Ela usa dados fictícios e salva alterações somente neste navegador; não acessa o banco do servidor nem IA generativa. Se o navegador bloquear o armazenamento, o app mostra que as alterações são temporárias. Mover/renomear o arquivo, trocar de navegador ou apagar os dados do navegador pode perder o acesso aos registros locais. Visualizadores de anexos em celulares podem não executar o app.

Para gerar novamente: `npm run build:portable`. O arquivo sai em `.data/Studio-Flow-Abrir.html`. Para testar o arquivo sem rede: `npm run test:portable`.

## Executar

Requer Node.js 24 ou superior.

```bash
cd /workspace/GPT
npm ci
npm run build
npm test
npm start
```

O servidor atende apenas a interface local, na porta **3001**, e entrega a aplicação compilada. Para desenvolvimento com atualização automática:

```bash
npm run dev
```

O Vite usa a porta **5173** e encaminha `/api` para **3001**. As verificações locais incluem `GET /api/health`, `GET /api/state` e `POST /api/assistant` com um JSON contendo `message`.

## Assistente com IA

Sem credencial, o assistente identifica suas respostas como **análise local**. Ele consegue calcular os indicadores atuais e oferecer modelos fixos; não interpreta livremente qualquer pedido como um modelo de linguagem.

Para usar a integração, configure `AI_API_KEY` como segredo do ambiente de execução, destinado a `api.openai.com`, e reinicie o servidor. `AI_MODEL` é opcional; o padrão é `gpt-4.1-mini`. A chave nunca deve entrar em código, no navegador ou em conversa. `.env.example` documenta os nomes; arquivos `.env` não são carregados automaticamente.

O servidor usa a API Responses da OpenAI, com `store: false`, contexto de indicadores agregados e tempo limite. Nomes completos, e-mails e telefones conhecidos dos alunos são removidos do pedido antes do envio. Essa remoção não garante anonimização de informações livres: evite colocar dados pessoais nas mensagens. O pedido e os indicadores são enviados quando você consulta o assistente. Ele não altera cadastros, publica conteúdo nem dispara cobranças.

A indicação “IA configurada” significa apenas que há uma credencial. A conexão real não foi validada nesta entrega por falta de chave. A integração foi testada com resposta simulada, incluindo falha do provedor.

## Dados e limites desta versão

- Banco padrão: `.data/studio.sqlite` (fora do Git). `DATABASE_PATH` permite escolher outro arquivo. Preserve o banco ao atualizar; faça cópias de segurança com o servidor parado.
- Datas operacionais usam o fuso `America/Sao_Paulo`; valores monetários estão em reais.
- É um protótipo local com dados de demonstração. Antes de uso real pela equipe ou publicação, faltam autenticação, permissões, estratégia de backup e recuperação e configuração de hospedagem com HTTPS.
- Não há importação automática das planilhas, integração bancária, cobranças, WhatsApp Business API ou publicação nas redes. A conversa no WhatsApp é aberta pelo usuário, com rascunho para revisão.
- A conversa com o assistente não tem histórico persistente nem contexto entre pedidos. Os registros operacionais têm persistência.

## Desenvolvimento e validação

React + TypeScript + Vite no frontend; Express + SQLite nativo do Node no backend. Fontes são servidas pelo próprio app. Ícones: Lucide.

```bash
npm run build   # TypeScript e build de produção
npm test        # API, validação, persistência, vínculos e assistente
npm run test:browser # Fluxos reais em Chromium; aceita CHROMIUM_PATH
```

Os testes da API e do navegador usam bancos temporários, sem alterar a demonstração. O teste de navegador usa Chromium em `/usr/bin/chromium`; defina `CHROMIUM_PATH` se o executável estiver em outro local. Fluxos de navegador foram conferidos com Chromium em desktop e celular.

Cada tarefa da nuvem já possui um ambiente isolado. Use o checkout existente; não crie Git worktrees sem uma solicitação explícita.
