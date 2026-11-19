import { useState, type ReactNode } from "react";
import { HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { addInterval, today } from "@/lib/dates";
import type { Item, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Freq = { key: string; label: string; every: number; unit: Task["unit"] };

const FREQUENCIES: Freq[] = [
  { key: "weekly", label: "Weekly", every: 1, unit: "week" },
  { key: "monthly", label: "Monthly", every: 1, unit: "month" },
  { key: "quarterly", label: "Every 3 months", every: 3, unit: "month" },
  { key: "biannual", label: "Every 6 months", every: 6, unit: "month" },
  { key: "yearly", label: "Yearly", every: 12, unit: "month" },
];

/** Gentle starting points per kind of thing, each with the rhythm it usually likes. */
const SUGGESTIONS: Record<string, { label: string; freq: string }[]> = {
  Appliance: [
    { label: "Clean the filter", freq: "monthly" },
    { label: "Descale", freq: "quarterly" },
    { label: "Give it a deep clean", freq: "quarterly" },
    { label: "Check seals & hoses", freq: "yearly" },
  ],
  Electronics: [
    { label: "Dust it gently", freq: "monthly" },
    { label: "Update the software", freq: "quarterly" },
    { label: "Check cables & battery", freq: "biannual" },
  ],
  "Smart home": [
    { label: "Check the batteries", freq: "biannual" },
    { label: "Update the firmware", freq: "quarterly" },
    { label: "Wipe the sensors", freq: "quarterly" },
  ],
  Furniture: [
    { label: "Dust & polish", freq: "monthly" },
    { label: "Tighten the screws", freq: "yearly" },
    { label: "Oil the wood", freq: "biannual" },
  ],
  Tool: [
    { label: "Clean & oil", freq: "quarterly" },
    { label: "Sharpen", freq: "biannual" },
    { label: "Check for wear", freq: "yearly" },
  ],
  "Bike & vehicle": [
    { label: "Oil the chain", freq: "monthly" },
    { label: "Check tyre pressure", freq: "monthly" },
    { label: "Full service", freq: "yearly" },
  ],
  Garden: [
    { label: "Water", freq: "weekly" },
    { label: "Prune", freq: "biannual" },
    { label: "Feed & mulch", freq: "quarterly" },
  ],
  Pet: [
    { label: "Wash the bedding", freq: "weekly" },
    { label: "Groom", freq: "monthly" },
    { label: "Vet check-up", freq: "yearly" },
  ],
  Other: [
    { label: "Give it a clean", freq: "monthly" },
    { label: "Look it over", freq: "quarterly" },
    { label: "Check it still works", freq: "biannual" },
  ],
};

const TASK_CATEGORY: Record<string, string> = {
  Appliance: "Appliances",
  Electronics: "Appliances",
  "Smart home": "Appliances",
  Furniture: "Cleaning",
  Tool: "Bikes & tools",
  "Bike & vehicle": "Bikes & tools",
  Garden: "Garden",
  Pet: "Pets",
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200"
          : "border-input bg-background text-foreground/80 hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** A small, warm prompt: what does this need, how often, and a note to your future self. */
export function CareDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { state, saveTask } = useStore();
  const suggestions = SUGGESTIONS[item.category] ?? SUGGESTIONS.Other;

  const [kind, setKind] = useState("");
  const [freqKey, setFreqKey] = useState("monthly");
  const [freqTouched, setFreqTouched] = useState(false);
  const [custom, setCustom] = useState({ every: 2, unit: "month" as Task["unit"] });
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState<string | null>(null); // null = follow the rhythm

  const freq = freqKey === "custom" ? { every: custom.every, unit: custom.unit } : FREQUENCIES.find((f) => f.key === freqKey)!;
  const firstDue = due ?? addInterval(today(), freq.every, freq.unit);
  const room = state.rooms.find((r) => r.id === item.roomId);

  const pickSuggestion = (s: { label: string; freq: string }) => {
    setKind(s.label);
    if (!freqTouched) setFreqKey(s.freq);
  };

  const save = () => {
    saveTask({
      id: uid(),
      title: kind.trim(),
      every: freq.every,
      unit: freq.unit,
      dueDate: firstDue,
      itemId: item.id,
      roomId: item.roomId,
      category: TASK_CATEGORY[item.category] ?? "Other",
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/15">
            <HandHeart className="h-6 w-6" />
          </div>
          <DialogTitle>Care for {item.name}</DialogTitle>
          <DialogDescription>
            Small, regular attention keeps the things you love going{room ? ` — ${room.name}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Section label="What does it need?">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Chip key={s.label} active={kind === s.label} onClick={() => pickSuggestion(s)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <Input autoFocus value={kind} onChange={(e) => setKind(e.target.value)} placeholder="…or in your own words" />
          </Section>

          <Section label="How often?">
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <Chip key={f.key} active={freqKey === f.key} onClick={() => { setFreqKey(f.key); setFreqTouched(true); }}>
                  {f.label}
                </Chip>
              ))}
              <Chip active={freqKey === "custom"} onClick={() => { setFreqKey("custom"); setFreqTouched(true); }}>
                Custom
              </Chip>
            </div>
            {freqKey === "custom" && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Every</span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={custom.every}
                  onChange={(e) => setCustom({ ...custom, every: Math.max(1, Number(e.target.value) || 1) })}
                />
                <Select className="w-28" value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value as Task["unit"] })}>
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>First nudge on</span>
              <Input type="date" className="h-8 w-40" value={firstDue} onChange={(e) => setDue(e.target.value || null)} />
            </div>
          </Section>

          <Section label="A note to your future self">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Which cloth, which product, where it's kept…" />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Not now</Button>
          <Button disabled={!kind.trim() || !firstDue} onClick={save}>
            <HandHeart /> Add to my care routine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
