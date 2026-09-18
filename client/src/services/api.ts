import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("poker_mals_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ApiErrorShape {
  error: string;
  code?: string;
}

export const getErrorMessage = (err: unknown, fallback = "Ocorreu um erro. Tente novamente."): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorShape | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
};
