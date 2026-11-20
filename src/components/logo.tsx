import { useId } from "react";
import { cn } from "@/lib/utils";

// The AHAM mark: a lotus mandala with a gold bindu (the still point) at its heart.
// `full` has the dotted halo (large uses); `small` drops it and draws bolder (header, favicon). Static copies live in /public.
const OUTER = "M0 0 C -12 -14, -10 -36, 0 -48 C 10 -36, 12 -14, 0 0Z";
const INNER = "M0 0 C -8 -8, -7 -22, 0 -30 C 7 -22, 8 -8, 0 0Z";

export function LogoMark({ size = 32, variant = "small", className }: { size?: number; variant?: "full" | "small"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const full = variant === "full";
  const rose = `${uid}-rose`, deep = `${uid}-deep`, gold = `${uid}-gold`;
  const sw = full ? [1.1, 1] : [2.4, 2.2];
  return (
    // the small version is cropped to the petals, so it fills its box instead of floating in margin (the halo needs the full frame)
    <svg viewBox={full ? "0 0 120 120" : "8 8 104 104"} width={size} height={size} className={cn("shrink-0", className)} role="img" aria-label="AHAM">
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
      {/* the bindu: a gold bead with a white ring and a small highlight */}
      <circle cx={60} cy={60} r={full ? 8.5 : 11.5} fill={`url(#${gold})`} stroke="#fff" strokeWidth={full ? 1.2 : 2.6} />
      <circle cx={full ? 57.6 : 57} cy={full ? 57.6 : 57} r={full ? 2.2 : 2.6} fill="#fff4c9" opacity={full ? 0.9 : 0.85} />
    </svg>
  );
}

/** Mark + wordmark for the header. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={46} />
      <span className="text-xl font-bold tracking-[0.22em]">AHAM</span>
      <span className="hidden text-xs text-muted-foreground md:inline">The quiet art of tending</span>
    </div>
  );
}
