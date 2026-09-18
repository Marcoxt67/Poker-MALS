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

**Banco de dados:** SQLite (desenvolvimento) via Prisma ORM. Os campos do tipo
enum são armazenados como `String` porque o conector SQLite do Prisma não
suporta enums nativos — os valores válidos são impostos na camada TypeScript
(`server/src/utils/enums.ts`). Ao migrar para PostgreSQL, esses campos podem
virar `enum` reais no `schema.prisma`.

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
│       ├── database/       # Cliente Prisma
│       ├── utils/          # AppError, JWT, enums, asyncHandler
│       └── tests/          # Testes Vitest + Supertest
│
├── prisma/
│   └── schema.prisma       # Modelos: User, Table, TablePlayer, Round,
│                            # RoundPlayer, ChipTransaction, Action
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
7. Só então aplica a transação, sempre dentro de uma transação Prisma
   (`$transaction`) que atualiza `TablePlayer.chips`, `RoundPlayer.contributed`,
   `Round.potTotal`, grava um `ChipTransaction` e um `Action`, e emite o evento
   Socket.IO correspondente.

O frontend nunca decide saldo, pote ou vencedor — ele só reflete o que o
backend retorna.

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
| `DATABASE_URL`         | Conexão do Prisma. Padrão: `file:./dev.db` (SQLite, relativo a `prisma/`). |
| `JWT_SECRET`           | Segredo usado para assinar os tokens JWT.                          |
| `JWT_EXPIRES_IN`       | Validade do token (ex: `7d`).                                      |
| `PORT`                 | Porta do servidor Express + Socket.IO (padrão `4000`).             |
| `CORS_ORIGIN`          | Origem(ns) permitidas para chamadas de API/Socket.IO.              |
| `DEFAULT_USER_CHIPS`   | Fichas iniciais do "carteira" do usuário ao se cadastrar (cosmético no dashboard). |
| `VITE_API_URL`         | URL da API usada pelo frontend.                                    |
| `VITE_SOCKET_URL`      | URL do servidor Socket.IO usada pelo frontend.                     |

O `client/vite.config.ts` aponta `envDir` para a raiz do projeto, então um único
arquivo `.env` na raiz abastece tanto o servidor quanto o cliente.

## Banco de dados e migrações

O schema fica em `prisma/schema.prisma` (fora de `server/`, para facilitar uma
futura troca de SQLite → PostgreSQL sem mexer em código da aplicação).

```bash
npm run prisma:generate   # gera o Prisma Client
npm run prisma:migrate    # cria/aplica migrations e o banco SQLite (prisma/dev.db)
npm run prisma:studio     # abre o Prisma Studio para inspecionar os dados
```

### Migrando para PostgreSQL no futuro

1. Troque `provider = "sqlite"` por `provider = "postgresql"` em `prisma/schema.prisma`.
2. Aponte `DATABASE_URL` para a string de conexão do Postgres.
3. (Opcional) Converta os campos `String` documentados como "enum-like" (ver
   comentários no `schema.prisma`) para `enum` nativos do Postgres.
4. Rode `npx prisma migrate dev` novamente.

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
  (equivale a `prisma migrate deploy --schema prisma/schema.prisma && npm run start -w server` —
  aplica as migrations pendentes e então inicia `server/dist/index.js`)
- **Environment Variables:**
  - `JWT_SECRET` — um valor aleatório/longo (obrigatório)
  - `DATABASE_URL` — `file:./dev.db` (padrão do `.env.example`; veja o aviso abaixo)
  - `CORS_ORIGIN` — pode manter o padrão, já que front e back ficam na mesma origem
  - `DEFAULT_USER_CHIPS` — opcional, padrão `1000`
  - **Não** defina `PORT` nem `VITE_API_URL`/`VITE_SOCKET_URL` — o Render injeta
    `PORT` automaticamente, e deixando as variáveis `VITE_*` de fora o frontend
    já assume "mesma origem" em produção.

> ⚠️ **Persistência do SQLite no Render.** O disco de um Web Service do Render
> sem um *persistent disk* é efêmero: o arquivo `prisma/dev.db` (e, portanto,
> todas as mesas, fichas e histórico) é **recriado do zero a cada novo deploy**.
> Para uma demonstração isso é aceitável, mas para persistir dados entre
> deploys você tem duas opções:
>
> 1. Adicionar um [Persistent Disk](https://render.com/docs/disks) montado em,
>    por exemplo, `/var/data`, e apontar `DATABASE_URL=file:/var/data/dev.db`.
> 2. Migrar para PostgreSQL (recomendado para produção — o schema já foi
>    desenhado para isso, veja "Migrando para PostgreSQL" acima): crie um banco
>    Postgres no Render (ou use um serviço gerenciado), troque `provider` em
>    `prisma/schema.prisma` para `"postgresql"` e aponte `DATABASE_URL` para a
>    connection string fornecida.

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

Os testes usam um banco SQLite isolado (`prisma/test.db`, criado/recriado via
`prisma db push` no `globalSetup` do Vitest) e cobrem, entre outras coisas:

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
