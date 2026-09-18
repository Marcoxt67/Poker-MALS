import { api } from "./api";
import { TransactionEntry } from "../types";

export const userApi = {
  myTransactions: async () => {
    const res = await api.get<{ transactions: TransactionEntry[] }>("/users/me/transactions");
    return res.data.transactions;
  },
};
