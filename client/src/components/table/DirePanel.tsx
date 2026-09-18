import { useState } from "react";
import { Coins, History, Pause, Play, Square, Trophy, UserMinus } from "lucide-react";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { Card, Input, Label } from "../Card";
import { TableView } from "../../types";
import { tableApi } from "../../services/tableApi";
import { roundApi } from "../../services/roundApi";
import { getErrorMessage } from "../../services/api";
import { HistoryPanel } from "./HistoryPanel";

interface Props {
  table: TableView;
  onClose: () => void;
  onChanged: () => void;
}

export const DirePanel = ({ table, onClose, onChanged }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chipTarget, setChipTarget] = useState<{ userId: string; mode: "add" | "remove" } | null>(null);
  const [chipAmount, setChipAmount] = useState(20);
  const [chipReason, setChipReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Ação não permitida."));
    } finally {
      setBusy(false);
    }
  };

  const activePlayers = table.players.filter((p) => p.status === "ACTIVE");
  const isFinalizing = table.status === "FINALIZANDO";
  const round = table.activeRound;

  if (showHistory) {
    return <HistoryPanel tableId={table.id} onClose={() => setShowHistory(false)} />;
  }

  return (
    <Modal title="Controle da mesa (DIRE)" onClose={onClose}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="py-3">
            <p className="text-[10px] text-white/50 uppercase">Jogadores</p>
            <p className="text-lg font-bold">{activePlayers.length}</p>
          </Card>
          <Card className="py-3">
            <p className="text-[10px] text-white/50 uppercase">Rodada</p>
            <p className="text-lg font-bold">#{table.currentRoundNumber}</p>
          </Card>
          <Card className="py-3">
            <p className="text-[10px] text-white/50 uppercase">Pote</p>
            <p className="text-lg font-bold text-gold">{round?.potTotal ?? 0}</p>
          </Card>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

        {isFinalizing && round && (
          <Card className="border-gold/40">
            <p className="text-sm font-semibold text-gold mb-1 flex items-center gap-2">
              <Trophy size={16} /> Selecionar vencedor
            </p>
            <p className="text-xs text-white/50 mb-3">Pote: {round.potTotal} fichas</p>
            <div className="grid grid-cols-2 gap-2">
              {round.players
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <Button
                    key={p.userId}
                    variant="gold"
                    disabled={busy}
                    onClick={() => act(() => roundApi.winner(round.id, p.userId))}
                  >
                    {p.displayName}
                  </Button>
                ))}
            </div>
          </Card>
        )}

        {!isFinalizing && (
          <div className="grid grid-cols-2 gap-2">
            {table.status === "AGUARDANDO" && (
              <Button variant="gold" className="col-span-2" disabled={busy} onClick={() => act(() => tableApi.startRound(table.id))}>
                <Play size={16} /> INICIAR RODADA
              </Button>
            )}
            {table.status === "EM_ANDAMENTO" && (
              <Button variant="primary" className="col-span-2" disabled={busy} onClick={() => act(() => tableApi.endRound(table.id))}>
                <Square size={16} /> ENCERRAR RODADA
              </Button>
            )}
            {table.status === "PAUSADA" ? (
              <Button variant="ghost" disabled={busy} onClick={() => act(() => tableApi.resume(table.id))}>
                <Play size={16} /> RETOMAR
              </Button>
            ) : (
              <Button variant="ghost" disabled={busy} onClick={() => act(() => tableApi.pause(table.id))}>
                <Pause size={16} /> PAUSAR MESA
              </Button>
            )}
            <Button variant="subtle" disabled={busy} onClick={() => setShowHistory(true)}>
              <History size={16} /> HISTÓRICO
            </Button>
          </div>
        )}

        <section>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">Jogadores</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activePlayers.map((p) => (
              <Card key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {p.displayName} {p.role === "DIRE" && <span className="text-emerald-400 text-[10px]">(DIRE)</span>}
                  </p>
                  <p className="text-xs text-gold">{p.chips} fichas</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 touch-target"
                    title="Adicionar fichas"
                    onClick={() => {
                      setChipTarget({ userId: p.userId, mode: "add" });
                      setChipAmount(20);
                      setChipReason("");
                    }}
                  >
                    <Coins size={16} />
                  </button>
                  {p.role !== "DIRE" && (
                    <>
                      <button
                        className="p-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 touch-target"
                        title="Remover fichas"
                        onClick={() => {
                          setChipTarget({ userId: p.userId, mode: "remove" });
                          setChipAmount(20);
                          setChipReason("");
                        }}
                      >
                        <Coins size={16} className="opacity-60" />
                      </button>
                      <button
                        className="p-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 touch-target"
                        title="Remover jogador"
                        onClick={() => act(() => tableApi.removePlayer(table.id, p.userId))}
                      >
                        <UserMinus size={16} />
                      </button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {chipTarget && (
        <div className="mt-5 border-t border-white/10 pt-4 space-y-3">
          <p className="text-sm font-semibold">{chipTarget.mode === "add" ? "Adicionar fichas" : "Remover fichas"}</p>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={chipAmount} onChange={(e) => setChipAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Input value={chipReason} onChange={(e) => setChipReason(e.target.value)} placeholder="Fichas iniciais" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" fullWidth onClick={() => setChipTarget(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="gold"
              fullWidth
              disabled={busy || chipAmount <= 0}
              onClick={() =>
                act(async () => {
                  if (chipTarget.mode === "add") {
                    await tableApi.addChips(table.id, chipTarget.userId, chipAmount, chipReason || undefined);
                  } else {
                    await tableApi.removeChips(table.id, chipTarget.userId, chipAmount, chipReason || undefined);
                  }
                  setChipTarget(null);
                })
              }
            >
              CONFIRMAR
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
