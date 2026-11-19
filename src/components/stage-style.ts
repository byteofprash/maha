import type { Stage } from "@/lib/plants";

// Calm washes, never alarm colours: the plant does the talking. Shared by the tile and the details view.
export const STAGE_BG: Record<Stage, string> = {
  thriving: "from-emerald-50 to-card dark:from-emerald-500/10",
  content: "from-lime-50 to-card dark:from-lime-500/10",
  thirsty: "from-amber-50 to-card dark:from-amber-500/10",
  waiting: "from-stone-100 to-card dark:from-stone-500/15",
};
export const STAGE_TEXT: Record<Stage, string> = {
  thriving: "text-emerald-700 dark:text-emerald-300",
  content: "text-lime-700 dark:text-lime-300",
  thirsty: "text-amber-700 dark:text-amber-300",
  waiting: "text-stone-600 dark:text-stone-300",
};
