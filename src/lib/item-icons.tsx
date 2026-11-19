import { useState } from "react";
import {
  AirVent, Archive, Armchair, Bath, Battery, Bell, Bike, Bird, Bot, Blinds, Camera, Car, Cat, ChefHat, CircuitBoard, Coffee,
  CookingPot, Dog, Drill, Droplets, Fan, Fish, Flame, Gamepad2, Hammer, Headphones, Laptop, Lamp, Leaf, Lightbulb,
  Lock, Microwave, Monitor, Package, PawPrint, Phone, Plug, Printer, Refrigerator, Router, Ruler, Siren, Snowflake, Sofa, Soup,
  Speaker, Sprout, Sun, Tablet, Thermometer, ShowerHead, Toilet, TreeDeciduous, Tv, Utensils, Vault, Wind, Wifi, Watch,
  WashingMachine, BedDouble, Shirt, type LucideIcon,
} from "lucide-react";
import { decideIcon, type IconDecision, type IconKey } from "@/lib/item-icon-rules";
import { cn } from "@/lib/utils";

type Tone = "amber" | "sky" | "teal" | "cyan" | "indigo" | "violet" | "stone" | "emerald" | "rose" | "orange";

// Soft tinted tiles: calm colours that feel like a home, not a dashboard. Literal class names so Tailwind keeps them.
const TONES: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  stone: "bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  rose: "bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
};

type Def = { Icon: LucideIcon; label: string; tone: Tone };

/** Every IconKey must appear here (the type enforces it). */
export const ICONS: Record<IconKey, Def> = {
  fridge: { Icon: Refrigerator, label: "Fridge", tone: "amber" },
  freezer: { Icon: Snowflake, label: "Freezer", tone: "cyan" },
  oven: { Icon: CookingPot, label: "Oven", tone: "amber" },
  hob: { Icon: Flame, label: "Hob / stove", tone: "amber" },
  microwave: { Icon: Microwave, label: "Microwave", tone: "amber" },
  dishwasher: { Icon: Utensils, label: "Dishwasher", tone: "amber" },
  coffee: { Icon: Coffee, label: "Coffee / kettle", tone: "amber" },
  smallkitchen: { Icon: Soup, label: "Kitchen helper", tone: "amber" },
  knives: { Icon: ChefHat, label: "Cookware & knives", tone: "amber" },
  washer: { Icon: WashingMachine, label: "Washing machine", tone: "sky" },
  dryer: { Icon: Wind, label: "Dryer", tone: "sky" },
  iron: { Icon: Shirt, label: "Iron", tone: "sky" },
  vacuum: { Icon: Wind, label: "Vacuum", tone: "teal" },
  robot: { Icon: Bot, label: "Robot helper", tone: "teal" },
  airpurifier: { Icon: Fan, label: "Air care", tone: "teal" },
  heating: { Icon: Flame, label: "Heating", tone: "orange" },
  cooling: { Icon: AirVent, label: "Cooling", tone: "cyan" },
  thermostat: { Icon: Thermometer, label: "Thermostat", tone: "cyan" },
  water: { Icon: Droplets, label: "Water", tone: "cyan" },
  shower: { Icon: ShowerHead, label: "Shower", tone: "cyan" },
  bath: { Icon: Bath, label: "Bath", tone: "cyan" },
  toilet: { Icon: Toilet, label: "Toilet", tone: "cyan" },
  light: { Icon: Lightbulb, label: "Light", tone: "amber" },
  lamp: { Icon: Lamp, label: "Lamp", tone: "amber" },
  camera: { Icon: Camera, label: "Camera", tone: "violet" },
  doorbell: { Icon: Bell, label: "Doorbell", tone: "violet" },
  lock: { Icon: Lock, label: "Lock", tone: "violet" },
  alarm: { Icon: Siren, label: "Alarm / detector", tone: "violet" },
  wifi: { Icon: Router, label: "Network", tone: "indigo" },
  solar: { Icon: Sun, label: "Solar", tone: "amber" },
  battery: { Icon: Battery, label: "Battery / power", tone: "indigo" },
  tv: { Icon: Tv, label: "TV", tone: "indigo" },
  speaker: { Icon: Speaker, label: "Speaker", tone: "indigo" },
  laptop: { Icon: Laptop, label: "Computer", tone: "indigo" },
  monitor: { Icon: Monitor, label: "Monitor", tone: "indigo" },
  phone: { Icon: Phone, label: "Phone", tone: "indigo" },
  tablet: { Icon: Tablet, label: "Tablet / reader", tone: "indigo" },
  printer: { Icon: Printer, label: "Printer", tone: "indigo" },
  headphones: { Icon: Headphones, label: "Headphones", tone: "indigo" },
  console: { Icon: Gamepad2, label: "Games", tone: "indigo" },
  watch: { Icon: Watch, label: "Watch", tone: "indigo" },
  drill: { Icon: Drill, label: "Power tool", tone: "stone" },
  hammer: { Icon: Hammer, label: "Hand tool", tone: "stone" },
  ladder: { Icon: Ruler, label: "Ladder", tone: "stone" },
  bike: { Icon: Bike, label: "Bike", tone: "orange" },
  car: { Icon: Car, label: "Car / vehicle", tone: "orange" },
  plant: { Icon: Sprout, label: "Plant", tone: "emerald" },
  tree: { Icon: TreeDeciduous, label: "Tree", tone: "emerald" },
  mower: { Icon: Leaf, label: "Lawn & hedge", tone: "emerald" },
  grill: { Icon: Flame, label: "Barbecue", tone: "orange" },
  dog: { Icon: Dog, label: "Dog", tone: "rose" },
  cat: { Icon: Cat, label: "Cat", tone: "rose" },
  fish: { Icon: Fish, label: "Fish", tone: "rose" },
  bird: { Icon: Bird, label: "Bird", tone: "rose" },
  paw: { Icon: PawPrint, label: "Pet", tone: "rose" },
  sofa: { Icon: Sofa, label: "Sofa", tone: "stone" },
  bed: { Icon: BedDouble, label: "Bed", tone: "stone" },
  chair: { Icon: Armchair, label: "Chair", tone: "stone" },
  storage: { Icon: Archive, label: "Storage", tone: "stone" },
  curtains: { Icon: Blinds, label: "Curtains & blinds", tone: "stone" },
  safe: { Icon: Vault, label: "Safe", tone: "stone" },
  appliance: { Icon: Plug, label: "Appliance", tone: "stone" },
  electronics: { Icon: CircuitBoard, label: "Electronics", tone: "indigo" },
  smarthome: { Icon: Wifi, label: "Smart home", tone: "violet" },
  furniture: { Icon: Armchair, label: "Furniture", tone: "stone" },
  tool: { Icon: Hammer, label: "Tool", tone: "stone" },
  garden: { Icon: Sprout, label: "Garden", tone: "emerald" },
  box: { Icon: Package, label: "Something else", tone: "stone" },
};

export const ICON_KEYS = Object.keys(ICONS) as IconKey[];
const isKnown = (k: string) => k in ICONS;

type Thing = { name: string; category?: string; brand?: string; model?: string; icon?: string };

export const iconFor = (item: Thing): IconDecision => decideIcon(item, isKnown);

/** The item's icon on a soft tinted tile. */
export function ItemIcon({ item, className, size = "md" }: { item: Thing; className?: string; size?: "sm" | "md" | "lg" }) {
  const { key } = iconFor(item);
  const { Icon, tone, label } = ICONS[key];
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "h-7 w-7 [&_svg]:size-4" : size === "lg" ? "h-11 w-11 [&_svg]:size-6" : "h-9 w-9 [&_svg]:size-[18px]",
        TONES[tone],
        className
      )}
    >
      <Icon strokeWidth={1.75} />
    </span>
  );
}

/** "Automatic" plus every icon; the automatic choice explains itself. */
export function IconPicker({ item, onChange }: { item: Thing; onChange: (key: string) => void }) {
  const auto = decideIcon({ ...item, icon: "" });
  const current = item.icon && isKnown(item.icon) ? item.icon : "";
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border border-input px-3 py-2 text-sm">
        <ItemIcon item={item} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{ICONS[iconFor(item).key].label}</div>
          <div className="truncate text-xs text-muted-foreground">
            {current ? "Picked by you" : `Chosen for you — ${auto.why}`}
          </div>
        </div>
        {current && (
          <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => onChange("")}>
            Choose for me
          </button>
        )}
        <button type="button" className="text-xs text-rose-600 underline-offset-4 hover:underline dark:text-rose-300" onClick={() => setOpen(!open)}>
          {open ? "Done" : "Pick a different icon"}
        </button>
      </div>
      {open && <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {ICON_KEYS.map((k) => {
          const { Icon, tone, label } = ICONS[k];
          return (
            <button
              key={k}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={current === k}
              onClick={() => onChange(k)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors [&_svg]:size-[18px]",
                current === k ? "border-rose-300 ring-2 ring-rose-200 dark:ring-rose-400/40" : "border-transparent hover:border-input",
                TONES[tone]
              )}
            >
              <Icon strokeWidth={1.75} />
            </button>
          );
        })}
      </div>}
    </div>
  );
}
