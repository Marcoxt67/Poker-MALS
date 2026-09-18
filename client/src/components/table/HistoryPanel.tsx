import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { tableApi } from "../../services/tableApi";
import { HistoryEntry } from "../../types";

export const HistoryPanel = ({ tableId, onClose }: { tableId: string; onClose: () => void }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tableApi
      .history(tableId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [tableId]);

  return (
    <Modal title="Histórico da mesa" onClose={onClose}>
      {loading && <p className="text-white/40 text-sm">Carregando...</p>}
      <div className="space-y-2 max-h-[70vh] overflow-y-auto">
        {history.map((h) => (
          <div key={h.id} className="flex items-start gap-3 text-sm border-b border-white/5 pb-2">
            <span className="text-white/30 text-xs shrink-0 pt-0.5">
              {new Date(h.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <p className="text-white/80">{h.description}</p>
          </div>
        ))}
        {!loading && history.length === 0 && <p className="text-white/40 text-sm">Nenhuma movimentação ainda.</p>}
      </div>
    </Modal>
  );
};
