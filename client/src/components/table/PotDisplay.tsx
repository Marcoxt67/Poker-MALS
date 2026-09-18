import { Coins } from "lucide-react";

export const PotDisplay = ({ pot }: { pot: number }) => {
  return (
    <div key={pot} className="flex flex-col items-center animate-chip-in">
      <div className="flex items-center gap-1.5 sm:gap-2 bg-felt-darker/80 border-2 border-gold/50 rounded-full px-4 sm:px-6 py-2 sm:py-3 shadow-lg">
        <Coins className="text-gold" size={18} />
        <div className="leading-tight">
          <p className="text-[9px] sm:text-[10px] text-gold/70 uppercase tracking-wider text-center">Pote</p>
          <p className="text-base sm:text-xl font-bold text-gold text-center">{pot}</p>
        </div>
      </div>
    </div>
  );
};
