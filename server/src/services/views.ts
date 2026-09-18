import { TableNode } from "../database/models";
import { RoundStatus, TablePlayerRole, TablePlayerStatus } from "../utils/enums";
import { activeSeats, roundPlayersOf, seatsOf } from "./roundEngine";

/** Shapes returned to the client. Kept in one place so every endpoint agrees. */

export const tableSummary = (table: TableNode) => ({
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
  playerCount: activeSeats(table).length,
});

export const roundView = (table: TableNode) => {
  const round = table.round;
  if (!round) return null;

  return {
    id: round.id,
    tableId: table.id,
    roundNumber: round.roundNumber,
    status: round.status,
    potTotal: round.potTotal,
    currentBet: round.currentBet,
    turnUserId: round.turnUserId ?? null,
    winnerId: round.winnerId ?? null,
    players: roundPlayersOf(table)
      .sort((a, b) => a.seatOrder - b.seatOrder)
      .map((rp) => ({
        tablePlayerId: rp.userId,
        userId: rp.userId,
        displayName: rp.displayName,
        contributed: rp.contributed,
        status: rp.status,
        seatOrder: rp.seatOrder,
        chips: table.players[rp.userId]?.chips ?? 0,
      })),
  };
};

/** The round the table is actually playing right now, if any. */
export const activeRoundView = (table: TableNode) =>
  table.round && table.round.status === RoundStatus.EM_ANDAMENTO ? roundView(table) : null;

export const tableView = (table: TableNode, userId: string) => {
  const me = table.players?.[userId];
  const isMember = Boolean(me && me.status === TablePlayerStatus.ACTIVE);
  const isDire = isMember && me!.role === TablePlayerRole.DIRE;

  return {
    ...tableSummary(table),
    isMember,
    myRole: isMember ? me!.role : null,
    // Players only ever see a table they actually sit at; browsing the lobby
    // shows counts and status, never other people's stacks.
    players: isMember
      ? seatsOf(table)
          .sort((a, b) => a.seatOrder - b.seatOrder)
          .map((p) => ({
            id: p.userId,
            userId: p.userId,
            username: p.username,
            displayName: p.displayName,
            avatar: p.avatar ?? null,
            role: p.role,
            chips: p.chips,
            status: p.status,
            seatOrder: p.seatOrder,
          }))
      : [],
    activeRound: isMember ? activeRoundView(table) : null,
    // Extra context the DIRE screen needs and a regular player has no use for.
    direSummary: isDire
      ? {
          seatedCount: activeSeats(table).length,
          totalChipsInPlay: activeSeats(table).reduce((sum, p) => sum + p.chips, 0),
          potTotal: table.round?.status === RoundStatus.EM_ANDAMENTO ? table.round.potTotal : 0,
          roundNumber: table.currentRoundNumber,
        }
      : null,
  };
};
