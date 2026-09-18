import { useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "../Button";
import { RaisePanel } from "./RaisePanel";
import { useCountdown } from "../../hooks/useCountdown";
import { RoundView, TablePlayerView } from "../../types";
import { roundApi } from "../../services/roundApi";
import { getErrorMessage } from "../../services/api";

interface Props {
  round: RoundView | null;
  me: TablePlayerView | undefined;
  minBuyIn: number;
  actionTimerSeconds: number;
  onChanged: () => void;
}

export const ActionBar = ({ round, me, minBuyIn, actionTimerSeconds, onChanged }: Props) => {
  const [showRaise, setShowRaise] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myTurn = Boolean(round && me && round.turnUserId === me.userId && round.status === "EM_ANDAMENTO");
  const myRoundInfo = round?.players.find((p) => p.userId === me?.userId);
  const iAmFolded = myRoundInfo?.status === "FOLDED";

  const act = async (fn: () => Promise<unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      await fn();
      setShowRaise(false);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível executar a ação."));
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = useCountdown(actionTimerSeconds, `${round?.id}-${round?.turnUserId}`, myTurn, () => {
    if (myTurn && round) {
      act(() => roundApi.fold(round.id));
    }
  });

  if (!round || round.status !== "EM_ANDAMENTO") {
    return (
      <div className="px-4 py-4 text-center text-white/40 text-sm">
        {round?.status === "FINALIZADA" ? "Rodada finalizada. Aguardando o DIRE iniciar a próxima." : "Aguardando o DIRE iniciar a rodada."}
      </div>
    );
  }

  if (!me || me.status !== "ACTIVE") {
    return <div className="px-4 py-4 text-center text-white/40 text-sm">Você está apenas observando esta mesa.</div>;
  }

  if (iAmFolded) {
    return <div className="px-4 py-4 text-center text-red-400 text-sm font-semibold">Você saiu desta rodada.</div>;
  }

  const needed = round.currentBet - (myRoundInfo?.contributed ?? 0);
  const currentTurnPlayer = round.players.find((p) => p.userId === round.turnUserId);

  if (!myTurn) {
    return (
      <div className="px-4 py-4 text-center text-white/60 text-sm">
        Aguardando <span className="font-semibold text-white">{currentTurnPlayer?.displayName ?? "jogador"}</span>...
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span className="font-bold text-gold">SUA VEZ</span>
        <span className="flex items-center gap-1">
          <Timer size={14} className={remaining <= 10 ? "text-red-400" : ""} />
          <span className={remaining <= 10 ? "text-red-400 font-semibold" : ""}>00:{String(remaining).padStart(2, "0")}</span>
        </span>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      {showRaise ? (
        <RaisePanel
          minValue={round.currentBet + minBuyIn}
          maxValue={me.chips + (myRoundInfo?.contributed ?? 0)}
          step={minBuyIn}
          submitting={submitting}
          onCancel={() => setShowRaise(false)}
          onConfirm={(value) => act(() => roundApi.raise(round.id, value))}
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {round.currentBet === 0 ? (
            <>
              <Button variant="gold" className="col-span-2" disabled={submitting} onClick={() => act(() => roundApi.bet(round.id, minBuyIn))}>
                APOSTAR {minBuyIn}
              </Button>
              <Button variant="danger" disabled={submitting} onClick={() => act(() => roundApi.fold(round.id))}>
                SAIR
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" disabled={submitting || needed <= 0} onClick={() => act(() => roundApi.call(round.id))}>
                PAGAR {needed > 0 ? needed : ""}
              </Button>
              <Button variant="subtle" disabled={submitting} onClick={() => setShowRaise(true)}>
                AUMENTAR
              </Button>
              <Button variant="danger" disabled={submitting} onClick={() => act(() => roundApi.fold(round.id))}>
                SAIR
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
