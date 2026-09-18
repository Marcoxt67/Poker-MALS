import { ActionEntry, ChipLedgerEntry } from "../database/models";
import { paths, readKeyed } from "../database/realtime";
import { AppError } from "../utils/AppError";
import { TablePlayerRole } from "../utils/enums";
import { tableService } from "./tableService";

const MAX_ENTRIES = 200;

const newestFirst = <T extends { createdAt: string }>(entries: T[]) =>
  [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_ENTRIES);

export const historyService = {
  /** The DIRE sees the whole table log; a player only sees their own actions. */
  async getTableHistory(userId: string, tableId: string) {
    const seat = await tableService.findTablePlayer(tableId, userId);
    if (!seat) throw AppError.forbidden("Você não participa desta mesa.");

    const entries = await readKeyed<ActionEntry>(paths.tableHistory(tableId));
    const visible = seat.role === TablePlayerRole.DIRE ? entries : entries.filter((e) => e.userId === userId);

    return newestFirst(visible).map((entry) => ({
      id: entry.id,
      type: entry.type,
      amount: entry.amount ?? null,
      description: entry.description,
      userDisplayName: entry.userDisplayName ?? null,
      createdAt: entry.createdAt,
    }));
  },

  async getMyTransactions(userId: string) {
    const entries = await readKeyed<ChipLedgerEntry>(paths.userLedger(userId));

    return newestFirst(entries).map((entry) => ({
      id: entry.id,
      tableName: entry.tableName,
      tableCode: entry.tableCode,
      type: entry.type,
      amount: entry.amount,
      description: entry.description ?? null,
      createdAt: entry.createdAt,
    }));
  },
};
