import { PrismaClient } from "@prisma/client";
import { ChipTransactionType } from "../utils/enums";

type Tx = Omit<PrismaClient, "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

interface RecordTransactionInput {
  tableId: string;
  userId: string;
  roundId?: string | null;
  type: ChipTransactionType;
  amount: number;
  createdById: string;
  description: string;
}

/**
 * Every chip movement MUST go through here so it is auditable via ChipTransaction.
 * Never mutate TablePlayer.chips directly anywhere else in the codebase.
 */
export const recordChipTransaction = async (tx: Tx, input: RecordTransactionInput) => {
  await tx.chipTransaction.create({
    data: {
      tableId: input.tableId,
      userId: input.userId,
      roundId: input.roundId ?? undefined,
      type: input.type,
      amount: input.amount,
      createdById: input.createdById,
      description: input.description,
    },
  });
};

export const INCREASING_TYPES: ChipTransactionType[] = [
  ChipTransactionType.ADMIN_ADD,
  ChipTransactionType.BUY_IN,
  ChipTransactionType.POT_WIN,
  ChipTransactionType.REFUND,
];

export const isIncreasing = (type: ChipTransactionType) => INCREASING_TYPES.includes(type);
