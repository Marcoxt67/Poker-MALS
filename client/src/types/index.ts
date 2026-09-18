export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
  chips: number;
  createdAt: string;
}

export type TableStatus = "AGUARDANDO" | "EM_ANDAMENTO" | "FINALIZANDO" | "FINALIZADA" | "PAUSADA";
export type TablePlayerRole = "DIRE" | "PLAYER";
export type TablePlayerStatus = "ACTIVE" | "LEFT" | "REMOVED";
export type RoundStatus = "EM_ANDAMENTO" | "FINALIZADA";
export type RoundPlayerStatus = "ACTIVE" | "FOLDED";

export interface TablePlayerView {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: TablePlayerRole;
  chips: number;
  status: TablePlayerStatus;
  seatOrder: number;
}

export interface RoundPlayerView {
  tablePlayerId: string;
  userId: string;
  displayName: string;
  contributed: number;
  status: RoundPlayerStatus;
  seatOrder: number;
  chips?: number;
}

export interface RoundView {
  id: string;
  tableId: string;
  roundNumber: number;
  status: RoundStatus;
  potTotal: number;
  currentBet: number;
  turnUserId: string | null;
  winnerId?: string | null;
  players: RoundPlayerView[];
}

/** Extra table-wide numbers only the DIRE is shown. */
export interface DireSummary {
  seatedCount: number;
  totalChipsInPlay: number;
  potTotal: number;
  roundNumber: number;
}

export interface TableView {
  id: string;
  name: string;
  code: string;
  maxPlayers: number;
  minBuyIn: number;
  startingChips: number;
  status: TableStatus;
  tableType: string;
  currentRoundNumber: number;
  actionTimerSeconds: number;
  createdById: string;
  createdAt: string;
  playerCount: number;
  isMember: boolean;
  myRole: TablePlayerRole | null;
  players: TablePlayerView[];
  activeRound: RoundView | null;
  direSummary: DireSummary | null;
}

export interface HistoryEntry {
  id: string;
  type: string;
  amount: number | null;
  description: string;
  userDisplayName: string | null;
  createdAt: string;
}

export interface TransactionEntry {
  id: string;
  tableName: string;
  tableCode: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}
