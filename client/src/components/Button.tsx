import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "danger" | "ghost" | "gold" | "subtle";

const variantClasses: Record<Variant, string> = {
  primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40",
  danger: "bg-chip-red hover:bg-red-600 text-white shadow-lg shadow-red-900/40",
  ghost: "bg-white/5 hover:bg-white/10 text-white border border-white/15",
  gold: "bg-gold hover:bg-gold-light text-felt-darker font-bold shadow-lg shadow-yellow-900/30",
  subtle: "bg-panel-light hover:bg-white/10 text-white/90",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", fullWidth, className = "", children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`touch-target inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm sm:text-base font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
          variantClasses[variant]
        } ${fullWidth ? "w-full" : ""} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
