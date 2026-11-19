import { useId } from "react";
import { cn } from "@/lib/utils";

// The MAHA mark: a lotus mandala whose heart is a drop of water (the "tending" that waters every plant).
// `full` has the dotted halo (large uses); `small` drops it and draws bolder (header, favicon). Static copies live in /public.
const OUTER = "M0 0 C -12 -14, -10 -36, 0 -48 C 10 -36, 12 -14, 0 0Z";
const INNER = "M0 0 C -8 -8, -7 -22, 0 -30 C 7 -22, 8 -8, 0 0Z";
const DROP = "M0 -13 C 5 -6, 9 -1, 9 4 C 9 9, 5 13, 0 13 C -5 13, -9 9, -9 4 C -9 -1, -5 -6, 0 -13Z";

export function LogoMark({ size = 32, variant = "small", className }: { size?: number; variant?: "full" | "small"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const full = variant === "full";
  const rose = `${uid}-rose`, deep = `${uid}-deep`, gold = `${uid}-gold`;
  const sw = full ? [1.1, 1] : [2.4, 2.2];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={cn("shrink-0", className)} role="img" aria-label="MAHA">
      <defs>
        <linearGradient id={rose} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffc2d1" /><stop offset="1" stopColor="#f4789b" /></linearGradient>
        <linearGradient id={deep} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7a1ba" /><stop offset="1" stopColor="#e5557f" /></linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#f2a93b" /></linearGradient>
      </defs>
      {full && <circle cx={60} cy={60} r={55} fill="none" stroke="#86bf8f" strokeWidth={1.6} strokeDasharray="1.5 4.2" strokeLinecap="round" />}
      {Array.from({ length: 8 }, (_, k) => (
        <path key={`o${k}`} d={OUTER} transform={`translate(60 60) rotate(${k * 45})`} fill={`url(#${rose})`} stroke="#fff" strokeWidth={sw[0]} strokeLinejoin="round" />
      ))}
      {Array.from({ length: 8 }, (_, k) => (
        <path key={`i${k}`} d={INNER} transform={`translate(60 60) rotate(${22.5 + k * 45})`} fill={`url(#${deep})`} stroke="#fff" strokeWidth={sw[1]} strokeLinejoin="round" />
      ))}
      <circle cx={60} cy={60} r={full ? 13 : 15} fill="#fff" />
      <g transform={`translate(60 60.8) scale(${full ? 1 : 1.12})`}>
        <path d={DROP} fill={`url(#${gold})`} />
        {full && <path d="M-4.2 4 C -4.2 0.6, -2.4 -2.2, 0 -4.6" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.75} />}
      </g>
    </svg>
  );
}

/** Mark + wordmark for the header. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={32} />
      <span className="text-lg font-bold tracking-[0.22em]">MAHA</span>
      <span className="hidden text-xs text-muted-foreground md:inline">Master your Aham</span>
    </div>
  );
}
