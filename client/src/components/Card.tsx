import { HTMLAttributes } from "react";

export const Card = ({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-2xl bg-panel border border-white/10 p-4 sm:p-6 ${className}`} {...rest}>
    {children}
  </div>
);

export const Input = ({ className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`w-full rounded-xl bg-felt-darker/80 border border-white/15 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-gold focus:ring-1 focus:ring-gold touch-target ${className}`}
    {...rest}
  />
);

export const Label = ({ className = "", ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`block text-xs sm:text-sm font-medium text-white/70 mb-1.5 ${className}`} {...rest} />
);
