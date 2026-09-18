# Poker MALS — Simulador de Mesa de Poker com Fichas Virtuais

> ⚠️ **SIMULAÇÃO — FICHAS SEM VALOR MONETÁRIO.** Este projeto não envolve dinheiro
> real, PIX, cartão, saque ou depósito. Os valores em fichas são exclusivamente
> virtuais e existem apenas para fins de simulação/entretenimento.

Plataforma web completa para simulação de mesas de poker com fichas virtuais em
tempo real: cadastro/login, criação e ingresso em mesas, um administrador de mesa
(**DIRE**) que controla fichas e rodadas, e jogadores que apostam, pagam, aumentam
ou saem de cada rodada, com pote calculado e auditado inteiramente no backend.

## Descrição

- Cada mesa tem um **DIRE** (o criador da mesa), que é o único que pode
  administrar fichas, jogadores e o estado da mesa.
- Jogadores comuns só podem agir com fichas que já possuem: apostar, pagar,
  aumentar ou sair da rodada.
- Toda movimentação de fichas (`ChipTransaction`) e toda ação relevante (`Action`)
  fica registrada, formando um histórico auditável — nada é alterado "em silêncio".
- O backend nunca confia em valores enviados pelo frontend: turno, saldo, status
  da rodada e permissões são sempre validados no servidor antes de qualquer
  movimentação de fichas.

## Tecnologias

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router, Socket.IO Client.

**Backend:** Node.js, Express, TypeScript, Zod (validação), JWT + bcrypt (autenticação).

**Banco de dados:** Firebase Realtime Database. Todo o acesso passa por um único
módulo (`server/src/database/realtime.ts`), então trocar o SDK web pelo Admin SDK
(service account) depois é uma mudança contida a esse arquivo.

**Tempo real:** Socket.IO (um socket por usuário autenticado via JWT, entrando
na "sala" da mesa após conectar).

**Testes:** Vitest + Supertest (backend).

## Arquitetura

```
poker-mals/
├── client/                 # Frontend (Vite + React + TS + Tailwind)
│   └── src/
│       ├── components/     # Componentes reutilizáveis (Layout, Button, mesa/*)
│       ├── pages/          # Login, Register, Dashboard, Profile, TableRoom...
│       ├── hooks/          # useTableRoom (estado + Socket.IO), useCountdown
│       ├── services/       # Clientes de API (axios) por domínio
│       ├── contexts/       # AuthContext, SocketContext
│       └── types/          # Tipos compartilhados com o backend
│
├── server/                 # Backend (Express + TS)
│   └── src/
│       ├── controllers/    # Parsing de request/response
│       ├── routes/         # Definição das rotas Express
│       ├── services/       # Regras de negócio (auth, table, round, chip, history)
│       ├── middleware/     # requireAuth, errorHandler
│       ├── socket/         # Servidor Socket.IO + helpers de emissão
│       ├── database/       # Acesso ao Realtime Database (realtime.ts) + models
│       ├── utils/          # AppError, JWT, enums, asyncHandler
│       └── tests/          # Testes Vitest + Supertest (emulador)
│
├── .env.example
└── package.json             # Workspace raiz (scripts para client + server)
```

### Por que a lógica de apostas fica só no backend?

Toda ação de jogo (`bet`, `call`, `raise`, `fold`, seleção de vencedor) é uma
rota HTTP autenticada. O servidor:

1. Confirma que o usuário está autenticado (`requireAuth`).
2. Confirma que ele pertence à mesa e está com status `ACTIVE`.
3. Confirma que é realmente a vez dele (`round.turnUserId`).
4. Confirma que a rodada está `EM_ANDAMENTO` e a mesa não está `PAUSADA`.
5. Recalcula o valor necessário (nunca aceita o pote/saldo vindo do cliente).
6. Confirma que o jogador possui fichas suficientes.
7. Só então aplica a mudança, dentro de uma transação do Realtime Database sobre
   o nó `/tables/{id}`, que atualiza de forma atômica as fichas do jogador, a
   contribuição dele na rodada, o pote e de quem é a vez; em seguida grava o
   histórico/extrato e emite o evento Socket.IO correspondente.

Os passos 1–6 acontecem **dentro** da transação, ou seja, são validados contra o
valor que está prestes a ser gravado e não contra uma leitura anterior — dois
cliques simultâneos não conseguem gastar as mesmas fichas duas vezes.

O frontend nunca decide saldo, pote ou vencedor — ele só reflete o que o
backend retorna.

### Formato dos dados

```
/users/{userId}                 conta + carteira
/usernames/{username}           -> userId   (unicidade)
/emails/{email}                 -> userId   (unicidade)
/tableCodes/{CODE}              -> tableId  (unicidade)
/tables/{tableId}               meta + jogadores + rodada atual
/tableHistory/{tableId}/{id}    log de ações (append-only)
/userLedger/{userId}/{id}       extrato de fichas (append-only)
```

Tudo que precisa mudar junto numa aposta fica sob o mesmo nó `/tables/{tableId}`,
porque uma transação do Realtime Database cobre uma subárvore. O histórico e o
extrato ficam fora dele de propósito, para que as transações continuem pequenas.

> Chaves do Realtime Database não aceitam `.`, `#`, `$`, `[`, `]` ou `/`, então
> emails são escapados antes de virarem chave (`encodeKey` em `realtime.ts`).

## Instalação

Pré-requisitos: Node.js 20+ e npm 10+.

```bash
git clone <repo>
cd poker-mals
npm install          # instala as dependências de client/ e server/ (workspaces)
cp .env.example .env # ajuste se necessário
```

## Configuração / Variáveis de ambiente

Veja `.env.example` na raiz do projeto. As principais variáveis:

| Variável              | Descrição                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `JWT_SECRET`           | Segredo usado para assinar os tokens JWT. **Este é um segredo de verdade.** |
| `JWT_EXPIRES_IN`       | Validade do token (ex: `7d`).                                      |
| `PORT`                 | Porta do servidor Express + Socket.IO (padrão `4000`; o Render injeta sozinho). |
| `CORS_ORIGIN`          | Origem(ns) permitidas — irrelevante quando front e back ficam na mesma origem. |
| `DEFAULT_USER_CHIPS`   | Fichas iniciais da carteira do usuário ao se cadastrar (cosmético no dashboard). |
| `FIREBASE_*`           | Config web do Firebase. **Não são segredos** (veja a seção de segurança). O código já traz os valores do projeto como padrão. |
| `FIREBASE_DATABASE_URL`| URL do Realtime Database. Depende da região do banco — não vem no snippet do console. |
| `FIREBASE_DATABASE_EMULATOR_HOST` | Se preenchido, usa o emulador local em vez do projeto real. Vazio em produção. |
| `VITE_API_URL` / `VITE_SOCKET_URL` | Deixe vazios quando o backend serve o frontend. |

O `client/vite.config.ts` aponta `envDir` para a raiz do projeto, então um único
arquivo `.env` na raiz abastece tanto o servidor quanto o cliente.

## Banco de dados

Não há migrations: o Realtime Database é schemaless e os nós são criados sob
demanda. Basta apontar `FIREBASE_DATABASE_URL` para o banco certo.

Para desenvolver sem tocar no projeto real, suba o emulador e aponte o servidor
para ele:

```bash
npm run emulator                                   # emulador na porta 9000
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 npm run dev:server
```

### Segurança do Firebase (leia antes de publicar)

A `apiKey` da config web **não é um segredo** — ela identifica o projeto e é
feita para ficar pública no bundle do frontend. Quem protege os dados são as
**regras do Realtime Database**.

Este projeto está configurado para rodar com as regras abertas (`true`), o que
significa que **qualquer pessoa que conheça o ID do projeto pode ler e escrever
direto no banco, por fora do app** — inclusive alterar fichas e potes. As regras
de DIRE/jogador implementadas no backend continuam valendo para quem usa o app
normalmente, mas não impedem o acesso direto.

Para blindar, o caminho é: gerar uma *service account* no Firebase Console
(Configurações do projeto → Contas de serviço → Gerar nova chave privada),
trocar o SDK web pelo Admin SDK dentro de `server/src/database/realtime.ts` —
o único arquivo que fala com o banco — e então fechar as regras
(`{"rules": {".read": false, ".write": false}}`). O Admin SDK ignora as regras,
então o app continua funcionando e o acesso direto deixa de existir.

## Como iniciar

Em dois terminais (ou usando o script `dev` que sobe os dois com `concurrently`):

```bash
npm run dev            # backend (porta 4000) + frontend (porta 5173) juntos
# ou individualmente:
npm run dev:server
npm run dev:client
```

Acesse `http://localhost:5173`.

## Deploy (Render)

Em produção, o próprio servidor Express serve tanto a API quanto os arquivos
estáticos do build do frontend (`client/dist`) a partir da mesma origem — veja
`server/src/app.ts`. Isso permite implantar o projeto inteiro como **um único
Web Service** no Render, sem precisar de dois serviços nem configurar CORS.

Configuração do Web Service no Render:

- **Build Command:** `npm install; npm run build`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `JWT_SECRET` — um valor aleatório/longo (obrigatório)
  - `FIREBASE_DATABASE_URL` — só se o banco não estiver em `us-central1`
    (o padrão do código é `https://poker-326a4-default-rtdb.firebaseio.com`)
  - `DEFAULT_USER_CHIPS` — opcional, padrão `1000`
  - **Não** defina `PORT`, `FIREBASE_DATABASE_EMULATOR_HOST` nem
    `VITE_API_URL`/`VITE_SOCKET_URL` — o Render injeta `PORT` automaticamente,
    o emulador só existe em desenvolvimento, e deixar as `VITE_*` de fora faz o
    frontend assumir "mesma origem".

Como os dados agora vivem no Firebase, o disco efêmero do Render deixou de ser
um problema: nada é perdido entre deploys.

Se preferir implantar o frontend separadamente (ex: como Static Site na Vercel/
Netlify) em vez do modo "um único serviço", defina `VITE_API_URL` e
`VITE_SOCKET_URL` apontando para a URL pública do serviço de backend, e ajuste
`CORS_ORIGIN` no backend para a URL do frontend.

## Como executar os testes

```bash
npm test                # roda a suíte do backend (Vitest + Supertest)
# ou:
cd server && npx vitest run
```

O `globalSetup` do Vitest sobe um **emulador do Realtime Database** e o derruba
ao final, então a suíte nunca toca no projeto real do Firebase (requer Java, que
o emulador usa). Os testes cobrem, entre outras coisas:

- Cadastro, login (por email ou usuário) e autenticação via JWT.
- Criação de mesa e definição automática do DIRE.
- Entrada em mesa por código, mesa cheia, entrada duplicada.
- Permissões do DIRE (adicionar/remover fichas, remover jogador, pausar mesa)
  sendo negadas para jogadores comuns.
- Fluxo completo de rodada: apostar → pagar → aumentar → encerrar rodada →
  selecionar vencedor → pote entregue, com conferência de saldo fichas a fichas.
- Fim automático de rodada quando todos os demais jogadores saem (fold).
- Regras de turno (agir fora da vez é rejeitado).
- Valor mínimo de aposta.
- **Tentativas maliciosas de alterar fichas pelo frontend**: valores negativos,
  decimais, em formato string, ou muito acima do saldo do jogador — todas
  rejeitadas pelo servidor.
- Visibilidade do histórico (DIRE vê tudo; jogador vê só as próprias ações) e
  ocultação de fichas de mesas das quais o usuário não participa.

## API

Todas as rotas (exceto `/auth/register` e `/auth/login`) exigem
`Authorization: Bearer <token>`.

**Autenticação**
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
```

**Mesas**
```
POST   /api/tables                       Criar mesa (quem cria vira DIRE)
GET    /api/tables?mine=true|false       Listar mesas (públicas ou só as minhas)
GET    /api/tables/:id                   Detalhe da mesa
POST   /api/tables/join                  Entrar em uma mesa (body: { code })
POST   /api/tables/:id/leave             Sair da mesa
GET    /api/tables/:id/history           Histórico (DIRE: completo · jogador: próprio)
```

**Administração (somente DIRE)**
```
POST   /api/tables/:id/chips/add         { targetUserId, amount, description? }
POST   /api/tables/:id/chips/remove      { targetUserId, amount, description? }
POST   /api/tables/:id/players/remove    { targetUserId }
POST   /api/tables/:id/pause
POST   /api/tables/:id/resume
PATCH  /api/tables/:id/settings          { minBuyIn?, actionTimerSeconds? }
POST   /api/tables/:id/rounds            Iniciar rodada
POST   /api/tables/:id/end               Encerrar rodada (abre seleção de vencedor)
```

**Rodadas**
```
GET    /api/rounds/:roundId
POST   /api/rounds/:roundId/bet          { amount }
POST   /api/rounds/:roundId/call
POST   /api/rounds/:roundId/raise        { amount }
POST   /api/rounds/:roundId/fold
POST   /api/rounds/:roundId/winner       { winnerUserId }  (somente DIRE)
```

**Usuário**
```
GET    /api/users/me/transactions        Extrato pessoal de fichas (todas as mesas)
```

### Eventos Socket.IO (sala `table:<id>`, após `socket.emit("join_table", tableId)`)

`player_joined`, `player_left`, `round_started`, `player_bet`, `player_folded`,
`turn_changed`, `pot_updated`, `round_finished`, `round_finalizing`,
`chips_updated`, `table_paused`, `table_resumed`, `table_settings_updated`.

O cliente conecta ao Socket.IO enviando `{ auth: { token } }` no handshake; o
servidor valida o JWT antes de aceitar a conexão.

## Regras do sistema (resumo)

1. Sem dinheiro real, PIX, cartão, saque ou depósito — fichas são 100% virtuais.
2. Um usuário pode participar de várias mesas, mas só uma vez em cada mesa.
3. Toda mesa tem exatamente um DIRE (quem a criou); o DIRE não pode sair da mesa.
4. Somente o DIRE administra fichas, jogadores e o estado da mesa.
5. Jogadores nunca criam fichas nem alteram saldo diretamente — cada ficha
   movimentada gera um `ChipTransaction` auditável.
6. Saldo nunca fica negativo; apostas abaixo do mínimo da mesa são rejeitadas.
7. Ações fora do turno, com a rodada encerrada, com a mesa pausada, ou depois
   que o jogador já saiu (`fold`) da rodada são sempre rejeitadas pelo servidor.
8. O pote é sempre calculado e validado no backend, nunca recebido do cliente.
9. Ao entregar o pote ao vencedor, é criado um `ChipTransaction` do tipo `POT_WIN`.
10. Histórico financeiro nunca é apagado.

## Limitações da primeira versão

Conforme escopo definido: sem cartas/avaliação de mãos, sem ranking, sem IA.
O timer de ação é decorativo no client e, ao expirar, aciona automaticamente
um `fold` do próprio jogador (chamada real ao backend) — não há um scheduler
server-side independente do cliente nesta primeira versão.
