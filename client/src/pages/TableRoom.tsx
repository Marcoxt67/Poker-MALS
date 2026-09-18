import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, History, LogOut, Settings } from "lucide-react";
import { SimulationBanner } from "../components/SimulationBanner";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { TableFelt } from "../components/table/TableFelt";
import { ActionBar } from "../components/table/ActionBar";
import { DireControlBar } from "../components/table/DireControlBar";
import { DirePanel } from "../components/table/DirePanel";
import { HistoryPanel } from "../components/table/HistoryPanel";
import { useAuth } from "../contexts/AuthContext";
import { useTableRoom } from "../hooks/useTableRoom";
import { tableApi } from "../services/tableApi";
import { getErrorMessage } from "../services/api";

export default function TableRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { table, loading, error, feed, refresh } = useTableRoom(id);
  const [showDire, setShowDire] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt-darker text-white/60">Carregando mesa...</div>
    );
  }

  if (error || !table) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-felt-darker text-white/60 gap-4 px-4 text-center">
        <p>{error ?? "Mesa não encontrada."}</p>
        <Button onClick={() => navigate("/")}>Voltar ao início</Button>
      </div>
    );
  }

  if (!table.isMember) {
    return (
      <div className="min-h-screen flex flex-col bg-felt-darker">
        <SimulationBanner compact />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-bold">{table.name}</h1>
          <p className="text-white/50 text-sm">Você não faz parte desta mesa ainda.</p>
          <Button
            variant="gold"
            onClick={async () => {
              try {
                await tableApi.join(table.code);
                refresh();
              } catch (err) {
                setLeaveError(getErrorMessage(err));
              }
            }}
          >
            ENTRAR NESTA MESA
          </Button>
          {leaveError && <p className="text-red-400 text-sm">{leaveError}</p>}
          <button onClick={() => navigate("/")} className="text-white/40 text-sm underline">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const me = table.players.find((p) => p.userId === user?.id);
  const isDire = table.myRole === "DIRE";

  return (
    <div className="min-h-screen flex flex-col bg-felt-darker">
      <SimulationBanner compact />

      <header className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-white/10 bg-panel/60">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-white/10 shrink-0 touch-target" aria-label="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="font-bold truncate text-sm sm:text-base">{table.name}</p>
            <p className="text-[10px] sm:text-xs text-white/40">Código: {table.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <StatusBadge status={table.status} />
          {!isDire && (
            <button
              onClick={() => setShowHistory(true)}
              className="p-2 rounded-lg hover:bg-white/10 touch-target"
              aria-label="Histórico"
            >
              <History size={18} />
            </button>
          )}
          {isDire && (
            <button
              onClick={() => setShowDire(true)}
              className="p-2 rounded-lg bg-gold/20 text-gold hover:bg-gold/30 touch-target"
              aria-label="Painel do DIRE"
            >
              <Settings size={18} />
            </button>
          )}
          {!isDire && me?.status === "ACTIVE" && (
            <button
              onClick={async () => {
                if (confirm("Sair desta mesa? Suas fichas atuais serão perdidas.")) {
                  await tableApi.leave(table.id);
                  navigate("/");
                }
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-red-400 touch-target"
              aria-label="Sair da mesa"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
        {table.status === "PAUSADA" && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-center text-sm py-2 rounded-xl font-semibold">
            MESA PAUSADA PELO DIRE
          </div>
        )}

        {isDire && <DireControlBar table={table} onOpenPanel={() => setShowDire(true)} onChanged={refresh} />}

        <TableFelt players={table.players} round={table.activeRound} meUserId={user?.id} />

        {feed.length > 0 && (
          <div className="bg-panel/60 border border-white/10 rounded-xl px-4 py-3 max-h-32 overflow-y-auto">
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5">Atividade recente</p>
            <ul className="space-y-1">
              {/* The DIRE follows the whole table; a player only needs the last few moves. */}
              {feed.slice(0, isDire ? 6 : 3).map((f) => (
                <li key={f.id} className="text-xs text-white/70">
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-panel border-t border-white/10 safe-bottom">
        <div className="max-w-3xl mx-auto">
          {me && (
            <div className="flex items-center justify-between px-4 pt-3 text-xs sm:text-sm text-white/60">
              <span>
                Suas fichas: <span className="font-bold text-gold">{me.chips}</span>
              </span>
              <span>
                Na mesa: <span className="font-bold text-white">{table.activeRound?.players.find((p) => p.userId === user?.id)?.contributed ?? 0}</span>
              </span>
            </div>
          )}
          <ActionBar round={table.activeRound} me={me} minBuyIn={table.minBuyIn} actionTimerSeconds={table.actionTimerSeconds} onChanged={refresh} />
        </div>
      </footer>

      {showDire && isDire && <DirePanel table={table} onClose={() => setShowDire(false)} onChanged={refresh} />}
      {showHistory && !isDire && <HistoryPanel tableId={table.id} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
