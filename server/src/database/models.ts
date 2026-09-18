import {
  ActionType,
  ChipTransactionType,
  RoundPlayerStatus,
  RoundStatus,
  TablePlayerRole,
  TablePlayerStatus,
  TableStatus,
} from "../utils/enums";

/**
 * Shapes of the nodes stored in the Realtime Database. Some fields are
 * denormalized on purpose (display names on log entries, table name/code on
 * ledger entries) so rendering a screen never needs a second lookup.
 */

export interface UserNode {
  id: string;
  username: string;
  usernameLower: string;
  displayName: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  chips: number;
  createdAt: string;
}

export interface TablePlayerNode {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: TablePlayerRole;
  chips: number;
  status: TablePlayerStatus;
  seatOrder: number;
  joinedAt: string;
}

export interface RoundPlayerNode {
  userId: string;
  displayName: string;
  contributed: number;
  status: RoundPlayerStatus;
  seatOrder: number;
}

export interface RoundNode {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  potTotal: number;
  currentBet: number;
  turnUserId: string | null;
  winnerId: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** Keyed by userId. */
  players: Record<string, RoundPlayerNode>;
}

/**
 * The whole node a chip transaction operates on: meta + seats + current round
 * change together or not at all.
 */
export interface TableNode {
  id: string;
  name: string;
  code: string;
  maxPlayers: number;
  minBuyIn: number;
  startingChips: number;
  status: TableStatus;
  tableType: string;
  createdById: string;
  currentRoundNumber: number;
  actionTimerSeconds: number;
  createdAt: string;
  /** Keyed by userId. */
  players: Record<string, TablePlayerNode>;
  round: RoundNode | null;
}

export interface ActionEntry {
  tableId: string;
  roundId: string | null;
  userId: string | null;
  userDisplayName: string | null;
  type: ActionType;
  amount: number | null;
  description: string;
  createdAt: string;
}

export interface ChipLedgerEntry {
  tableId: string;
  tableName: string;
  tableCode: string;
  userId: string;
  roundId: string | null;
  type: ChipTransactionType;
  amount: number;
  createdAt: string;
  createdById: string;
  description: string | null;
}
