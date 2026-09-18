import { z } from "zod";
import { ActionEntry, ChipLedgerEntry, TableNode, TablePlayerNode, UserNode } from "../database/models";
import { newId, nowIso, paths, readCollection, readPath, transact, writePath } from "../database/realtime";
import { AppError } from "../utils/AppError";
import { ActionType, ChipTransactionType, TablePlayerRole, TablePlayerStatus, TableStatus } from "../utils/enums";
import { emitToTable } from "../socket/io";
import { writeJournal } from "./chipService";
import { activeSeats, applyFold, AutoWin, cloneTable, settleLastPlayerStanding } from "./roundEngine";
import { tableSummary, tableView } from "./views";

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

const seatOf = (table: TableNode, userId: string): TablePlayerNode | undefined => table.players?.[userId];

const ledgerEntry = (
  table: TableNode,
  input: {
    userId: string;
    type: ChipTransactionType;
    amount: number;
    createdById: string;
    description: string;
    roundId?: string | null;
  },
): ChipLedgerEntry => ({
  tableId: table.id,
  tableName: table.name,
  tableCode: table.code,
  userId: input.userId,
  roundId: input.roundId ?? null,
  type: input.type,
  amount: input.amount,
  createdAt: nowIso(),
  createdById: input.createdById,
  description: input.description,
});

const actionEntry = (input: {
  tableId: string;
  roundId?: string | null;
  userId?: string | null;
  userDisplayName?: string | null;
  type: ActionType;
  amount?: number | null;
  description: string;
}): ActionEntry => ({
  tableId: input.tableId,
  roundId: input.roundId ?? null,
  userId: input.userId ?? null,
  userDisplayName: input.userDisplayName ?? null,
  type: input.type,
  amount: input.amount ?? null,
  description: input.description,
  createdAt: nowIso(),
});

export const tableService = {
  async getTableNode(tableId: string): Promise<TableNode> {
    const table = await readPath<TableNode>(paths.table(tableId));
    if (!table) throw AppError.notFound("Mesa não encontrada.");
    return table;
  },

  async findTablePlayer(tableId: string, userId: string): Promise<TablePlayerNode | null> {
    const table = await readPath<TableNode>(paths.table(tableId));
    return table ? (seatOf(table, userId) ?? null) : null;
  },

  async assertDire(tableId: string, userId: string) {
    const seat = await this.findTablePlayer(tableId, userId);
    if (!seat || seat.status !== TablePlayerStatus.ACTIVE || seat.role !== TablePlayerRole.DIRE) {
      throw AppError.forbidden("Somente o DIRE pode executar esta ação.");
    }
    return seat;
  },

  async assertActivePlayer(tableId: string, userId: string) {
    const seat = await this.findTablePlayer(tableId, userId);
    if (!seat || seat.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.forbidden("Você não está nesta mesa.");
    }
    return seat;
  },

  async createTable(userId: string, input: z.infer<typeof createTableSchema>) {
    const user = await readPath<UserNode>(paths.user(userId));
    if (!user) throw AppError.notFound("Usuário não encontrado.");

    const tableId = newId();

    // Reserve the code first: the reservation node is what makes codes unique.
    let code = input.code ?? genCode();
    for (let attempt = 0; ; attempt++) {
      try {
        await transact<string>(paths.tableCode(code), (current) => {
          if (current !== null) return { error: AppError.conflict("Este código de mesa já está em uso.") };
          return { next: tableId };
        });
        break;
      } catch (err) {
        // A code the user chose is a hard failure; a generated one just retries.
        if (input.code || attempt >= 4) throw err;
        code = genCode();
      }
    }

    const dire: TablePlayerNode = {
      userId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar ?? null,
      role: TablePlayerRole.DIRE,
      chips: input.startingChips,
      status: TablePlayerStatus.ACTIVE,
      seatOrder: 0,
      joinedAt: nowIso(),
    };

    const table: TableNode = {
      id: tableId,
      name: input.name,
      code,
      maxPlayers: input.maxPlayers,
      minBuyIn: input.minBuyIn,
      startingChips: input.startingChips,
      status: TableStatus.AGUARDANDO,
      tableType: input.tableType ?? "CASH",
      createdById: userId,
      currentRoundNumber: 0,
      actionTimerSeconds: 30,
      createdAt: nowIso(),
      players: { [userId]: dire },
      round: null,
    };

    await writePath(paths.table(tableId), table);

    await writeJournal({
      action: actionEntry({
        tableId,
        userId,
        userDisplayName: user.displayName,
        type: ActionType.JOIN,
        description: "Mesa criada e DIRE definido.",
      }),
      ledger: [
        ledgerEntry(table, {
          userId,
          type: ChipTransactionType.BUY_IN,
          amount: input.startingChips,
          createdById: userId,
          description: "Fichas iniciais (criação da mesa)",
        }),
      ],
    });

    return tableView(table, userId);
  },

  async listTables(userId: string, mine: boolean) {
    const tables = await readCollection<TableNode>(paths.tables());
    const visible = mine ? tables.filter((t) => seatOf(t, userId)?.status === TablePlayerStatus.ACTIVE) : tables;

    return visible
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((table) => ({
        ...tableSummary(table),
        isMember: seatOf(table, userId)?.status === TablePlayerStatus.ACTIVE,
        myRole: seatOf(table, userId)?.status === TablePlayerStatus.ACTIVE ? seatOf(table, userId)!.role : null,
      }));
  },

  async getTableForUser(userId: string, tableId: string) {
    const table = await this.getTableNode(tableId);
    return tableView(table, userId);
  },

  async joinTable(userId: string, code: string) {
    const normalized = code.trim().toUpperCase();
    const tableId = await readPath<string>(paths.tableCode(normalized));
    if (!tableId) throw AppError.notFound("Mesa não encontrada. Verifique o código.");

    const user = await readPath<UserNode>(paths.user(userId));
    if (!user) throw AppError.notFound("Usuário não encontrado.");

    const joinedAt = nowIso();

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      if (current.status === TableStatus.FINALIZADA) {
        return { error: AppError.badRequest("Esta mesa já foi encerrada.") };
      }

      const next = cloneTable(current);
      const existing = seatOf(next, userId);
      if (existing && existing.status === TablePlayerStatus.ACTIVE) {
        return { error: AppError.conflict("Você já está nesta mesa.") };
      }

      const seated = activeSeats(next);
      if (seated.length >= next.maxPlayers) {
        return { error: AppError.conflict("A mesa está cheia.") };
      }

      next.players = next.players ?? {};
      next.players[userId] = {
        userId,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar ?? null,
        role: TablePlayerRole.PLAYER,
        chips: next.startingChips,
        status: TablePlayerStatus.ACTIVE,
        seatOrder: existing ? existing.seatOrder : seated.length,
        joinedAt,
      };

      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        userId,
        userDisplayName: user.displayName,
        type: ActionType.JOIN,
        description: "Jogador entrou na mesa.",
      }),
      ledger: [
        ledgerEntry(table, {
          userId,
          type: ChipTransactionType.BUY_IN,
          amount: table.startingChips,
          createdById: userId,
          description: "Fichas iniciais (entrada na mesa)",
        }),
      ],
    });

    emitToTable(tableId, "player_joined", { userId });
    return tableView(table, userId);
  },

  async leaveTable(userId: string, tableId: string) {
    const seat = await this.assertActivePlayer(tableId, userId);
    if (seat.role === TablePlayerRole.DIRE) {
      throw AppError.forbidden("O DIRE não pode sair da mesa. Encerre a mesa em vez disso.");
    }

    // Leaving mid-hand folds first, so the chips already in the pot stay there
    // and the hand can still resolve for everyone else. The transaction body may
    // re-run, so its findings are collected in a holder reset on every attempt.
    const outcome: { foldedRoundId: string | null; autoWin: AutoWin | null } = { foldedRoundId: null, autoWin: null };

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };

      const next = cloneTable(current);
      outcome.foldedRoundId = null;
      outcome.autoWin = null;

      const roundPlayer = next.round?.players?.[userId];
      if (next.round?.status === "EM_ANDAMENTO" && roundPlayer?.status === "ACTIVE") {
        applyFold(next, userId);
        outcome.foldedRoundId = next.round.id;
        outcome.autoWin = settleLastPlayerStanding(next);
      }

      const leaving = next.players?.[userId];
      if (leaving) leaving.status = TablePlayerStatus.LEFT;

      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        roundId: outcome.foldedRoundId,
        userId,
        userDisplayName: seat.displayName,
        type: ActionType.LEAVE,
        description: "Jogador saiu da mesa.",
      }),
    });

    if (outcome.autoWin) await journalAutoWin(table, outcome.autoWin);

    emitToTable(tableId, "player_left", { userId });
    return { success: true };
  },

  async adminAddChips(direUserId: string, tableId: string, input: z.infer<typeof adminChipsSchema>) {
    await this.assertDire(tableId, direUserId);

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };

      const next = cloneTable(current);
      const target = seatOf(next, input.targetUserId);
      if (!target || target.status !== TablePlayerStatus.ACTIVE) {
        return { error: AppError.notFound("Jogador não encontrado nesta mesa.") };
      }
      if (next.players[direUserId]?.role !== TablePlayerRole.DIRE) {
        return { error: AppError.forbidden("Somente o DIRE pode executar esta ação.") };
      }

      target.chips += input.amount;
      return { next };
    });

    const target = seatOf(table, input.targetUserId)!;

    await writeJournal({
      action: actionEntry({
        tableId,
        userId: input.targetUserId,
        userDisplayName: target.displayName,
        type: ActionType.ADMIN_ADD_CHIPS,
        amount: input.amount,
        description: `DIRE adicionou ${input.amount} fichas para ${target.displayName}.`,
      }),
      ledger: [
        ledgerEntry(table, {
          userId: input.targetUserId,
          type: ChipTransactionType.ADMIN_ADD,
          amount: input.amount,
          createdById: direUserId,
          description: input.description ?? "Fichas adicionadas pelo DIRE",
        }),
      ],
    });

    emitToTable(tableId, "chips_updated", { userId: input.targetUserId, chips: target.chips });
    return { chips: target.chips };
  },

  async adminRemoveChips(direUserId: string, tableId: string, input: z.infer<typeof adminChipsSchema>) {
    await this.assertDire(tableId, direUserId);

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };

      const next = cloneTable(current);
      const target = seatOf(next, input.targetUserId);
      if (!target || target.status !== TablePlayerStatus.ACTIVE) {
        return { error: AppError.notFound("Jogador não encontrado nesta mesa.") };
      }
      if (next.players[direUserId]?.role !== TablePlayerRole.DIRE) {
        return { error: AppError.forbidden("Somente o DIRE pode executar esta ação.") };
      }
      if (target.chips < input.amount) {
        return { error: AppError.badRequest("O jogador não possui fichas suficientes para essa remoção.") };
      }

      target.chips -= input.amount;
      return { next };
    });

    const target = seatOf(table, input.targetUserId)!;

    await writeJournal({
      action: actionEntry({
        tableId,
        userId: input.targetUserId,
        userDisplayName: target.displayName,
        type: ActionType.ADMIN_REMOVE_CHIPS,
        amount: input.amount,
        description: `DIRE removeu ${input.amount} fichas de ${target.displayName}.`,
      }),
      ledger: [
        ledgerEntry(table, {
          userId: input.targetUserId,
          type: ChipTransactionType.ADMIN_REMOVE,
          amount: input.amount,
          createdById: direUserId,
          description: input.description ?? "Fichas removidas pelo DIRE",
        }),
      ],
    });

    emitToTable(tableId, "chips_updated", { userId: input.targetUserId, chips: target.chips });
    return { chips: target.chips };
  },

  async removePlayer(direUserId: string, tableId: string, targetUserId: string) {
    await this.assertDire(tableId, direUserId);

    const outcome: { autoWin: AutoWin | null } = { autoWin: null };

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };

      const next = cloneTable(current);
      outcome.autoWin = null;

      const target = seatOf(next, targetUserId);
      if (!target || target.status !== TablePlayerStatus.ACTIVE) {
        return { error: AppError.notFound("Jogador não encontrado nesta mesa.") };
      }
      if (target.role === TablePlayerRole.DIRE) {
        return { error: AppError.forbidden("Não é possível remover o DIRE da mesa.") };
      }

      const roundPlayer = next.round?.players?.[targetUserId];
      if (next.round?.status === "EM_ANDAMENTO" && roundPlayer?.status === "ACTIVE") {
        applyFold(next, targetUserId);
        outcome.autoWin = settleLastPlayerStanding(next);
      }

      target.status = TablePlayerStatus.REMOVED;
      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        userId: targetUserId,
        userDisplayName: seatOf(table, targetUserId)?.displayName ?? null,
        type: ActionType.ADMIN_REMOVE_PLAYER,
        description: "DIRE removeu o jogador da mesa.",
      }),
    });

    if (outcome.autoWin) await journalAutoWin(table, outcome.autoWin);

    emitToTable(tableId, "player_left", { userId: targetUserId, removedByDire: true });
    return { success: true };
  },

  async pauseTable(direUserId: string, tableId: string) {
    await this.assertDire(tableId, direUserId);

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      if (current.status === TableStatus.FINALIZADA) {
        return { error: AppError.badRequest("A mesa já foi encerrada.") };
      }
      const next = cloneTable(current);
      next.status = TableStatus.PAUSADA;
      return { next };
    });

    await writeJournal({
      action: actionEntry({ tableId, userId: direUserId, type: ActionType.PAUSE_TABLE, description: "DIRE pausou a mesa." }),
    });

    emitToTable(tableId, "table_paused", { tableId });
    return { status: table.status };
  },

  async resumeTable(direUserId: string, tableId: string) {
    await this.assertDire(tableId, direUserId);

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      if (current.status !== TableStatus.PAUSADA) {
        return { error: AppError.badRequest("A mesa não está pausada.") };
      }
      const next = cloneTable(current);
      next.status = next.round?.status === "EM_ANDAMENTO" ? TableStatus.EM_ANDAMENTO : TableStatus.AGUARDANDO;
      return { next };
    });

    await writeJournal({
      action: actionEntry({ tableId, userId: direUserId, type: ActionType.RESUME_TABLE, description: "DIRE retomou a mesa." }),
    });

    emitToTable(tableId, "table_resumed", { tableId, status: table.status });
    return { status: table.status };
  },

  async updateSettings(direUserId: string, tableId: string, input: z.infer<typeof updateSettingsSchema>) {
    await this.assertDire(tableId, direUserId);

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      const next = cloneTable(current);
      if (input.minBuyIn !== undefined) next.minBuyIn = input.minBuyIn;
      if (input.actionTimerSeconds !== undefined) next.actionTimerSeconds = input.actionTimerSeconds;
      return { next };
    });

    emitToTable(tableId, "table_settings_updated", {
      tableId,
      minBuyIn: table.minBuyIn,
      actionTimerSeconds: table.actionTimerSeconds,
    });

    return tableView(table, direUserId);
  },
};

/** Shared by leave/remove: a fold that ended the hand still owes a paper trail. */
const journalAutoWin = async (
  table: TableNode,
  win: { userId: string; displayName: string; amount: number; roundNumber: number },
) => {
  await writeJournal({
    action: actionEntry({
      tableId: table.id,
      roundId: table.round?.id ?? null,
      userId: win.userId,
      userDisplayName: win.displayName,
      type: ActionType.WINNER_SELECTED,
      amount: win.amount,
      description: `${win.displayName} venceu o pote de ${win.amount} fichas (demais jogadores desistiram).`,
    }),
    ledger: [
      ledgerEntry(table, {
        userId: win.userId,
        roundId: table.round?.id ?? null,
        type: ChipTransactionType.POT_WIN,
        amount: win.amount,
        createdById: win.userId,
        description: `Vencedor da rodada #${win.roundNumber} (todos os demais desistiram)`,
      }),
    ],
  });

  emitToTable(table.id, "round_finished", { roundId: table.round?.id, winnerId: win.userId, potTotal: win.amount });
  emitToTable(table.id, "chips_updated", { userId: win.userId, chips: table.players[win.userId]?.chips ?? 0 });
};

export { actionEntry, ledgerEntry, journalAutoWin };
