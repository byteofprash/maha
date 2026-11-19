import { useEffect, useState } from "react";
import { Cloud, CloudOff, Database, Flower2, Home, LayoutDashboard, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataDialog } from "@/components/dialogs";
import Today from "@/views/Today";
import Rituals from "@/views/Rituals";
import { Logo } from "@/components/logo";
import Inventory from "@/views/Inventory";
import House from "@/views/House";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "dashboard", label: "Today", icon: LayoutDashboard },
  { id: "tasks", label: "Rituals", icon: Flower2 },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "house", label: "House", icon: Home },
] as const;
type View = (typeof NAV)[number]["id"];

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [data, setData] = useState(false);
  const [cfg, setCfg] = useState({ feedPath: "/api/tasks.ics", ephemeral: false });
  const [hideWarn, setHideWarn] = useState(false);
  const { status } = useStore();

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="ml-2 hidden gap-1 sm:flex">
            {NAV.map(({ id, label, icon: Icon }) => (
              <Button key={id} variant={view === id ? "secondary" : "ghost"} size="sm" onClick={() => setView(id)}>
                <Icon /> {label}
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {status === "saving" || status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "error" ? <CloudOff className="h-3.5 w-3.5 text-destructive" /> : <Cloud className="h-3.5 w-3.5" />}
              {status === "error" ? "Not saved" : status === "saved" ? "Saved" : "Saving…"}
            </span>
            <Button size="sm" variant="outline" onClick={() => setData(true)}><Database /> Data</Button>
          </div>
        </div>
      </header>

      {cfg.ephemeral && !hideWarn && (
        <div className="border-b bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-xs">
            <span className="flex-1">Storage on this host is not durable: redeploying the app wipes your data. Export a backup from <b>Data</b> after big changes.</span>
            <button className="underline" onClick={() => setData(true)}>Back up</button>
            <button aria-label="Dismiss" onClick={() => setHideWarn(true)}>✕</button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:pb-6">
        {view === "dashboard" && <Today />}
        {view === "tasks" && <Rituals />}
        {view === "inventory" && <Inventory />}
        {view === "house" && <House />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background sm:hidden">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", view === id ? "text-foreground" : "text-muted-foreground")}>
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </nav>

      {data && <DataDialog feedPath={cfg.feedPath} onClose={() => setData(false)} />}
    </div>
  );
}
