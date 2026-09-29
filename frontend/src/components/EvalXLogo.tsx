import { cn } from "@/lib/utils";

interface EvalXLogoProps {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
}

export function EvalXLogo({ className, markClassName, showTagline = true }: EvalXLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} data-testid="evalx-logo">
      <svg
        viewBox="0 0 44 44"
        role="img"
        aria-label="EvalX checkmark and answer sheet logo"
        className={cn("size-10 shrink-0 drop-shadow-[0_5px_12px_rgba(30,58,43,0.18)]", markClassName)}
        data-testid="evalx-logo-mark"
      >
        <rect width="44" height="44" rx="13" fill="#1E3A2B" />
        <path d="M13 10.5h13.8L33 16.7v16.8H13v-23Z" fill="#F7F4ED" fillOpacity=".12" stroke="#F7F4ED" strokeWidth="1.5" />
        <path d="M26.8 10.8v6h5.8" stroke="#D99A79" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m15.8 24.4 4 4 9-10" fill="none" stroke="#F7F4ED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m27.8 26.7 4.3 5.1m0-5.1-4.3 5.1" stroke="#D99A79" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div>
        <p className="font-heading text-xl font-semibold leading-none tracking-[-0.055em] text-[#183426]" data-testid="evalx-wordmark">Eval<span className="text-[#c86d51]">X</span></p>
        {showTagline && <p className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a998f] sm:block" data-testid="evalx-tagline">Evaluation, explained</p>}
      </div>
    </div>
  );
}