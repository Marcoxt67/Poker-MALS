import { api } from "./api";
import { RoundView } from "../types";

export const roundApi = {
  get: async (roundId: string) => {
    const res = await api.get<{ round: RoundView }>(`/rounds/${roundId}`);
    return res.data.round;
  },
  bet: async (roundId: string, amount: number) => {
    const res = await api.post<{ round: RoundView }>(`/rounds/${roundId}/bet`, { amount });
    return res.data.round;
  },
  call: async (roundId: string) => {
    const res = await api.post<{ round: RoundView }>(`/rounds/${roundId}/call`);
    return res.data.round;
  },
  raise: async (roundId: string, amount: number) => {
    const res = await api.post<{ round: RoundView }>(`/rounds/${roundId}/raise`, { amount });
    return res.data.round;
  },
  fold: async (roundId: string) => {
    const res = await api.post<{ round: RoundView }>(`/rounds/${roundId}/fold`);
    return res.data.round;
  },
  winner: async (roundId: string, winnerUserId: string) => {
    const res = await api.post<{ round: RoundView }>(`/rounds/${roundId}/winner`, { winnerUserId });
    return res.data.round;
  },
};
