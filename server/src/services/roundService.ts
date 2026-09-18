import { z } from "zod";
import { prisma } from "../database/prisma";
import { AppError } from "../utils/AppError";
import { ActionType, ChipTransactionType, RoundPlayerStatus, RoundStatus, TablePlayerStatus, TableStatus } from "../utils/enums";
import { recordChipTransaction } from "./chipService";
import { emitToTable } from "../socket/io";

export const amountSchema = z.object({
  amount: z.number().int().positive("O valor deve ser maior que zero."),
});

export const winnerSchema = z.object({
  winnerUserId: z.string().min(1, "Selecione o vencedor."),
});

const roundWithPlayers = (roundId: string) =>
  prisma.round.findUnique({
    where: { id: roundId },
    include: {
      table: true,
      roundPlayers: { include: { tablePlayer: { include: { user: true } } }, orderBy: { seatOrder: "asc" } },
    },
  });

type RoundWithPlayers = NonNullable<Awaited<ReturnType<typeof roundWithPlayers>>>;

const nextActivePlayer = (round: RoundWithPlayers, afterSeatOrder: number) => {
  const active = round.roundPlayers.filter((rp) => rp.status === RoundPlayerStatus.ACTIVE);
  if (active.length === 0) return null;
  const sorted = [...active].sort((a, b) => a.seatOrder - b.seatOrder);
  const next = sorted.find((rp) => rp.seatOrder > afterSeatOrder) ?? sorted[0];
  return next;
};

const roundPublicShape = (round: RoundWithPlayers) => ({
  id: round.id,
  tableId: round.tableId,
  roundNumber: round.roundNumber,
  status: round.status,
  potTotal: round.potTotal,
  currentBet: round.currentBet,
  turnUserId: round.turnUserId,
  winnerId: round.winnerId,
  players: round.roundPlayers.map((rp) => ({
    tablePlayerId: rp.tablePlayerId,
    userId: rp.tablePlayer.userId,
    displayName: rp.tablePlayer.user.displayName,
    contributed: rp.contributed,
    status: rp.status,
    seatOrder: rp.seatOrder,
    chips: rp.tablePlayer.chips,
  })),
});

const finishRoundAsSingleWinner = async (roundId: string, actingUserId: string | null) => {
  const round = await roundWithPlayers(roundId);
  if (!round) return;

  const stillActive = round.roundPlayers.filter((rp) => rp.status === RoundPlayerStatus.ACTIVE);
  if (stillActive.length !== 1) return round;

  const winner = stillActive[0];

  await prisma.$transaction(async (tx) => {
    await tx.tablePlayer.update({ where: { id: winner.tablePlayerId }, data: { chips: { increment: round.potTotal } } });
    await recordChipTransaction(tx, {
      tableId: round.tableId,
      userId: winner.tablePlayer.userId,
      roundId: round.id,
      type: ChipTransactionType.POT_WIN,
      amount: round.potTotal,
      createdById: actingUserId ?? winner.tablePlayer.userId,
      description: `Vencedor da rodada #${round.roundNumber} (todos os demais desistiram)`,
    });
    await tx.round.update({
      where: { id: round.id },
      data: { status: RoundStatus.FINALIZADA, winnerId: winner.tablePlayer.userId, finishedAt: new Date(), turnUserId: null },
    });
    await tx.table.update({ where: { id: round.tableId }, data: { status: TableStatus.AGUARDANDO } });
    await tx.action.create({
      data: {
        tableId: round.tableId,
        roundId: round.id,
        userId: winner.tablePlayer.userId,
        type: ActionType.WINNER_SELECTED,
        amount: round.potTotal,
        description: `${winner.tablePlayer.user.displayName} venceu o pote de ${round.potTotal} fichas (demais jogadores desistiram).`,
      },
    });
  });

  const updated = await roundWithPlayers(roundId);
  if (updated) {
    emitToTable(round.tableId, "round_finished", roundPublicShape(updated));
    emitToTable(round.tableId, "chips_updated", { userId: winner.tablePlayer.userId, chips: winner.tablePlayer.chips + round.potTotal });
  }
  return updated;
};

export const roundService = {
  async startRound(direUserId: string, tableId: string) {
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw AppError.notFound("Mesa não encontrada.");

    const direPlayer = await prisma.tablePlayer.findUnique({ where: { tableId_userId: { tableId, userId: direUserId } } });
    if (!direPlayer || direPlayer.role !== "DIRE" || direPlayer.status !== TablePlayerStatus.ACTIVE) {
      throw AppError.forbidden("Somente o DIRE pode executar esta ação.");
    }

    if (table.status === TableStatus.EM_ANDAMENTO) throw AppError.badRequest("Já existe uma rodada em andamento.");
    if (table.status === TableStatus.PAUSADA) throw AppError.badRequest("A mesa está pausada.");
    if (table.status === TableStatus.FINALIZADA) throw AppError.badRequest("A mesa já foi encerrada.");

    const activePlayers = await prisma.tablePlayer.findMany({
      where: { tableId, status: TablePlayerStatus.ACTIVE },
      orderBy: { seatOrder: "asc" },
    });

    if (activePlayers.length < 2) {
      throw AppError.badRequest("É necessário pelo menos 2 jogadores ativos para iniciar uma rodada.");
    }

    const roundNumber = table.currentRoundNumber + 1;

    const round = await prisma.$transaction(async (tx) => {
      const created = await tx.round.create({
        data: {
          tableId,
          roundNumber,
          status: RoundStatus.EM_ANDAMENTO,
          turnUserId: activePlayers[0].userId,
        },
      });

      await tx.roundPlayer.createMany({
        data: activePlayers.map((p) => ({
          roundId: created.id,
          tablePlayerId: p.id,
          seatOrder: p.seatOrder,
        })),
      });

      await tx.table.update({ where: { id: tableId }, data: { status: TableStatus.EM_ANDAMENTO, currentRoundNumber: roundNumber } });

      await tx.action.create({
        data: { tableId, roundId: created.id, userId: direUserId, type: ActionType.START_ROUND, description: `DIRE iniciou a rodada #${roundNumber}.` },
      });

      return created;
    });

    const full = await roundWithPlayers(round.id);
    emitToTable(tableId, "round_started", roundPublicShape(full!));
    emitToTable(tableId, "turn_changed", { turnUserId: full!.turnUserId, roundId: round.id });
    return roundPublicShape(full!);
  },

  async assertMyTurn(round: RoundWithPlayers, userId: string) {
    if (round.status !== RoundStatus.EM_ANDAMENTO) throw AppError.badRequest("A rodada já foi encerrada.");
    if (round.table.status === TableStatus.PAUSADA) throw AppError.badRequest("A mesa está pausada.");
    if (round.turnUserId !== userId) throw AppError.forbidden("Não é sua vez de jogar.");

    const roundPlayer = round.roundPlayers.find((rp) => rp.tablePlayer.userId === userId);
    if (!roundPlayer) throw AppError.forbidden("Você não está participando desta rodada.");
    if (roundPlayer.status !== RoundPlayerStatus.ACTIVE) throw AppError.forbidden("Você já saiu desta rodada.");
    return roundPlayer;
  },

  async bet(userId: string, roundId: string, amount: number) {
    const round = await roundWithPlayers(roundId);
    if (!round) throw AppError.notFound("Rodada não encontrada.");
    const roundPlayer = await this.assertMyTurn(round, userId);

    if (round.currentBet !== 0) {
      throw AppError.badRequest("Já existe uma aposta nesta rodada. Utilize pagar ou aumentar.");
    }
    if (amount < round.table.minBuyIn) {
      throw AppError.badRequest(`O valor mínimo é ${round.table.minBuyIn} fichas.`);
    }
    if (amount > roundPlayer.tablePlayer.chips) {
      throw AppError.badRequest("Você não possui fichas suficientes.");
    }

    return this.applyContribution(
      round,
      roundPlayer,
      amount,
      ChipTransactionType.BET,
      ActionType.BET,
      `apostou ${amount} fichas`,
      amount,
    );
  },

  async call(userId: string, roundId: string) {
    const round = await roundWithPlayers(roundId);
    if (!round) throw AppError.notFound("Rodada não encontrada.");
    const roundPlayer = await this.assertMyTurn(round, userId);

    const needed = round.currentBet - roundPlayer.contributed;
    if (needed <= 0) throw AppError.badRequest("Não há valor pendente para pagar.");
    if (needed > roundPlayer.tablePlayer.chips) throw AppError.badRequest("Você não possui fichas suficientes.");

    return this.applyContribution(round, roundPlayer, needed, ChipTransactionType.CALL, ActionType.CALL, `pagou ${needed} fichas`);
  },

  async raise(userId: string, roundId: string, newAmount: number) {
    const round = await roundWithPlayers(roundId);
    if (!round) throw AppError.notFound("Rodada não encontrada.");
    const roundPlayer = await this.assertMyTurn(round, userId);

    if (newAmount <= round.currentBet) {
      throw AppError.badRequest(`O novo valor deve ser maior que a aposta atual (${round.currentBet}).`);
    }
    const needed = newAmount - roundPlayer.contributed;
    if (needed > roundPlayer.tablePlayer.chips) throw AppError.badRequest("Você não possui fichas suficientes.");

    return this.applyContribution(
      round,
      roundPlayer,
      needed,
      ChipTransactionType.RAISE,
      ActionType.RAISE,
      `aumentou para ${newAmount} fichas`,
      newAmount,
    );
  },

  async applyContribution(
    round: RoundWithPlayers,
    roundPlayer: RoundWithPlayers["roundPlayers"][number],
    amount: number,
    txType: ChipTransactionType,
    actionType: ActionType,
    description: string,
    setCurrentBet?: number,
  ) {
    const nextTurn = nextActivePlayer(round, roundPlayer.seatOrder);

    await prisma.$transaction(async (tx) => {
      await tx.tablePlayer.update({ where: { id: roundPlayer.tablePlayerId }, data: { chips: { decrement: amount } } });
      await tx.roundPlayer.update({ where: { id: roundPlayer.id }, data: { contributed: { increment: amount } } });
      await tx.round.update({
        where: { id: round.id },
        data: {
          potTotal: { increment: amount },
          currentBet: setCurrentBet ?? round.currentBet,
          turnUserId: nextTurn ? nextTurn.tablePlayer.userId : null,
        },
      });
      await recordChipTransaction(tx, {
        tableId: round.tableId,
        userId: roundPlayer.tablePlayer.userId,
        roundId: round.id,
        type: txType,
        amount,
        createdById: roundPlayer.tablePlayer.userId,
        description,
      });
      await tx.action.create({
        data: {
          tableId: round.tableId,
          roundId: round.id,
          userId: roundPlayer.tablePlayer.userId,
          type: actionType,
          amount,
          description: `${roundPlayer.tablePlayer.user.displayName} ${description}.`,
        },
      });
    });

    const updated = await roundWithPlayers(round.id);
    const shape = roundPublicShape(updated!);
    emitToTable(round.tableId, "pot_updated", { roundId: round.id, potTotal: shape.potTotal, currentBet: shape.currentBet });
    emitToTable(round.tableId, "player_bet", { roundId: round.id, userId: roundPlayer.tablePlayer.userId, amount, type: txType });
    emitToTable(round.tableId, "chips_updated", { userId: roundPlayer.tablePlayer.userId, chips: roundPlayer.tablePlayer.chips - amount });
    emitToTable(round.tableId, "turn_changed", { turnUserId: shape.turnUserId, roundId: round.id });
    return shape;
  },

  async fold(userId: string, roundId: string, skipTurnCheck = false) {
    const round = await roundWithPlayers(roundId);
    if (!round) throw AppError.notFound("Rodada não encontrada.");

    const roundPlayer = round.roundPlayers.find((rp) => rp.tablePlayer.userId === userId);
    if (!roundPlayer) throw AppError.forbidden("Você não está participando desta rodada.");
    if (roundPlayer.status !== RoundPlayerStatus.ACTIVE) throw AppError.badRequest("Você já saiu desta rodada.");
    if (round.status !== RoundStatus.EM_ANDAMENTO) throw AppError.badRequest("A rodada já foi encerrada.");
    if (!skipTurnCheck && round.turnUserId !== userId) throw AppError.forbidden("Não é sua vez de jogar.");

    const wasMyTurn = round.turnUserId === userId;
    const nextTurn = wasMyTurn ? nextActivePlayer(round, roundPlayer.seatOrder) : null;

    await prisma.$transaction(async (tx) => {
      await tx.roundPlayer.update({ where: { id: roundPlayer.id }, data: { status: RoundPlayerStatus.FOLDED } });
      if (wasMyTurn) {
        await tx.round.update({
          where: { id: round.id },
          data: { turnUserId: nextTurn && nextTurn.id !== roundPlayer.id ? nextTurn.tablePlayer.userId : null },
        });
      }
      await tx.action.create({
        data: {
          tableId: round.tableId,
          roundId: round.id,
          userId,
          type: ActionType.FOLD,
          description: `${roundPlayer.tablePlayer.user.displayName} saiu da rodada.`,
        },
      });
    });

    emitToTable(round.tableId, "player_folded", { roundId: round.id, userId });

    const finished = await finishRoundAsSingleWinner(round.id, null);
    if (finished && finished.status === RoundStatus.FINALIZADA) {
      return roundPublicShape(finished);
    }

    const updated = await roundWithPlayers(round.id);
    const shape = roundPublicShape(updated!);
    emitToTable(round.tableId, "turn_changed", { turnUserId: shape.turnUserId, roundId: round.id });
    return shape;
  },

  async endRound(direUserId: string, tableId: string) {
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw AppError.notFound("Mesa não encontrada.");
    const direPlayer = await prisma.tablePlayer.findUnique({ where: { tableId_userId: { tableId, userId: direUserId } } });
    if (!direPlayer || direPlayer.role !== "DIRE") throw AppError.forbidden("Somente o DIRE pode executar esta ação.");

    const round = await prisma.round.findFirst({ where: { tableId, status: RoundStatus.EM_ANDAMENTO }, orderBy: { roundNumber: "desc" } });
    if (!round) throw AppError.badRequest("Não há rodada em andamento.");

    await prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.FINALIZANDO } });
    await prisma.action.create({
      data: { tableId, roundId: round.id, userId: direUserId, type: ActionType.END_ROUND, description: "DIRE encerrou a rodada para definição do vencedor." },
    });
    emitToTable(tableId, "round_finalizing", { roundId: round.id });
    return { roundId: round.id, status: "FINALIZANDO" };
  },

  async selectWinner(direUserId: string, roundId: string, winnerUserId: string) {
    const round = await roundWithPlayers(roundId);
    if (!round) throw AppError.notFound("Rodada não encontrada.");

    const direPlayer = await prisma.tablePlayer.findUnique({ where: { tableId_userId: { tableId: round.tableId, userId: direUserId } } });
    if (!direPlayer || direPlayer.role !== "DIRE") throw AppError.forbidden("Somente o DIRE pode executar esta ação.");

    if (round.status !== RoundStatus.EM_ANDAMENTO) throw AppError.badRequest("Esta rodada já foi finalizada.");

    const winnerRoundPlayer = round.roundPlayers.find((rp) => rp.tablePlayer.userId === winnerUserId);
    if (!winnerRoundPlayer) throw AppError.notFound("Jogador não participa desta rodada.");
    if (winnerRoundPlayer.status !== RoundPlayerStatus.ACTIVE) {
      throw AppError.badRequest("Este jogador já desistiu da rodada e não pode receber o pote.");
    }

    const potTotal = round.potTotal;

    await prisma.$transaction(async (tx) => {
      await tx.tablePlayer.update({ where: { id: winnerRoundPlayer.tablePlayerId }, data: { chips: { increment: potTotal } } });
      await recordChipTransaction(tx, {
        tableId: round.tableId,
        userId: winnerUserId,
        roundId: round.id,
        type: ChipTransactionType.POT_WIN,
        amount: potTotal,
        createdById: direUserId,
        description: `Vencedor da rodada #${round.roundNumber} (selecionado pelo DIRE)`,
      });
      await tx.round.update({
        where: { id: round.id },
        data: { status: RoundStatus.FINALIZADA, winnerId: winnerUserId, finishedAt: new Date(), turnUserId: null },
      });
      await tx.table.update({ where: { id: round.tableId }, data: { status: TableStatus.AGUARDANDO } });
      await tx.action.create({
        data: {
          tableId: round.tableId,
          roundId: round.id,
          userId: winnerUserId,
          type: ActionType.WINNER_SELECTED,
          amount: potTotal,
          description: `${winnerRoundPlayer.tablePlayer.user.displayName} venceu o pote de ${potTotal} fichas.`,
        },
      });
    });

    const updated = await roundWithPlayers(roundId);
    const shape = roundPublicShape(updated!);
    emitToTable(round.tableId, "round_finished", shape);
    emitToTable(round.tableId, "chips_updated", { userId: winnerUserId, chips: winnerRoundPlayer.tablePlayer.chips + potTotal });
    emitToTable(round.tableId, "pot_updated", { roundId: round.id, potTotal: 0, currentBet: 0 });
    return shape;
  },

  async getRound(userId: string, roundId: string) {
    const round = await roundWithPlayers(roundId);
    if (!round) throw AppError.notFound("Rodada não encontrada.");
    const isMember = round.roundPlayers.some((rp) => rp.tablePlayer.userId === userId);
    if (!isMember) throw AppError.forbidden("Você não participa desta mesa.");
    return roundPublicShape(round);
  },
};
