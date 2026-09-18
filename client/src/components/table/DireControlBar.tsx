import { useState } from "react";
import { Coins, Pause, Play, Settings2, Square, Trophy, Users } from "lucide-react";
import { Button } from "../Button";
import { TableView } from "../../types";
import { tableApi } from "../../services/tableApi";
import { getErrorMessage } from "../../services/api";

interface Props {
  table: TableView;
  onOpenPanel: () => void;
  onChanged: () => void;
}

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="rounded-xl bg-felt-darker/60 border border-white/10 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/45">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <p className="text-base sm:text-lg font-bold mt-0.5">{value}</p>
  </div>
);

/**
 * The DIRE's cockpit: table-wide numbers and the one action the table is
 * waiting on, always visible. Regular players never see this.
 */
export const DireControlBar = ({ table, onOpenPanel, onChanged }: Props) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = table.direSummary;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível executar a ação."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-panel border border-gold/25 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs sm:text-sm font-bold text-gold tracking-wide">CONTROLE DA MESA · DIRE</h2>
        <button
          onClick={onOpenPanel}
          className="flex items-center gap-1.5 text-[11px] sm:text-xs text-white/60 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 touch-target"
        >
          <Settings2 size={14} />
          Painel completo
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<Users size={11} />} label="Jogadores" value={`${summary?.seatedCount ?? 0}/${table.maxPlayers}`} />
        <Stat icon={<Coins size={11} />} label="Pote" value={summary?.potTotal ?? 0} />
        <Stat icon={<Trophy size={11} />} label="Rodada" value={`#${summary?.roundNumber ?? 0}`} />
        <Stat icon={<Coins size={11} />} label="Fichas em jogo" value={summary?.totalChipsInPlay ?? 0} />
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

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

        {table.status === "FINALIZANDO" && (
          <Button variant="gold" className="col-span-2" onClick={onOpenPanel}>
            <Trophy size={16} /> SELECIONAR VENCEDOR
          </Button>
        )}

        {table.status === "PAUSADA" ? (
          <Button variant="ghost" className="col-span-2" disabled={busy} onClick={() => act(() => tableApi.resume(table.id))}>
            <Play size={16} /> RETOMAR MESA
          </Button>
        ) : (
          table.status !== "FINALIZADA" && (
            <Button variant="ghost" className="col-span-2" disabled={busy} onClick={() => act(() => tableApi.pause(table.id))}>
              <Pause size={16} /> PAUSAR MESA
            </Button>
          )
        )}
      </div>
    </section>
  );
};
