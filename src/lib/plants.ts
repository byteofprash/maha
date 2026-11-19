// Every ritual grows its own plant. Pure logic only (the drawing lives in components/plant.tsx).

export const PLANT_KEYS = ["daisy", "tulip", "sunflower", "lavender", "cosmos", "succulent"] as const;
export type PlantKey = (typeof PLANT_KEYS)[number];

export const PLANT_LABEL: Record<PlantKey, string> = {
  daisy: "Daisy",
  tulip: "Tulip",
  sunflower: "Sunflower",
  lavender: "Lavender",
  cosmos: "Cosmos",
  succulent: "Succulent",
};

export const isPlant = (k: string | undefined): k is PlantKey => !!k && (PLANT_KEYS as readonly string[]).includes(k);

export function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** The plant to draw: the stored one, or (for legacy rows / unknown keys) a stable pick from the id. */
export const plantFor = (t: { id: string; plant?: string }): PlantKey =>
  isPlant(t.plant) ? t.plant : PLANT_KEYS[hash(t.id) % PLANT_KEYS.length];

/** The least-used plant so far (random among ties, never `avoid`), so a new ritual never looks like its neighbours. */
export function pickPlant(tasks: { plant?: string }[], avoid?: string, rnd: () => number = Math.random): PlantKey {
  const used = new Map<PlantKey, number>(PLANT_KEYS.map((k) => [k, 0]));
  for (const t of tasks) if (isPlant(t.plant)) used.set(t.plant, used.get(t.plant)! + 1);
  const candidates = PLANT_KEYS.filter((k) => k !== avoid);
  const min = Math.min(...candidates.map((k) => used.get(k)!));
  const pool = candidates.filter((k) => used.get(k) === min);
  return pool[Math.floor(rnd() * pool.length)];
}

export type Stage = "thriving" | "content" | "thirsty" | "waiting";

/** How alive the plant looks: 1 = just tended, 0 = due today, negative = waiting past its day (floored, never "dead"). */
export const VITALITY_FLOOR = -0.4;

export const stageOf = (v: number): Stage => (v > 0.6 ? "thriving" : v > 0.3 ? "content" : v > 0 ? "thirsty" : "waiting");

export const STAGE_LABEL: Record<Stage, string> = {
  thriving: "Thriving",
  content: "Content",
  thirsty: "Getting thirsty",
  waiting: "Waiting for you",
};
