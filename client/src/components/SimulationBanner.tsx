import { ShieldAlert } from "lucide-react";

export const SimulationBanner = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div
      className={`flex items-center justify-center gap-2 bg-gold/10 text-gold border-b border-gold/30 font-semibold tracking-wide text-center ${
        compact ? "py-1 text-[10px] xs:text-xs" : "py-2 text-xs sm:text-sm"
      }`}
    >
      <ShieldAlert className="shrink-0" size={compact ? 12 : 14} />
      <span>SIMULAÇÃO • FICHAS VIRTUAIS SEM VALOR MONETÁRIO</span>
    </div>
  );
};
