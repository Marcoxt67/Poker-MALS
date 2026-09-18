import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, createTable, joinTable, registerUser } from "./testUtils";

const startRound = (token: string, tableId: string) =>
  request(app).post(`/api/tables/${tableId}/rounds`).set("Authorization", `Bearer ${token}`);

describe("Rodadas de apostas", () => {
  it("executa o fluxo completo: apostar, pagar, aumentar e entregar o pote", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "ROUND001", startingChips: 100, minBuyIn: 20 });

    const p1 = await registerUser();
    const p2 = await registerUser();
    await joinTable(p1.token, table.code);
    await joinTable(p2.token, table.code);

    const started = await startRound(dire.token, table.id);
    expect(started.status).toBe(201);
    const roundId = started.body.round.id;
    expect(started.body.round.turnUserId).toBe(dire.user.id);

    const bet = await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 20 });
    expect(bet.status).toBe(200);
    expect(bet.body.round.potTotal).toBe(20);
    expect(bet.body.round.turnUserId).toBe(p1.user.id);

    const call1 = await request(app).post(`/api/rounds/${roundId}/call`).set("Authorization", `Bearer ${p1.token}`);
    expect(call1.status).toBe(200);
    expect(call1.body.round.potTotal).toBe(40);
    expect(call1.body.round.turnUserId).toBe(p2.user.id);

    const raise = await request(app).post(`/api/rounds/${roundId}/raise`).set("Authorization", `Bearer ${p2.token}`).send({ amount: 40 });
    expect(raise.status).toBe(200);
    expect(raise.body.round.potTotal).toBe(80);
    expect(raise.body.round.currentBet).toBe(40);
    expect(raise.body.round.turnUserId).toBe(dire.user.id);

    const direCall = await request(app).post(`/api/rounds/${roundId}/call`).set("Authorization", `Bearer ${dire.token}`);
    expect(direCall.status).toBe(200);
    expect(direCall.body.round.potTotal).toBe(100);

    const p1Call = await request(app).post(`/api/rounds/${roundId}/call`).set("Authorization", `Bearer ${p1.token}`);
    expect(p1Call.status).toBe(200);
    expect(p1Call.body.round.potTotal).toBe(120);

    const end = await request(app).post(`/api/tables/${table.id}/end`).set("Authorization", `Bearer ${dire.token}`);
    expect(end.status).toBe(200);

    const winner = await request(app)
      .post(`/api/rounds/${roundId}/winner`)
      .set("Authorization", `Bearer ${dire.token}`)
      .send({ winnerUserId: p2.user.id });
    expect(winner.status).toBe(200);
    expect(winner.body.round.status).toBe("FINALIZADA");

    const tableDetail = await request(app).get(`/api/tables/${table.id}`).set("Authorization", `Bearer ${dire.token}`);
    const p2State = tableDetail.body.table.players.find((p: { userId: string }) => p.userId === p2.user.id);
    // p2 started with 100, paid 40 total into the pot, then received the 120 pot.
    expect(p2State.chips).toBe(180);
  });

  it("finaliza a rodada automaticamente quando resta apenas um jogador ativo", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "FOLD0001", startingChips: 100, minBuyIn: 10 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const started = await startRound(dire.token, table.id);
    const roundId = started.body.round.id;

    await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 10 });

    const fold = await request(app).post(`/api/rounds/${roundId}/fold`).set("Authorization", `Bearer ${p1.token}`);
    expect(fold.status).toBe(200);
    expect(fold.body.round.status).toBe("FINALIZADA");
    expect(fold.body.round.winnerId).toBe(dire.user.id);

    const tableDetail = await request(app).get(`/api/tables/${table.id}`).set("Authorization", `Bearer ${dire.token}`);
    const direState = tableDetail.body.table.players.find((p: { userId: string }) => p.userId === dire.user.id);
    expect(direState.chips).toBe(100); // 100 - 10 aposta + 10 pote recebido
    expect(tableDetail.body.table.status).toBe("AGUARDANDO");
  });

  it("impede agir fora do turno", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "TURN0001", startingChips: 100, minBuyIn: 10 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const started = await startRound(dire.token, table.id);
    const roundId = started.body.round.id;

    const outOfTurn = await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${p1.token}`).send({ amount: 10 });
    expect(outOfTurn.status).toBe(403);
  });

  it("impede apostar abaixo do valor mínimo da mesa", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "MIN00001", startingChips: 100, minBuyIn: 20 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const started = await startRound(dire.token, table.id);
    const roundId = started.body.round.id;

    const belowMin = await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 5 });
    expect(belowMin.status).toBe(400);
  });

  it("nunca permite apostar mais fichas do que o jogador possui, mesmo forçando o valor pelo payload", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "HACK0001", startingChips: 100, minBuyIn: 20 });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const started = await startRound(dire.token, table.id);
    const roundId = started.body.round.id;

    const malicious = await request(app)
      .post(`/api/rounds/${roundId}/bet`)
      .set("Authorization", `Bearer ${dire.token}`)
      .send({ amount: 999999999 });
    expect(malicious.status).toBe(400);
    expect(malicious.body.error).toMatch(/fichas suficientes/i);

    const negative = await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: -50 });
    expect(negative.status).toBe(400);
  });

  it("impede jogador de iniciar rodada (apenas DIRE pode)", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "STARTP01" });
    const p1 = await registerUser();
    await joinTable(p1.token, table.code);

    const res = await startRound(p1.token, table.id);
    expect(res.status).toBe(403);
  });

  it("impede que jogador que já saiu da rodada realize novas ações", async () => {
    const dire = await registerUser();
    const table = await createTable(dire.token, { code: "FOLDACT1", startingChips: 100, minBuyIn: 10 });
    const p1 = await registerUser();
    const p2 = await registerUser();
    await joinTable(p1.token, table.code);
    await joinTable(p2.token, table.code);

    const started = await startRound(dire.token, table.id);
    const roundId = started.body.round.id;

    await request(app).post(`/api/rounds/${roundId}/bet`).set("Authorization", `Bearer ${dire.token}`).send({ amount: 10 });
    await request(app).post(`/api/rounds/${roundId}/fold`).set("Authorization", `Bearer ${p1.token}`);

    // Round is still active because p2 remains. Turn should now be with p2.
    const afterFold = await request(app).get(`/api/rounds/${roundId}`).set("Authorization", `Bearer ${dire.token}`);
    expect(afterFold.body.round.turnUserId).toBe(p2.user.id);

    const p1TriesAgain = await request(app).post(`/api/rounds/${roundId}/fold`).set("Authorization", `Bearer ${p1.token}`);
    expect(p1TriesAgain.status).toBe(400);
  });
});
