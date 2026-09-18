// SQLite has no native enum support in Prisma, so these fields are stored as String
// columns. These const objects give us the same type-safety/ergonomics in the app layer.
// On a future PostgreSQL migration these can become real `enum` blocks in schema.prisma.

export const TableStatus = {
  AGUARDANDO: "AGUARDANDO",
  EM_ANDAMENTO: "EM_ANDAMENTO",
  FINALIZANDO: "FINALIZANDO",
  FINALIZADA: "FINALIZADA",
  PAUSADA: "PAUSADA",
} as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

export const TablePlayerRole = {
  DIRE: "DIRE",
  PLAYER: "PLAYER",
} as const;
export type TablePlayerRole = (typeof TablePlayerRole)[keyof typeof TablePlayerRole];

export const TablePlayerStatus = {
  ACTIVE: "ACTIVE",
  LEFT: "LEFT",
  REMOVED: "REMOVED",
} as const;
export type TablePlayerStatus = (typeof TablePlayerStatus)[keyof typeof TablePlayerStatus];

export const RoundStatus = {
  EM_ANDAMENTO: "EM_ANDAMENTO",
  FINALIZADA: "FINALIZADA",
} as const;
export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

export const RoundPlayerStatus = {
  ACTIVE: "ACTIVE",
  FOLDED: "FOLDED",
} as const;
export type RoundPlayerStatus = (typeof RoundPlayerStatus)[keyof typeof RoundPlayerStatus];

export const ChipTransactionType = {
  ADMIN_ADD: "ADMIN_ADD",
  ADMIN_REMOVE: "ADMIN_REMOVE",
  BUY_IN: "BUY_IN",
  BET: "BET",
  CALL: "CALL",
  RAISE: "RAISE",
  POT_WIN: "POT_WIN",
  REFUND: "REFUND",
} as const;
export type ChipTransactionType = (typeof ChipTransactionType)[keyof typeof ChipTransactionType];

export const ActionType = {
  JOIN: "JOIN",
  LEAVE: "LEAVE",
  START_ROUND: "START_ROUND",
  BET: "BET",
  CALL: "CALL",
  RAISE: "RAISE",
  FOLD: "FOLD",
  WINNER_SELECTED: "WINNER_SELECTED",
  PAUSE_TABLE: "PAUSE_TABLE",
  RESUME_TABLE: "RESUME_TABLE",
  END_ROUND: "END_ROUND",
  ADMIN_ADD_CHIPS: "ADMIN_ADD_CHIPS",
  ADMIN_REMOVE_CHIPS: "ADMIN_REMOVE_CHIPS",
  ADMIN_REMOVE_PLAYER: "ADMIN_REMOVE_PLAYER",
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];
