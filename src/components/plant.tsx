import type { CSSProperties, ReactNode } from "react";
import { hash, VITALITY_FLOOR, type PlantKey } from "@/lib/plants";
import { cn } from "@/lib/utils";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Geometry shared by every plant (viewBox 0 0 120 140): pot on the ground, stem rising from (60, BASE) to the flower at (60, HEAD).
const BASE = 110;
const T = "1.2s cubic-bezier(.25,.8,.25,1)"; // slow, soft: a plant perking up, not a UI toggling

const LEAF = "#6fae6a";
const LEAF_DARK = "#4f8f55";

/** A pair of leaves hanging off the stem. They lift when the plant is happy and sag when it is thirsty. */
function Leaves({ y, size = 1, lift }: { y: number; size?: number; lift: number }) {
  const leaf = (dir: 1 | -1) => (
    <g
      style={{
        transform: `rotate(${dir * lift}deg)`,
        transformOrigin: `60px ${y}px`,
        transition: `transform ${T}`,
      }}
    >
      {/* a leaf pointing left; mirrored for the right-hand one */}
      <path
        d={`M60 ${y} C${60 - 16 * size} ${y - 11 * size}, ${60 - 28 * size} ${y - 7 * size}, ${60 - 34 * size} ${y + 1 * size} C${60 - 22 * size} ${y + 7 * size}, ${60 - 9 * size} ${y + 5 * size}, 60 ${y}Z`}
        fill={LEAF}
        stroke={LEAF_DARK}
        strokeWidth={0.8}
        transform={dir === 1 ? undefined : `translate(120 0) scale(-1 1)`}
      />
    </g>
  );
  // left leaf rotates clockwise to lift, right leaf counter-clockwise
  return (
    <>
      {leaf(1)}
      {leaf(-1)}
    </>
  );
}

const petals = (n: number, cx: number, cy: number, rx: number, ry: number, off: number, fill: string, stroke?: string) =>
  Array.from({ length: n }, (_, k) => (
    <ellipse
      key={k}
      cx={cx}
      cy={cy - off}
      rx={rx}
      ry={ry}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 0.8 : 0}
      transform={`rotate(${(360 / n) * k} ${cx} ${cy})`}
    />
  ));

type Species = {
  headY: number;
  /** how far below the flower the stem bends when it bows (a long spike bends from below its tip) */
  neck: number;
  leafY: number[];
  leafSize: number;
  flower: (y: number) => ReactNode;
  /** a plant with no stem, just a rosette (succulent) */
  rosette?: boolean;
};

const SPECIES: Record<PlantKey, Species> = {
  daisy: {
    neck: 22,
    headY: 46,
    leafY: [96, 82],
    leafSize: 0.95,
    flower: (y) => (
      <>
        {petals(10, 60, y, 4.4, 11, 11, "#fffdf6", "#e6dfcc")}
        <circle cx={60} cy={y} r={6.5} fill="#f5c14f" />
        <circle cx={58.5} cy={y - 1.5} r={1.6} fill="#fbe08a" />
      </>
    ),
  },
  tulip: {
    neck: 22,
    headY: 50,
    leafY: [98, 86],
    leafSize: 1.15,
    flower: (y) => (
      <>
        <path d={`M60 ${y + 8} C46 ${y + 4} 46 ${y - 14} 52 ${y - 22} C58 ${y - 14} 60 ${y - 4} 60 ${y + 8}Z`} fill="#f0969f" />
        <path d={`M60 ${y + 8} C74 ${y + 4} 74 ${y - 14} 68 ${y - 22} C62 ${y - 14} 60 ${y - 4} 60 ${y + 8}Z`} fill="#ee8794" />
        <path d={`M60 ${y + 10} C51 ${y + 2} 51 ${y - 16} 60 ${y - 27} C69 ${y - 16} 69 ${y + 2} 60 ${y + 10}Z`} fill="#f6b3ba" />
      </>
    ),
  },
  sunflower: {
    neck: 24,
    headY: 42,
    leafY: [98, 82],
    leafSize: 1.1,
    flower: (y) => (
      <>
        {petals(16, 60, y, 3.6, 9.5, 14.5, "#f6c63f", "#e0a92a")}
        <circle cx={60} cy={y} r={10} fill="#7b4d2b" />
        <circle cx={60} cy={y} r={6.2} fill="#5f3a20" />
        <circle cx={57} cy={y - 2} r={1.1} fill="#a1703e" />
        <circle cx={63} cy={y + 2} r={1.1} fill="#a1703e" />
        <circle cx={61} cy={y - 4} r={1} fill="#a1703e" />
      </>
    ),
  },
  lavender: {
    neck: 46,
    headY: 36,
    leafY: [100, 90],
    leafSize: 0.85,
    flower: (y) => (
      <>
        {Array.from({ length: 7 }, (_, i) => (
          <g key={i}>
            <ellipse cx={56.8} cy={y + i * 6.2} rx={3.1} ry={4.6} fill={i % 2 ? "#a595dc" : "#b6a8ea"} transform={`rotate(-14 56.8 ${y + i * 6.2})`} />
            <ellipse cx={63.2} cy={y + i * 6.2 + 2.8} rx={3.1} ry={4.6} fill={i % 2 ? "#b6a8ea" : "#a595dc"} transform={`rotate(14 63.2 ${y + i * 6.2 + 2.8})`} />
          </g>
        ))}
        <ellipse cx={60} cy={y - 4} rx={2.8} ry={5} fill="#b6a8ea" />
      </>
    ),
  },
  cosmos: {
    neck: 22,
    headY: 46,
    leafY: [96, 80],
    leafSize: 0.9,
    flower: (y) => (
      <>
        {petals(8, 60, y, 6.2, 11.5, 11.5, "#f6a9c4", "#e68fb0")}
        <circle cx={60} cy={y} r={5} fill="#f6b84a" />
        <circle cx={60} cy={y} r={2.4} fill="#e59a2c" />
      </>
    ),
  },
  succulent: {
    neck: 14,
    headY: 64,
    leafY: [],
    leafSize: 1,
    rosette: true,
    flower: (y) => (
      <>
        {petals(6, 60, y, 3.3, 7.5, 7.5, "#f4a090", "#e98a78")}
        <circle cx={60} cy={y} r={3.4} fill="#ffe08a" />
      </>
    ),
  },
};

function Rosette({ droop }: { droop: number }) {
  // fat, pale-green leaves fanning out from the pot; they relax outwards when thirsty
  const rows = [
    { a: -66, s: 1, c: "#7fb87a" },
    { a: 66, s: 1, c: "#7fb87a" },
    { a: -36, s: 1.1, c: "#8cc487" },
    { a: 36, s: 1.1, c: "#8cc487" },
    { a: 0, s: 1.2, c: "#99cd93" },
  ];
  return (
    <>
      {rows.map((r, i) => (
        <g
          key={i}
          style={{ transform: `rotate(${r.a * (1 + droop * 0.35)}deg)`, transformOrigin: `60px ${BASE}px`, transition: `transform ${T}` }}
        >
          <ellipse cx={60} cy={BASE - 15 * r.s} rx={7.5} ry={15 * r.s} fill={r.c} stroke={LEAF_DARK} strokeWidth={0.8} />
        </g>
      ))}
    </>
  );
}

export type PlantProps = {
  species: PlantKey;
  /** 1 = just tended, 0 = due today, below 0 = waiting. See `vitality` in lib/dates.ts. */
  vitality: number;
  /** keeps each plant's sway and lean different from its neighbours */
  seed?: string;
  /** play the watering animation */
  tending?: boolean;
  className?: string;
};

export function Plant({ species, vitality, seed = "", tending, className }: PlantProps) {
  const sp = SPECIES[species];
  const v = clamp(vitality, VITALITY_FLOOR, 1);
  const alive = clamp(v, 0, 1); // 0 at due day, 1 when fresh
  const wilt = clamp(-v / -VITALITY_FLOOR, 0, 1); // 0 until due, 1 at the floor
  const thirst = clamp((0.35 - v) / (0.35 - VITALITY_FLOOR), 0, 1); // starts drooping a little before due

  const h = hash(seed || species);
  const dir = h % 2 ? 1 : -1;
  const lean = dir * 6 * thirst; // whole plant leans a little
  const headTilt = dir * 74 * thirst; // the stem bends at its neck and the flower bows
  const leafLift = 10 + 35 * alive - 32 * wilt; // leaves: 45 deg up when happy, hanging when waiting
  const open = 0.7 + 0.3 * clamp((v - VITALITY_FLOOR) / (1 - VITALITY_FLOOR), 0, 1); // the bloom closes up a little
  const sat = 0.5 + 0.5 * clamp((v - VITALITY_FLOOR) / 0.9, 0, 1); // colour drains softly
  const sepia = 0.32 * wilt;

  const style = {
    filter: `saturate(${sat.toFixed(2)}) sepia(${sepia.toFixed(2)})`,
    transition: `filter ${T}`,
    "--amp": `${(0.5 + 1.3 * alive).toFixed(2)}deg`,
    "--dur": `${5 + (h % 30) / 10}s`,
    "--delay": `-${(h % 50) / 10}s`,
  } as CSSProperties;

  const { headY } = sp;
  const pivotY = headY + sp.neck; // where the stem bends
  return (
    <svg viewBox="0 0 120 140" className={cn("overflow-visible", className)} style={style} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`glow-${seed}`}>
          <stop offset="0%" stopColor="#bfe6f7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#bfe6f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {tending && <circle className="plant-glow" cx={60} cy={72} r={54} fill={`url(#glow-${seed})`} />}

      <g className="plant-sway">
        <g style={{ transform: `rotate(${lean}deg)`, transformOrigin: `60px ${BASE}px`, transition: `transform ${T}` }}>
          <path d={`M60 ${BASE} L60 ${pivotY}`} stroke={LEAF_DARK} strokeWidth={3} strokeLinecap="round" fill="none" />
          {sp.rosette && <Rosette droop={thirst} />}
          {sp.leafY.map((y, i) => (
            <Leaves key={i} y={y} size={sp.leafSize * (i ? 0.85 : 1)} lift={leafLift} />
          ))}
          <g style={{ transform: `rotate(${headTilt}deg)`, transformOrigin: `60px ${pivotY}px`, transition: `transform ${T}` }}>
            {/* the top of the stem travels with the flower, so the bow reads as a bend */}
            <path d={`M60 ${pivotY} L60 ${headY + 4}`} stroke={LEAF_DARK} strokeWidth={3} strokeLinecap="round" fill="none" />
            <g style={{ transform: `scale(${open})`, transformOrigin: `60px ${headY}px`, transition: `transform ${T}` }}>
              {sp.flower(headY)}
            </g>
          </g>
        </g>
      </g>

      {/* pot */}
      <path d="M40 114 H80 L76 133 Q75.6 136 73 136 H47 Q44.4 136 44 133 Z" fill="#d79c78" />
      <rect x={37} y={108.5} width={46} height={7} rx={3} fill="#cb8964" />
      <ellipse cx={60} cy={109.5} rx={21} ry={2.2} fill="#6d4b39" />

      {tending && (
        <g>
          {[46, 60, 74].map((x, i) => (
            <g key={x} transform={`translate(${x} 4)`}>
              <path className="plant-drop" style={{ animationDelay: `${i * 0.18}s` }} d="M0 -6 C3 -1 4.5 2 0 4.5 C-4.5 2 -3 -1 0 -6Z" fill="#7cc4ec" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
