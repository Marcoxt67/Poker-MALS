import { api } from "./api";
import { User } from "../types";

export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export const authApi = {
  register: async (input: RegisterInput) => {
    const res = await api.post<{ user: User; token: string }>("/auth/register", input);
    return res.data;
  },
  login: async (input: LoginInput) => {
    const res = await api.post<{ user: User; token: string }>("/auth/login", input);
    return res.data;
  },
  me: async () => {
    const res = await api.get<{ user: User }>("/auth/me");
    return res.data.user;
  },
};
