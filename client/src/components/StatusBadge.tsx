import { TableStatus } from "../types";

const statusConfig: Record<TableStatus, { label: string; classes: string }> = {
  AGUARDANDO: { label: "AGUARDANDO", classes: "bg-white/10 text-white/70" },
  EM_ANDAMENTO: { label: "AO VIVO", classes: "bg-emerald-500/20 text-emerald-400" },
  FINALIZANDO: { label: "FINALIZANDO", classes: "bg-amber-500/20 text-amber-400" },
  FINALIZADA: { label: "ENCERRADA", classes: "bg-white/5 text-white/40" },
  PAUSADA: { label: "PAUSADA", classes: "bg-red-500/20 text-red-400" },
};

export const StatusBadge = ({ status }: { status: TableStatus }) => {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide ${cfg.classes}`}>
      {status === "EM_ANDAMENTO" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />}
      {cfg.label}
    </span>
  );
};
