import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "../Button";

interface Props {
  minValue: number;
  maxValue: number;
  step: number;
  onConfirm: (value: number) => void;
  onCancel: () => void;
  submitting: boolean;
}

export const RaisePanel = ({ minValue, maxValue, step, onConfirm, onCancel, submitting }: Props) => {
  const [value, setValue] = useState(minValue);

  const clamp = (v: number) => Math.max(minValue, Math.min(maxValue, v));

  return (
    <div className="bg-panel-light border border-white/10 rounded-xl p-4 space-y-3">
      <p className="text-xs text-white/50 uppercase tracking-wide text-center">Novo valor</p>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setValue((v) => clamp(v - step))}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center touch-target"
          aria-label="Diminuir"
        >
          <Minus size={18} />
        </button>
        <span className="text-2xl sm:text-3xl font-bold text-gold w-20 text-center">{value}</span>
        <button
          onClick={() => setValue((v) => clamp(v + step))}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center touch-target"
          aria-label="Aumentar"
        >
          <Plus size={18} />
        </button>
      </div>
      <p className="text-center text-[11px] text-white/40">Máximo: {maxValue} fichas</p>
      <div className="flex gap-2">
        <Button variant="ghost" fullWidth onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="gold" fullWidth onClick={() => onConfirm(value)} disabled={submitting}>
          AUMENTAR
        </Button>
      </div>
    </div>
  );
};
