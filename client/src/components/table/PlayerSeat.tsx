import { RoundPlayerView, TablePlayerView } from "../../types";

interface Props {
  player: TablePlayerView;
  roundInfo?: RoundPlayerView;
  isTurn: boolean;
  isMe: boolean;
  compact?: boolean;
}

export const PlayerSeat = ({ player, roundInfo, isTurn, isMe, compact }: Props) => {
  const folded = roundInfo?.status === "FOLDED";
  const left = player.status !== "ACTIVE";

  return (
    <div
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${folded || left ? "opacity-40 grayscale" : ""} ${
        compact ? "w-16 sm:w-20" : "w-20 sm:w-24"
      }`}
    >
      <div className="relative">
        <div
          className={`rounded-full flex items-center justify-center font-bold border-2 ${
            compact ? "w-10 h-10 text-sm" : "w-12 h-12 sm:w-14 sm:h-14 text-base sm:text-lg"
          } ${
            isTurn
              ? "border-gold bg-gold/20 text-gold animate-pulse-ring"
              : player.role === "DIRE"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                : "border-white/20 bg-panel-light text-white/80"
          }`}
        >
          {player.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
        {player.role === "DIRE" && (
          <span className="absolute -top-1 -right-1 bg-emerald-500 text-[8px] font-bold px-1 py-0.5 rounded-full text-white">
            DIRE
          </span>
        )}
        {isMe && <span className="absolute -bottom-1 -right-1 bg-gold text-[8px] font-bold px-1 py-0.5 rounded-full text-felt-darker">VOCÊ</span>}
      </div>
      <p className="text-[10px] sm:text-xs font-medium text-center truncate max-w-full">{player.displayName}</p>
      <p className="text-[10px] sm:text-xs font-bold text-gold">{player.chips}</p>
      {roundInfo && roundInfo.contributed > 0 && !folded && (
        <span className="text-[9px] sm:text-[10px] bg-white/10 text-white/80 px-1.5 py-0.5 rounded-full animate-chip-in">
          {roundInfo.contributed} na mesa
        </span>
      )}
      {folded && <span className="text-[9px] sm:text-[10px] text-red-400 font-semibold">SAIU</span>}
      {isTurn && !folded && <span className="text-[9px] sm:text-[10px] text-gold font-semibold">JOGANDO...</span>}
    </div>
  );
};
