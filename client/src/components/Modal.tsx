import { ReactNode } from "react";
import { X } from "lucide-react";

export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-md bg-panel border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 touch-target" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
