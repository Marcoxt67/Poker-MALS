import { RoundPlayerNode, TableNode, TablePlayerNode } from "../database/models";
import { RoundPlayerStatus, RoundStatus, TablePlayerStatus, TableStatus } from "../utils/enums";

/**
 * Pure state-machine helpers over a table node.
 *
 * A Realtime Database transaction hands you the current value and expects the
 * next one back, and may re-run the callback, so every rule that changes chips,
 * the pot or the turn lives here as a side-effect-free function. Callers clone,
 * apply, and let the transaction commit; journalling and socket events happen
 * only after the commit succeeds.
 */

export const cloneTable = (table: TableNode): TableNode => structuredClone(table);

export const seatsOf = (table: TableNode): TablePlayerNode[] => Object.values(table.players ?? {});

export const activeSeats = (table: TableNode): TablePlayerNode[] =>
  seatsOf(table)
    .filter((p) => p.status === TablePlayerStatus.ACTIVE)
    .sort((a, b) => a.seatOrder - b.seatOrder);

export const roundPlayersOf = (table: TableNode): RoundPlayerNode[] => Object.values(table.round?.players ?? {});

export const activeRoundPlayers = (table: TableNode): RoundPlayerNode[] =>
  roundPlayersOf(table)
    .filter((rp) => rp.status === RoundPlayerStatus.ACTIVE)
    .sort((a, b) => a.seatOrder - b.seatOrder);

/** Next still-in-the-hand player clockwise from a seat, wrapping around. */
export const nextTurnUserId = (table: TableNode, afterSeatOrder: number): string | null => {
  const remaining = activeRoundPlayers(table);
  if (remaining.length === 0) return null;
  const next = remaining.find((rp) => rp.seatOrder > afterSeatOrder) ?? remaining[0];
  return next.userId;
};

/**
 * Moves `amount` chips from a player's stack into the pot and passes the turn.
 * The caller is responsible for having validated the amount against the
 * player's balance inside the same transaction.
 */
export const applyContribution = (
  table: TableNode,
  userId: string,
  amount: number,
  newCurrentBet?: number,
): TableNode => {
  const seat = table.players[userId];
  const roundPlayer = table.round!.players[userId];

  seat.chips -= amount;
  roundPlayer.contributed += amount;
  table.round!.potTotal += amount;
  if (newCurrentBet !== undefined) table.round!.currentBet = newCurrentBet;
  table.round!.turnUserId = nextTurnUserId(table, roundPlayer.seatOrder);

  return table;
};

/** Takes a player out of the current hand. Chips already in the pot stay there. */
export const applyFold = (table: TableNode, userId: string): TableNode => {
  const roundPlayer = table.round!.players[userId];
  const wasTheirTurn = table.round!.turnUserId === userId;

  roundPlayer.status = RoundPlayerStatus.FOLDED;
  if (wasTheirTurn) {
    table.round!.turnUserId = nextTurnUserId(table, roundPlayer.seatOrder);
  }

  return table;
};

/** Hands the pot to a player and closes the hand. */
export const applyWinner = (table: TableNode, winnerUserId: string): { table: TableNode; amount: number } => {
  const amount = table.round!.potTotal;

  table.players[winnerUserId].chips += amount;
  table.round!.status = RoundStatus.FINALIZADA;
  table.round!.winnerId = winnerUserId;
  table.round!.finishedAt = new Date().toISOString();
  table.round!.turnUserId = null;
  table.status = TableStatus.AGUARDANDO;

  return { table, amount };
};

/**
 * When everyone but one player has folded the hand is over immediately and
 * that player takes the pot — no DIRE decision needed.
 */
export const lastPlayerStanding = (table: TableNode): RoundPlayerNode | null => {
  if (!table.round || table.round.status !== RoundStatus.EM_ANDAMENTO) return null;
  const remaining = activeRoundPlayers(table);
  return remaining.length === 1 ? remaining[0] : null;
};

export interface AutoWin {
  userId: string;
  displayName: string;
  amount: number;
  roundNumber: number;
}

/** Applies the "everyone else folded" payout, if the hand has reached it. */
export const settleLastPlayerStanding = (table: TableNode): AutoWin | null => {
  const survivor = lastPlayerStanding(table);
  if (!survivor) return null;

  const roundNumber = table.round!.roundNumber;
  const { amount } = applyWinner(table, survivor.userId);

  return { userId: survivor.userId, displayName: survivor.displayName, amount, roundNumber };
};
