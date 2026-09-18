import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, uniqueSuffix } from "./testUtils";

describe("Autenticação", () => {
  it("permite cadastro e retorna token", async () => {
    const suffix = uniqueSuffix();
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: `marcos${suffix}`,
        displayName: "Marcos",
        email: `marcos${suffix}@example.com`,
        password: "senha123",
        confirmPassword: "senha123",
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(`marcos${suffix}`);
    expect(res.body.user.chips).toBeGreaterThan(0);
  });

  it("rejeita cadastro com senhas diferentes", async () => {
    const suffix = uniqueSuffix();
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: `joao${suffix}`,
        displayName: "João",
        email: `joao${suffix}@example.com`,
        password: "senha123",
        confirmPassword: "outrasenha",
      });

    expect(res.status).toBe(400);
  });

  it("rejeita cadastro com email duplicado", async () => {
    const suffix = uniqueSuffix();
    const email = `dup${suffix}@example.com`;
    await request(app).post("/api/auth/register").send({
      username: `dup1${suffix}`,
      displayName: "Dup1",
      email,
      password: "senha123",
      confirmPassword: "senha123",
    });

    const res = await request(app).post("/api/auth/register").send({
      username: `dup2${suffix}`,
      displayName: "Dup2",
      email,
      password: "senha123",
      confirmPassword: "senha123",
    });

    expect(res.status).toBe(409);
  });

  it("permite login com email ou username e rejeita senha incorreta", async () => {
    const suffix = uniqueSuffix();
    const email = `login${suffix}@example.com`;
    const username = `login${suffix}`;
    await request(app).post("/api/auth/register").send({
      username,
      displayName: "Login Teste",
      email,
      password: "senha123",
      confirmPassword: "senha123",
    });

    const byEmail = await request(app).post("/api/auth/login").send({ identifier: email, password: "senha123" });
    expect(byEmail.status).toBe(200);

    const byUsername = await request(app).post("/api/auth/login").send({ identifier: username, password: "senha123" });
    expect(byUsername.status).toBe(200);

    const wrongPassword = await request(app).post("/api/auth/login").send({ identifier: email, password: "errada" });
    expect(wrongPassword.status).toBe(401);
  });

  it("retorna o usuário autenticado em /me", async () => {
    const suffix = uniqueSuffix();
    const email = `me${suffix}@example.com`;
    const register = await request(app).post("/api/auth/register").send({
      username: `me${suffix}`,
      displayName: "Me",
      email,
      password: "senha123",
      confirmPassword: "senha123",
    });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${register.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it("rejeita acesso sem token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
