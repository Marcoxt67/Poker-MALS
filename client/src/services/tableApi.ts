import { api } from "./api";
import { HistoryEntry, RoundView, TableView } from "../types";

export interface CreateTableInput {
  name: string;
  code?: string;
  maxPlayers: number;
  minBuyIn: number;
  startingChips: number;
  tableType?: string;
}

export const tableApi = {
  create: async (input: CreateTableInput) => {
    const res = await api.post<{ table: TableView }>("/tables", input);
    return res.data.table;
  },
  list: async (mine = false) => {
    const res = await api.get<{ tables: TableView[] }>("/tables", { params: mine ? { mine: "true" } : undefined });
    return res.data.tables;
  },
  get: async (id: string) => {
    const res = await api.get<{ table: TableView }>(`/tables/${id}`);
    return res.data.table;
  },
  join: async (code: string) => {
    const res = await api.post<{ table: TableView }>("/tables/join", { code });
    return res.data.table;
  },
  leave: async (id: string) => {
    await api.post(`/tables/${id}/leave`);
  },
  addChips: async (id: string, targetUserId: string, amount: number, description?: string) => {
    const res = await api.post<{ chips: number }>(`/tables/${id}/chips/add`, { targetUserId, amount, description });
    return res.data;
  },
  removeChips: async (id: string, targetUserId: string, amount: number, description?: string) => {
    const res = await api.post<{ chips: number }>(`/tables/${id}/chips/remove`, { targetUserId, amount, description });
    return res.data;
  },
  removePlayer: async (id: string, targetUserId: string) => {
    await api.post(`/tables/${id}/players/remove`, { targetUserId });
  },
  pause: async (id: string) => {
    await api.post(`/tables/${id}/pause`);
  },
  resume: async (id: string) => {
    await api.post(`/tables/${id}/resume`);
  },
  updateSettings: async (id: string, input: { minBuyIn?: number; actionTimerSeconds?: number }) => {
    const res = await api.patch<{ table: TableView }>(`/tables/${id}/settings`, input);
    return res.data.table;
  },
  startRound: async (id: string) => {
    const res = await api.post<{ round: RoundView }>(`/tables/${id}/rounds`);
    return res.data.round;
  },
  endRound: async (id: string) => {
    const res = await api.post<{ roundId: string; status: string }>(`/tables/${id}/end`);
    return res.data;
  },
  history: async (id: string) => {
    const res = await api.get<{ history: HistoryEntry[] }>(`/tables/${id}/history`);
    return res.data.history;
  },
};
