import { prisma } from "../database/prisma";
import { AppError } from "../utils/AppError";
import { tableService } from "./tableService";

export const historyService = {
  async getTableHistory(userId: string, tableId: string) {
    const player = await tableService.getTablePlayerRecord(tableId, userId);
    if (!player) throw AppError.forbidden("Você não participa desta mesa.");

    const isDire = player.role === "DIRE";

    const actions = await prisma.action.findMany({
      where: isDire ? { tableId } : { tableId, userId },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return actions.map((a) => ({
      id: a.id,
      type: a.type,
      amount: a.amount,
      description: a.description,
      userDisplayName: a.user?.displayName ?? null,
      createdAt: a.createdAt,
    }));
  },

  async getMyTransactions(userId: string) {
    const transactions = await prisma.chipTransaction.findMany({
      where: { userId },
      include: { table: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return transactions.map((t) => ({
      id: t.id,
      tableName: t.table.name,
      tableCode: t.table.code,
      type: t.type,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt,
    }));
  },
};
