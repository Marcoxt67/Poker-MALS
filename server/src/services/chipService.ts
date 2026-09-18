import { ActionEntry, ChipLedgerEntry } from "../database/models";
import { paths, pushKey, updatePaths } from "../database/realtime";

/**
 * Every chip movement and every meaningful table event is journalled here so
 * the history is auditable. Balances themselves are only ever changed inside a
 * `/tables/{id}` transaction; this writes the paper trail for that change in a
 * single atomic fan-out right after it commits.
 *
 * Never mutate a player's chips anywhere without journalling the movement.
 */
export const writeJournal = async (input: { action: ActionEntry; ledger?: ChipLedgerEntry[] }) => {
  const updates: Record<string, unknown> = {};

  const historyPath = paths.tableHistory(input.action.tableId);
  updates[`${historyPath}/${pushKey(historyPath)}`] = input.action;

  for (const entry of input.ledger ?? []) {
    const ledgerPath = paths.userLedger(entry.userId);
    updates[`${ledgerPath}/${pushKey(ledgerPath)}`] = entry;
  }

  await updatePaths(updates);
};
