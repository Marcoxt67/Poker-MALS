import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, createTable, joinTable, registerUser } from "./testUtils";

describe("Segurança e regras de negócio", () => {
  it("não confia em valores de amount fora do schema (string, zero, decimal)", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00001", startingChips: 100, minBuyIn: 20 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const round = await request(app).post(`/api/tables/${table.id}/rounds`).set("Authorization", `Bearer ${dire.token}`);
    const roundId = round.body.round.id;

    const asString = await request(app)
      .post(`/api/rounds/${roundId}/bet`)
      .set("Authorization", `Bearer ${dire.token}`)
      .send({ amount: "20" });
    expect(asString.status).toBe(400);

    const zero = await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 0 });
    expect(zero.status).toBe(400);

    const decimal = await request(app)
      .post(`/api/rounds/${roundId}/bet`)
      .set("Authorization", `Bearer ${dire.token}`)
      .send({ amount: 20.5 });
    expect(decimal.status).toBe(400);
  });

  it("impede pagar quando não há aposta pendente", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00002" });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);
    const round = await request(app).post(`/api/tables/${table.id}/rounds`).set("Authorization", `Bearer ${dire.token}`);
    const roundId = round.body.round.id;

    const call = await request(app).post(`/api/rounds/${roundId}/call`).set("Authorization", `Bearer ${dire.token}`);
    expect(call.status).toBe(400);
  });

  it("impede aumentar para um valor menor ou igual à aposta atual", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00003", minBuyIn: 20 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);
    const round = await request(app).post(`/api/tables/${table.id}/rounds`).set("Authorization", `Bearer ${dire.token}`);
    const roundId = round.body.round.id;

    await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 20 });

    const badRaise = await request(app)
      .post(`/api/rounds/${roundId}/raise`)
      .set("Authorization", `Bearer ${p1.token}`)
      .send({ amount: 20 });
    expect(badRaise.status).toBe(400);
  });

  it("apenas o DIRE pode selecionar o vencedor do pote", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00004", minBuyIn: 10 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);
    const round = await request(app).post(`/api/tables/${table.id}/rounds`).set("Authorization", `Bearer ${dire.token}`);
    const roundId = round.body.round.id;

    await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 10 });
    await request(app).post(`/api/rounds/${roundId}/call`).set("Authorization", `Bearer ${p1.token}`);

    const forbidden = await request(app)
      .post(`/api/rounds/${roundId}/winner`)
      .set("Authorization", `Bearer ${p1.token}`)
      .send({ winnerUserId: p1.user.id });
    expect(forbidden.status).toBe(403);
  });

  it("um jogador só vê seu próprio histórico; o DIRE vê o histórico completo", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00005" });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const direHistory = await request(app).get(`/api/tables/${table.id}/history`).set("Authorization", `Bearer ${dire.token}`);
    const playerHistory = await request(app).get(`/api/tables/${table.id}/history`).set("Authorization", `Bearer ${p1.token}`);

    expect(direHistory.status).toBe(200);
    expect(playerHistory.status).toBe(200);
    expect(direHistory.body.history.length).toBeGreaterThanOrEqual(playerHistory.body.history.length);
    expect(playerHistory.body.history.every((h: { userDisplayName: string | null }) => h.userDisplayName === p1.user.displayName)).toBe(
      true,
    );
  });

  it("não expõe fichas de jogadores para quem não faz parte da mesa", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00006" });
    const outsider = await registerUser();

    const res = await request(app).get(`/api/tables/${table.id}`).set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(200);
    expect(res.body.table.isMember).toBe(false);
    expect(res.body.table.players).toEqual([]);
  });

  it("rejeita requisições sem token em rotas protegidas de mesas e rodadas", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "SEC00007" });

    const noAuthTable = await request(app).get(`/api/tables/${table.id}`);
    expect(noAuthTable.status).toBe(401);

    const noAuthCreate = await request(app).post(`/api/tables`).send({ name: "x", maxPlayers: 4, minBuyIn: 10, startingChips: 50 });
    expect(noAuthCreate.status).toBe(401);
  });
});
