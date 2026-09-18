import { z } from "zod";
import { RoundNode, RoundPlayerNode, TableNode } from "../database/models";
import { newId, nowIso, paths, readPath, transact } from "../database/realtime";
import { AppError } from "../utils/AppError";
import {
  ActionType,
  ChipTransactionType,
  RoundPlayerStatus,
  RoundStatus,
  TablePlayerRole,
  TablePlayerStatus,
  TableStatus,
} from "../utils/enums";
import { emitToTable } from "../socket/io";
import { writeJournal } from "./chipService";
import {
  activeSeats,
  applyContribution,
  applyFold,
  applyWinner,
  AutoWin,
  cloneTable,
  settleLastPlayerStanding,
} from "./roundEngine";
import { actionEntry, journalAutoWin, ledgerEntry, tableService } from "./tableService";
import { roundView } from "./views";

export const amountSchema = z.object({
  amount: z.number().int().positive("O valor deve ser maior que zero."),
});

export const winnerSchema = z.object({
  winnerUserId: z.string().min(1, "Selecione o vencedor."),
});

type BetKind = "BET" | "CALL" | "RAISE";

/**
 * Guards every betting action. Runs inside the table transaction so the turn,
 * the round status and the player's balance are all checked against the value
 * that is actually about to be written — never against a stale read.
 */
const guardTurn = (table: TableNode, userId: string): { round: RoundNode; player: RoundPlayerNode } | AppError => {
  if (!table.round || table.round.status !== RoundStatus.EM_ANDAMENTO) {
    return AppError.badRequest("A rodada já foi encerrada.");
  }
  if (table.status === TableStatus.PAUSADA) {
    return AppError.badRequest("A mesa está pausada.");
  }
  // Having already folded is reported before the turn check: it is the more
  // useful answer, and it is why the turn moved on in the first place.
  const player = table.round.players?.[userId];
  if (!player) return AppError.forbidden("Você não está participando desta rodada.");
  if (player.status !== RoundPlayerStatus.ACTIVE) return AppError.badRequest("Você já saiu desta rodada.");

  if (table.round.turnUserId !== userId) {
    return AppError.forbidden("Não é sua vez de jogar.");
  }

  return { round: table.round, player };
};

/** bet / call / raise differ only in how the amount is derived and validated. */
const placeChips = async (
  userId: string,
  roundId: string,
  kind: BetKind,
  requestedAmount?: number,
) => {
  const tableId = await resolveTableId(roundId);

  const outcome: { amount: number; description: string; displayName: string } = {
    amount: 0,
    description: "",
    displayName: "",
  };

  const table = await transact<TableNode>(paths.table(tableId), (current) => {
    if (!current) return { error: AppError.notFound("Mesa não encontrada.") };

    const next = cloneTable(current);
    const guarded = guardTurn(next, userId);
    if (guarded instanceof AppError) return { error: guarded };

    const { round, player } = guarded;
    const seat = next.players[userId];

    let amount: number;
    let newCurrentBet: number | undefined;
    let description: string;

    if (kind === "BET") {
      const requested = requestedAmount!;
      if (round.currentBet !== 0) {
        return { error: AppError.badRequest("Já existe uma aposta nesta rodada. Utilize pagar ou aumentar.") };
      }
      if (requested < next.minBuyIn) {
        return { error: AppError.badRequest(`O valor mínimo é ${next.minBuyIn} fichas.`) };
      }
      amount = requested;
      newCurrentBet = requested;
      description = `apostou ${requested} fichas`;
    } else if (kind === "CALL") {
      amount = round.currentBet - player.contributed;
      if (amount <= 0) return { error: AppError.badRequest("Não há valor pendente para pagar.") };
      description = `pagou ${amount} fichas`;
    } else {
      const requested = requestedAmount!;
      if (requested <= round.currentBet) {
        return { error: AppError.badRequest(`O novo valor deve ser maior que a aposta atual (${round.currentBet}).`) };
      }
      amount = requested - player.contributed;
      newCurrentBet = requested;
      description = `aumentou para ${requested} fichas`;
    }

    if (amount > seat.chips) {
      return { error: AppError.badRequest("Você não possui fichas suficientes.") };
    }

    applyContribution(next, userId, amount, newCurrentBet);

    outcome.amount = amount;
    outcome.description = description;
    outcome.displayName = seat.displayName;

    return { next };
  });

  const txType =
    kind === "BET" ? ChipTransactionType.BET : kind === "CALL" ? ChipTransactionType.CALL : ChipTransactionType.RAISE;
  const actType = kind === "BET" ? ActionType.BET : kind === "CALL" ? ActionType.CALL : ActionType.RAISE;

  await writeJournal({
    action: actionEntry({
      tableId,
      roundId,
      userId,
      userDisplayName: outcome.displayName,
      type: actType,
      amount: outcome.amount,
      description: `${outcome.displayName} ${outcome.description}.`,
    }),
    ledger: [
      ledgerEntry(table, {
        userId,
        roundId,
        type: txType,
        amount: outcome.amount,
        createdById: userId,
        description: outcome.description,
      }),
    ],
  });

  emitToTable(tableId, "player_bet", { roundId, userId, amount: outcome.amount, type: txType });
  emitToTable(tableId, "pot_updated", {
    roundId,
    potTotal: table.round?.potTotal ?? 0,
    currentBet: table.round?.currentBet ?? 0,
  });
  emitToTable(tableId, "chips_updated", { userId, chips: table.players[userId]?.chips ?? 0 });
  emitToTable(tableId, "turn_changed", { turnUserId: table.round?.turnUserId ?? null, roundId });

  return roundView(table)!;
};

/**
 * Rounds live inside their table node, so an action addressed by round id has
 * to find the table first. Round ids are unique across tables.
 */
const resolveTableId = async (roundId: string): Promise<string> => {
  const tables = await readPath<Record<string, TableNode>>(paths.tables());
  const match = Object.values(tables ?? {}).find((t) => t.round?.id === roundId);
  if (!match) throw AppError.notFound("Rodada não encontrada.");
  return match.id;
};

export const roundService = {
  async startRound(direUserId: string, tableId: string) {
    await tableService.assertDire(tableId, direUserId);

    const roundId = newId();
    const startedAt = nowIso();

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      if (current.status === TableStatus.EM_ANDAMENTO) {
        return { error: AppError.badRequest("Já existe uma rodada em andamento.") };
      }
      if (current.status === TableStatus.PAUSADA) return { error: AppError.badRequest("A mesa está pausada.") };
      if (current.status === TableStatus.FINALIZADA) return { error: AppError.badRequest("A mesa já foi encerrada.") };

      const next = cloneTable(current);
      if (next.players?.[direUserId]?.role !== TablePlayerRole.DIRE) {
        return { error: AppError.forbidden("Somente o DIRE pode executar esta ação.") };
      }

      const seated = activeSeats(next);
      if (seated.length < 2) {
        return { error: AppError.badRequest("É necessário pelo menos 2 jogadores ativos para iniciar uma rodada.") };
      }

      const players: Record<string, RoundPlayerNode> = {};
      for (const seat of seated) {
        players[seat.userId] = {
          userId: seat.userId,
          displayName: seat.displayName,
          contributed: 0,
          status: RoundPlayerStatus.ACTIVE,
          seatOrder: seat.seatOrder,
        };
      }

      next.currentRoundNumber += 1;
      next.status = TableStatus.EM_ANDAMENTO;
      next.round = {
        id: roundId,
        roundNumber: next.currentRoundNumber,
        status: RoundStatus.EM_ANDAMENTO,
        potTotal: 0,
        currentBet: 0,
        turnUserId: seated[0].userId,
        winnerId: null,
        startedAt,
        finishedAt: null,
        players,
      };

      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        roundId,
        userId: direUserId,
        userDisplayName: table.players[direUserId]?.displayName ?? null,
        type: ActionType.START_ROUND,
        description: `DIRE iniciou a rodada #${table.round!.roundNumber}.`,
      }),
    });

    const view = roundView(table)!;
    emitToTable(tableId, "round_started", view);
    emitToTable(tableId, "turn_changed", { turnUserId: view.turnUserId, roundId });
    return view;
  },

  bet(userId: string, roundId: string, amount: number) {
    return placeChips(userId, roundId, "BET", amount);
  },

  call(userId: string, roundId: string) {
    return placeChips(userId, roundId, "CALL");
  },

  raise(userId: string, roundId: string, amount: number) {
    return placeChips(userId, roundId, "RAISE", amount);
  },

  async fold(userId: string, roundId: string) {
    const tableId = await resolveTableId(roundId);

    const outcome: { autoWin: AutoWin | null; displayName: string } = { autoWin: null, displayName: "" };

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };

      const next = cloneTable(current);
      outcome.autoWin = null;

      const guarded = guardTurn(next, userId);
      if (guarded instanceof AppError) return { error: guarded };

      applyFold(next, userId);
      outcome.autoWin = settleLastPlayerStanding(next);
      outcome.displayName = next.players[userId].displayName;

      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        roundId,
        userId,
        userDisplayName: outcome.displayName,
        type: ActionType.FOLD,
        description: `${outcome.displayName} saiu da rodada.`,
      }),
    });

    emitToTable(tableId, "player_folded", { roundId, userId });

    if (outcome.autoWin) {
      await journalAutoWin(table, outcome.autoWin);
    } else {
      emitToTable(tableId, "turn_changed", { turnUserId: table.round?.turnUserId ?? null, roundId });
    }

    return roundView(table)!;
  },

  async endRound(direUserId: string, tableId: string) {
    await tableService.assertDire(tableId, direUserId);

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      if (!current.round || current.round.status !== RoundStatus.EM_ANDAMENTO) {
        return { error: AppError.badRequest("Não há rodada em andamento.") };
      }

      const next = cloneTable(current);
      next.status = TableStatus.FINALIZANDO;
      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        roundId: table.round!.id,
        userId: direUserId,
        userDisplayName: table.players[direUserId]?.displayName ?? null,
        type: ActionType.END_ROUND,
        description: "DIRE encerrou a rodada para definição do vencedor.",
      }),
    });

    emitToTable(tableId, "round_finalizing", { roundId: table.round!.id });
    return { roundId: table.round!.id, status: TableStatus.FINALIZANDO };
  },

  async selectWinner(direUserId: string, roundId: string, winnerUserId: string) {
    const tableId = await resolveTableId(roundId);
    await tableService.assertDire(tableId, direUserId);

    const outcome: { amount: number; displayName: string; roundNumber: number } = {
      amount: 0,
      displayName: "",
      roundNumber: 0,
    };

    const table = await transact<TableNode>(paths.table(tableId), (current) => {
      if (!current) return { error: AppError.notFound("Mesa não encontrada.") };
      if (!current.round || current.round.id !== roundId) {
        return { error: AppError.notFound("Rodada não encontrada.") };
      }
      if (current.round.status !== RoundStatus.EM_ANDAMENTO) {
        return { error: AppError.badRequest("Esta rodada já foi finalizada.") };
      }

      const next = cloneTable(current);
      if (next.players?.[direUserId]?.role !== TablePlayerRole.DIRE) {
        return { error: AppError.forbidden("Somente o DIRE pode executar esta ação.") };
      }

      const winner = next.round!.players?.[winnerUserId];
      if (!winner) return { error: AppError.notFound("Jogador não participa desta rodada.") };
      if (winner.status !== RoundPlayerStatus.ACTIVE) {
        return { error: AppError.badRequest("Este jogador já desistiu da rodada e não pode receber o pote.") };
      }

      outcome.roundNumber = next.round!.roundNumber;
      outcome.displayName = winner.displayName;
      outcome.amount = applyWinner(next, winnerUserId).amount;

      return { next };
    });

    await writeJournal({
      action: actionEntry({
        tableId,
        roundId,
        userId: winnerUserId,
        userDisplayName: outcome.displayName,
        type: ActionType.WINNER_SELECTED,
        amount: outcome.amount,
        description: `${outcome.displayName} venceu o pote de ${outcome.amount} fichas.`,
      }),
      ledger: [
        ledgerEntry(table, {
          userId: winnerUserId,
          roundId,
          type: ChipTransactionType.POT_WIN,
          amount: outcome.amount,
          createdById: direUserId,
          description: `Vencedor da rodada #${outcome.roundNumber} (selecionado pelo DIRE)`,
        }),
      ],
    });

    const view = roundView(table)!;
    emitToTable(tableId, "round_finished", view);
    emitToTable(tableId, "chips_updated", { userId: winnerUserId, chips: table.players[winnerUserId]?.chips ?? 0 });
    emitToTable(tableId, "pot_updated", { roundId, potTotal: 0, currentBet: 0 });
    return view;
  },

  async getRound(userId: string, roundId: string) {
    const tableId = await resolveTableId(roundId);
    const table = await tableService.getTableNode(tableId);

    if (table.players?.[userId]?.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.forbidden("Você não participa desta mesa.");
    }

    return roundView(table)!;
  },
};
