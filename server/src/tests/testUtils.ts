import request from "supertest";
import { createApp } from "../app";

export const app = createApp();

/**
 * Wipes the emulated database between tests through the emulator's REST
 * endpoint rather than the SDK, so the reset never waits on the realtime
 * websocket the app itself is using.
 */
export const resetDb = async () => {
  const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "127.0.0.1:9000";
  const namespace = new URL(process.env.FIREBASE_DATABASE_URL ?? "https://poker-test-default-rtdb.firebaseio.com")
    .hostname.split(".")[0];

  const res = await fetch(`http://${host}/.json?ns=${namespace}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Falha ao limpar o emulador: ${res.status} ${await res.text()}`);
};

let counter = 0;
export const uniqueSuffix = () => {
  counter += 1;
  return `${Date.now()}${counter}`;
};

export const registerUser = async (overrides: Partial<{ username: string; displayName: string; email: string; password: string }> = {}) => {
  const suffix = uniqueSuffix();
  const payload = {
    username: overrides.username ?? `user${suffix}`,
    displayName: overrides.displayName ?? `User ${suffix}`,
    email: overrides.email ?? `user${suffix}@example.com`,
    password: overrides.password ?? "password123",
    confirmPassword: overrides.password ?? "password123",
  };

  const res = await request(app).post("/api/auth/register").send(payload);
  if (res.status !== 201) {
    throw new Error(`Falha ao registrar usuário de teste: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token as string, user: res.body.user };
};

export const createTable = async (
  token: string,
  overrides: Partial<{ name: string; code: string; maxPlayers: number; minBuyIn: number; startingChips: number }> = {},
) => {
  const suffix = uniqueSuffix();
  const payload = {
    name: overrides.name ?? "Mesa de Teste",
    code: overrides.code ?? `T${suffix}`.slice(0, 10).toUpperCase(),
    maxPlayers: overrides.maxPlayers ?? 6,
    minBuyIn: overrides.minBuyIn ?? 20,
    startingChips: overrides.startingChips ?? 100,
  };
  const res = await request(app).post("/api/tables").set("Authorization", `Bearer ${token}`).send(payload);
  if (res.status !== 201) {
    throw new Error(`Falha ao criar mesa de teste: ${JSON.stringify(res.body)}`);
  }
  return res.body.table;
};

export const joinTable = async (token: string, code: string) => {
  return request(app).post(`/api/tables/join`).set("Authorization", `Bearer ${token}`).send({ code });
};

