import { useEffect, useState } from "react";
import { BellOff, Sunset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockLabel, disable, enable, readState, sendTest, type PushState } from "@/lib/push";

/** The evening reminder: which rituals come round tomorrow, said once a day on this device. */
export function NotificationSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { readState().then(setState).catch(() => setState({ kind: "unsupported" })); }, []);

  const run = async (fn: () => Promise<PushState | void>, done?: string) => {
    setBusy(true); setMsg("");
    try {
      const next = await fn();
      if (next) setState(next);
      if (done) setMsg(done);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  };

  const at = state?.kind === "on" ? clockLabel(state.at) : "7:00 PM";

  return (
    <section className="space-y-2">
      <p className="font-medium">Evening reminder</p>
      {!state && <p className="text-muted-foreground">Checking…</p>}

      {state?.kind === "off" && (
        <>
          <p className="text-muted-foreground">Every evening at {at}, AHAM quietly tells you which rituals come round tomorrow.</p>
          <Button variant="outline" disabled={busy} onClick={() => run(enable)}><Sunset /> Turn on the evening reminder</Button>
        </>
      )}

      {state?.kind === "on" && (
        <>
          <p className="text-muted-foreground">On. Every evening at {at}, this device hears about tomorrow's rituals. Nothing is sent on days when nothing comes round.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(async () => { await sendTest(); }, "A test is on its way.")}>Send me a test</Button>
            <Button variant="ghost" disabled={busy} onClick={() => run(async () => { await disable(); return { kind: "off" } as PushState; })}><BellOff /> Turn off</Button>
          </div>
        </>
      )}

      {state?.kind === "blocked" && (
        <p className="text-muted-foreground">Notifications are blocked for AHAM in this browser. Allow them in the browser's site settings, then come back and turn the reminder on.</p>
      )}
      {state?.kind === "needs-install" && (
        <p className="text-muted-foreground">On iPhone, reminders work from the Home Screen. Tap Share, then Add to Home Screen, and open AHAM from there.</p>
      )}
      {state?.kind === "unsupported" && <p className="text-muted-foreground">This browser can't show reminders.</p>}

      {msg && <p className="text-muted-foreground">{msg}</p>}
    </section>
  );
}
