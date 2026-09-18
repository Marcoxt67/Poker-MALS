import { PlayerSeat } from "./PlayerSeat";
import { PotDisplay } from "./PotDisplay";
import { RoundView, TablePlayerView } from "../../types";

interface Props {
  players: TablePlayerView[];
  round: RoundView | null;
  meUserId: string | undefined;
}

export const TableFelt = ({ players, round, meUserId }: Props) => {
  const activePlayers = players.filter((p) => p.status === "ACTIVE");
  const me = activePlayers.find((p) => p.userId === meUserId);
  const others = activePlayers.filter((p) => p.userId !== meUserId);

  const roundInfoFor = (userId: string) => round?.players.find((p) => p.userId === userId);

  return (
    <div className="relative bg-gradient-to-b from-felt to-felt-dark rounded-3xl shadow-table border-4 sm:border-8 border-felt-dark/80 px-3 sm:px-8 py-6 sm:py-10 min-h-[280px] sm:min-h-[360px] flex flex-col justify-between overflow-hidden">
      <div
        className="absolute inset-4 sm:inset-8 rounded-full border-2 border-white/5 pointer-events-none"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-center gap-3 sm:gap-8 z-10">
        {others.length === 0 && <p className="text-white/30 text-xs sm:text-sm py-4">Aguardando outros jogadores entrarem...</p>}
        {others.map((p) => (
          <PlayerSeat key={p.id} player={p} roundInfo={roundInfoFor(p.userId)} isTurn={round?.turnUserId === p.userId} isMe={false} />
        ))}
      </div>

      <div className="relative flex items-center justify-center py-4 sm:py-6 z-10">
        <PotDisplay pot={round?.potTotal ?? 0} />
      </div>

      <div className="relative flex items-center justify-center z-10">
        {me ? (
          <PlayerSeat player={me} roundInfo={roundInfoFor(me.userId)} isTurn={round?.turnUserId === me.userId} isMe />
        ) : (
          <p className="text-white/30 text-xs sm:text-sm">Você está observando esta mesa.</p>
        )}
      </div>
    </div>
  );
};
