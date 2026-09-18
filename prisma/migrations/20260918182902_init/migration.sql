-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "chips" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "minBuyIn" INTEGER NOT NULL DEFAULT 20,
    "startingChips" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO',
    "tableType" TEXT NOT NULL DEFAULT 'CASH',
    "createdById" TEXT NOT NULL,
    "currentRoundNumber" INTEGER NOT NULL DEFAULT 0,
    "actionTimerSeconds" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tables_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "table_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "chips" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "seatOrder" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "table_players_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "table_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "potTotal" INTEGER NOT NULL DEFAULT 0,
    "currentBet" INTEGER NOT NULL DEFAULT 0,
    "turnUserId" TEXT,
    "winnerId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "rounds_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rounds_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "round_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "tablePlayerId" TEXT NOT NULL,
    "contributed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "seatOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "round_players_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "round_players_tablePlayerId_fkey" FOREIGN KEY ("tablePlayerId") REFERENCES "table_players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chip_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "chip_transactions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chip_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chip_transactions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chip_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "roundId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "actions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "actions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tables_code_key" ON "tables"("code");

-- CreateIndex
CREATE UNIQUE INDEX "table_players_tableId_userId_key" ON "table_players"("tableId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "round_players_roundId_tablePlayerId_key" ON "round_players"("roundId", "tablePlayerId");
