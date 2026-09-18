import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, createTable, joinTable, registerUser } from "./testUtils";

describe("Mesas", () => {
  it("cria uma mesa e define o criador como DIRE", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { startingChips: 100, minBuyIn: 20 });

    expect(table.playerCount).toBe(1);
    expect(table.status).toBe("AGUARDANDO");

    const detail = await request(app).get(`/api/tables/${table.id}`).set("Authorization", `Bearer ${dire.token}`);
    expect(detail.body.table.myRole).toBe("DIRE");
    expect(detail.body.table.players[0].chips).toBe(100);
  });

  it("permite um jogador entrar na mesa pelo código e recebe as fichas iniciais", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { startingChips: 150, code: "JOINME1" });

    const player = await registerUser();
    const res = await joinTable(player.token, table.code);

    expect(res.status).toBe(200);
    const me = res.body.table.players.find((p: { userId: string }) => p.userId === player.user.id);
    expect(me.chips).toBe(150);
    expect(me.role).toBe("PLAYER");
  });

  it("impede entrar duas vezes na mesma mesa", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "NODUP1" });
    const player = await registerUser();

    await joinTable(player.token, table.code);
    const second = await joinTable(player.token, table.code);
    expect(second.status).toBe(409);
  });

  it("impede entrar em mesa cheia", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "FULL001", maxPlayers: 2 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const p2 = await registerUser();
    const res = await joinTable(p2.token, table.code);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cheia/i);
  });

  it("apenas o DIRE pode adicionar fichas a um jogador", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "ADMIN01" });
    const player = await registerUser();
    await joinTable(player.token, table.code);

    const forbidden = await request(app)
      .post(`/api/tables/${table.id}/chips/add`)
      .set("Authorization", `Bearer ${player.token}`)
      .send({ targetUserId: player.user.id, amount: 999999 });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post(`/api/tables/${table.id}/chips/add`)
      .set("Authorization", `Bearer ${dire.token}`)
      .send({ targetUserId: player.user.id, amount: 50, description: "Bônus" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.chips).toBe(150);
  });

  it("DIRE não consegue remover mais fichas do que o jogador possui", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "REMV001", startingChips: 100 });
    const player = await registerUser();
    await joinTable(player.token, table.code);

    const res = await request(app)
      .post(`/api/tables/${table.id}/chips/remove`)
      .set("Authorization", `Bearer ${dire.token}`)
      .send({ targetUserId: player.user.id, amount: 500 });

    expect(res.status).toBe(400);
  });

  it("um jogador comum não pode remover jogadores nem pausar a mesa", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "PERM001" });
    const player = await registerUser();
    await joinTable(player.token, table.code);

    const removeAttempt = await request(app)
      .post(`/api/tables/${table.id}/players/remove`)
      .set("Authorization", `Bearer ${player.token}`)
      .send({ targetUserId: dire.user.id });
    expect(removeAttempt.status).toBe(403);

    const pauseAttempt = await request(app).post(`/api/tables/${table.id}/pause`).set("Authorization", `Bearer ${player.token}`);
    expect(pauseAttempt.status).toBe(403);
  });

  it("jogador pode sair da mesa", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "LEAVE01" });
    const player = await registerUser();
    await joinTable(player.token, table.code);

    const res = await request(app).post(`/api/tables/${table.id}/leave`).set("Authorization", `Bearer ${player.token}`);
    expect(res.status).toBe(200);

    const detail = await request(app).get(`/api/tables/${table.id}`).set("Authorization", `Bearer ${dire.token}`);
    expect(detail.body.table.playerCount).toBe(1);
  });

  it("DIRE não pode sair da própria mesa", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "DIRELV1" });
    const res = await request(app).post(`/api/tables/${table.id}/leave`).set("Authorization", `Bearer ${dire.token}`);
    expect(res.status).toBe(403);
  });
});
