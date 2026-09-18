import { z } from "zod";
import { prisma } from "../database/prisma";
import { AppError } from "../utils/AppError";
import { ChipTransactionType, TablePlayerRole, TablePlayerStatus, TableStatus } from "../utils/enums";
import { recordChipTransaction } from "./chipService";
import { emitToTable } from "../socket/io";
import { roundService } from "./roundService";

export const createTableSchema = z.object({
  name: z.string().trim().min(3, "O nome da mesa deve possuir pelo menos 3 caracteres.").max(60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,12}$/, "O código deve conter de 4 a 12 letras/números.")
    .optional(),
  maxPlayers: z.number().int().min(2, "A mesa precisa de pelo menos 2 jogadores.").max(10, "Máximo de 10 jogadores."),
  minBuyIn: z.number().int().min(1, "O valor mínimo de entrada deve ser maior que zero."),
  startingChips: z.number().int().min(1, "A quantidade inicial de fichas deve ser maior que zero."),
  tableType: z.string().trim().min(1).max(20).optional(),
});

export const adminChipsSchema = z.object({
  targetUserId: z.string().min(1),
  amount: z.number().int().positive("A quantidade deve ser maior que zero."),
  description: z.string().trim().min(1).max(140).optional(),
});

export const updateSettingsSchema = z.object({
  minBuyIn: z.number().int().min(1).optional(),
  actionTimerSeconds: z.number().int().min(5).max(300).optional(),
});

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const tableSummary = (table: {
  id: string;
  name: string;
  code: string;
  maxPlayers: number;
  minBuyIn: number;
  startingChips: number;
  status: string;
  tableType: string;
  currentRoundNumber: number;
  actionTimerSeconds: number;
  createdById: string;
  createdAt: Date;
  players: { id: string; status: string }[];
}) => ({
  id: table.id,
  name: table.name,
  code: table.code,
  maxPlayers: table.maxPlayers,
  minBuyIn: table.minBuyIn,
  startingChips: table.startingChips,
  status: table.status,
  tableType: table.tableType,
  currentRoundNumber: table.currentRoundNumber,
  actionTimerSeconds: table.actionTimerSeconds,
  createdById: table.createdById,
  createdAt: table.createdAt,
  playerCount: table.players.filter((p) => p.status === TablePlayerStatus.ACTIVE).length,
});

export const tableService = {
  async createTable(userId: string, input: z.infer<typeof createTableSchema>) {
    let code = input.code ?? genCode();
    for (let attempts = 0; attempts < 5; attempts++) {
      const existing = await prisma.table.findUnique({ where: { code } });
      if (!existing) break;
      if (input.code) throw AppError.conflict("Este código de mesa já está em uso.");
      code = genCode();
    }

    const table = await prisma.$transaction(async (tx) => {
      const created = await tx.table.create({
        data: {
          name: input.name,
          code,
          maxPlayers: input.maxPlayers,
          minBuyIn: input.minBuyIn,
          startingChips: input.startingChips,
          tableType: input.tableType ?? "CASH",
          createdById: userId,
        },
      });

      await tx.tablePlayer.create({
        data: {
          tableId: created.id,
          userId,
          role: TablePlayerRole.DIRE,
          chips: input.startingChips,
          seatOrder: 0,
        },
      });

      await recordChipTransaction(tx, {
        tableId: created.id,
        userId,
        type: ChipTransactionType.BUY_IN,
        amount: input.startingChips,
        createdById: userId,
        description: "Fichas iniciais (criação da mesa)",
      });

      await tx.action.create({
        data: {
          tableId: created.id,
          userId,
          type: "JOIN",
          description: "Mesa criada e DIRE definido.",
        },
      });

      return created;
    });

    return this.getTableForUser(userId, table.id);
  },

  async listTables(userId: string, mine: boolean) {
    const tables = await prisma.table.findMany({
      where: mine ? { players: { some: { userId, status: TablePlayerStatus.ACTIVE } } } : undefined,
      include: { players: { select: { id: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });

    return tables.map(tableSummary);
  },

  async getTablePlayerRecord(tableId: string, userId: string) {
    return prisma.tablePlayer.findUnique({ where: { tableId_userId: { tableId, userId } } });
  },

  async assertDire(tableId: string, userId: string) {
    const player = await this.getTablePlayerRecord(tableId, userId);
    if (!player || player.status !== TablePlayerStatus.ACTIVE || player.role !== TablePlayerRole.DIRE) {
      throw AppError.forbidden("Somente o DIRE pode executar esta ação.");
    }
    return player;
  },

  async assertActivePlayer(tableId: string, userId: string) {
    const player = await this.getTablePlayerRecord(tableId, userId);
    if (!player || player.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.forbidden("Você não está nesta mesa.");
    }
    return player;
  },

  async getTableForUser(userId: string, tableId: string) {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        players: {
          include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
          orderBy: { seatOrder: "asc" },
        },
      },
    });

    if (!table) throw AppError.notFound("Mesa não encontrada.");

    const me = table.players.find((p) => p.userId === userId && p.status === TablePlayerStatus.ACTIVE);
    const activeRound = await prisma.round.findFirst({
      where: { tableId, status: "EM_ANDAMENTO" },
      include: {
        roundPlayers: { include: { tablePlayer: { include: { user: true } } } },
      },
      orderBy: { roundNumber: "desc" },
    });

    const isMember = Boolean(me);

    return {
      ...tableSummary(table),
      isMember,
      myRole: me?.role ?? null,
      players: isMember
        ? table.players.map((p) => ({
            id: p.id,
            userId: p.userId,
            username: p.user.username,
            displayName: p.user.displayName,
            avatar: p.user.avatar,
            role: p.role,
            chips: p.chips,
            status: p.status,
            seatOrder: p.seatOrder,
          }))
        : [],
      activeRound:
        isMember && activeRound
          ? {
              id: activeRound.id,
              roundNumber: activeRound.roundNumber,
              status: activeRound.status,
              potTotal: activeRound.potTotal,
              currentBet: activeRound.currentBet,
              turnUserId: activeRound.turnUserId,
              players: activeRound.roundPlayers.map((rp) => ({
                tablePlayerId: rp.tablePlayerId,
                userId: rp.tablePlayer.userId,
                displayName: rp.tablePlayer.user.displayName,
                contributed: rp.contributed,
                status: rp.status,
                seatOrder: rp.seatOrder,
              })),
            }
          : null,
    };
  },

  async joinTable(userId: string, code: string) {
    const table = await prisma.table.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { players: true },
    });
    if (!table) throw AppError.notFound("Mesa não encontrada. Verifique o código.");

    if (table.status === TableStatus.FINALIZADA) {
      throw AppError.badRequest("Esta mesa já foi encerrada.");
    }

    const existing = table.players.find((p) => p.userId === userId);
    if (existing && existing.status === TablePlayerStatus.ACTIVE) {
      throw AppError.conflict("Você já está nesta mesa.");
    }

    const activeCount = table.players.filter((p) => p.status === TablePlayerStatus.ACTIVE).length;
    if (activeCount >= table.maxPlayers) {
      throw AppError.conflict("A mesa está cheia.");
    }

    await prisma.$transaction(async (tx) => {
      let tablePlayer;
      if (existing) {
        tablePlayer = await tx.tablePlayer.update({
          where: { id: existing.id },
          data: { status: TablePlayerStatus.ACTIVE, chips: table.startingChips },
        });
      } else {
        tablePlayer = await tx.tablePlayer.create({
          data: {
            tableId: table.id,
            userId,
            role: TablePlayerRole.PLAYER,
            chips: table.startingChips,
            seatOrder: activeCount,
          },
        });
      }

      await recordChipTransaction(tx, {
        tableId: table.id,
        userId,
        type: ChipTransactionType.BUY_IN,
        amount: table.startingChips,
        createdById: userId,
        description: "Fichas iniciais (entrada na mesa)",
      });

      await tx.action.create({
        data: { tableId: table.id, userId, type: "JOIN", description: "Jogador entrou na mesa." },
      });

      return tablePlayer;
    });

    const result = await this.getTableForUser(userId, table.id);
    emitToTable(table.id, "player_joined", { userId, table: result });
    return result;
  },

  async leaveTable(userId: string, tableId: string) {
    const player = await this.assertActivePlayer(tableId, userId);
    if (player.role === TablePlayerRole.DIRE) {
      throw AppError.forbidden("O DIRE não pode sair da mesa. Encerre a mesa em vez disso.");
    }

    const activeRound = await prisma.round.findFirst({ where: { tableId, status: "EM_ANDAMENTO" } });
    if (activeRound) {
      const roundPlayer = await prisma.roundPlayer.findUnique({
        where: { roundId_tablePlayerId: { roundId: activeRound.id, tablePlayerId: player.id } },
      });
      if (roundPlayer && roundPlayer.status === "ACTIVE") {
        await roundService.fold(userId, activeRound.id);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tablePlayer.update({ where: { id: player.id }, data: { status: TablePlayerStatus.LEFT } });
      await tx.action.create({
        data: { tableId, userId, type: "LEAVE", description: "Jogador saiu da mesa." },
      });
    });

    emitToTable(tableId, "player_left", { userId });
    return { success: true };
  },

  async adminAddChips(direUserId: string, tableId: string, input: z.infer<typeof adminChipsSchema>) {
    await this.assertDire(tableId, direUserId);
    const targetPlayer = await prisma.tablePlayer.findUnique({
      where: { tableId_userId: { tableId, userId: input.targetUserId } },
    });

    if (!targetPlayer || targetPlayer.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.notFound("Jogador não encontrado nesta mesa.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.tablePlayer.update({ where: { id: targetPlayer.id }, data: { chips: { increment: input.amount } } });
      await recordChipTransaction(tx, {
        tableId,
        userId: targetPlayer.userId,
        type: ChipTransactionType.ADMIN_ADD,
        amount: input.amount,
        createdById: direUserId,
        description: input.description ?? "Fichas adicionadas pelo DIRE",
      });
      await tx.action.create({
        data: {
          tableId,
          userId: targetPlayer.userId,
          type: "ADMIN_ADD_CHIPS",
          amount: input.amount,
          description: `DIRE adicionou ${input.amount} fichas.`,
        },
      });
    });

    const updated = await prisma.tablePlayer.findUniqueOrThrow({ where: { id: targetPlayer.id } });
    emitToTable(tableId, "chips_updated", { userId: targetPlayer.userId, chips: updated.chips });
    return { chips: updated.chips };
  },

  async adminRemoveChips(direUserId: string, tableId: string, input: z.infer<typeof adminChipsSchema>) {
    await this.assertDire(tableId, direUserId);
    const targetPlayer = await prisma.tablePlayer.findUnique({
      where: { tableId_userId: { tableId, userId: input.targetUserId } },
    });

    if (!targetPlayer || targetPlayer.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.notFound("Jogador não encontrado nesta mesa.");
    }

    if (targetPlayer.chips < input.amount) {
      throw AppError.badRequest("O jogador não possui fichas suficientes para essa remoção.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.tablePlayer.update({ where: { id: targetPlayer.id }, data: { chips: { decrement: input.amount } } });
      await recordChipTransaction(tx, {
        tableId,
        userId: targetPlayer.userId,
        type: ChipTransactionType.ADMIN_REMOVE,
        amount: input.amount,
        createdById: direUserId,
        description: input.description ?? "Fichas removidas pelo DIRE",
      });
      await tx.action.create({
        data: {
          tableId,
          userId: targetPlayer.userId,
          type: "ADMIN_REMOVE_CHIPS",
          amount: input.amount,
          description: `DIRE removeu ${input.amount} fichas.`,
        },
      });
    });

    const updated = await prisma.tablePlayer.findUniqueOrThrow({ where: { id: targetPlayer.id } });
    emitToTable(tableId, "chips_updated", { userId: targetPlayer.userId, chips: updated.chips });
    return { chips: updated.chips };
  },

  async removePlayer(direUserId: string, tableId: string, targetUserId: string) {
    await this.assertDire(tableId, direUserId);
    const targetPlayer = await prisma.tablePlayer.findUnique({
      where: { tableId_userId: { tableId, userId: targetUserId } },
    });
    if (!targetPlayer || targetPlayer.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.notFound("Jogador não encontrado nesta mesa.");
    }
    if (targetPlayer.role === TablePlayerRole.DIRE) {
      throw AppError.forbidden("Não é possível remover o DIRE da mesa.");
    }

    const activeRound = await prisma.round.findFirst({ where: { tableId, status: "EM_ANDAMENTO" } });
    if (activeRound) {
      const roundPlayer = await prisma.roundPlayer.findUnique({
        where: { roundId_tablePlayerId: { roundId: activeRound.id, tablePlayerId: targetPlayer.id } },
      });
      if (roundPlayer && roundPlayer.status === "ACTIVE") {
        await roundService.fold(targetUserId, activeRound.id, true);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tablePlayer.update({ where: { id: targetPlayer.id }, data: { status: TablePlayerStatus.REMOVED } });
      await tx.action.create({
        data: {
          tableId,
          userId: targetUserId,
          type: "ADMIN_REMOVE_PLAYER",
          description: "DIRE removeu o jogador da mesa.",
        },
      });
    });

    emitToTable(tableId, "player_left", { userId: targetUserId, removedByDire: true });
    return { success: true };
  },

  async pauseTable(direUserId: string, tableId: string) {
    const table = await this.assertDireAndGetTable(direUserId, tableId);
    if (table.status === TableStatus.FINALIZADA) throw AppError.badRequest("A mesa já foi encerrada.");
    await prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.PAUSADA } });
    await prisma.action.create({ data: { tableId, userId: direUserId, type: "PAUSE_TABLE", description: "DIRE pausou a mesa." } });
    emitToTable(tableId, "table_paused", { tableId });
    return { status: TableStatus.PAUSADA };
  },

  async resumeTable(direUserId: string, tableId: string) {
    const table = await this.assertDireAndGetTable(direUserId, tableId);
    if (table.status !== TableStatus.PAUSADA) throw AppError.badRequest("A mesa não está pausada.");
    const activeRound = await prisma.round.findFirst({ where: { tableId, status: "EM_ANDAMENTO" } });
    const status = activeRound ? TableStatus.EM_ANDAMENTO : TableStatus.AGUARDANDO;
    await prisma.table.update({ where: { id: tableId }, data: { status } });
    await prisma.action.create({ data: { tableId, userId: direUserId, type: "RESUME_TABLE", description: "DIRE retomou a mesa." } });
    emitToTable(tableId, "table_resumed", { tableId, status });
    return { status };
  },

  async updateSettings(direUserId: string, tableId: string, input: z.infer<typeof updateSettingsSchema>) {
    await this.assertDire(tableId, direUserId);
    const table = await prisma.table.update({ where: { id: tableId }, data: input });
    emitToTable(tableId, "table_settings_updated", { tableId, minBuyIn: table.minBuyIn, actionTimerSeconds: table.actionTimerSeconds });
    return table;
  },

  async assertDireAndGetTable(direUserId: string, tableId: string) {
    await this.assertDire(tableId, direUserId);
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw AppError.notFound("Mesa não encontrada.");
    return table;
  },
};
