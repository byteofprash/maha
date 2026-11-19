# AHAM — project notes for Claude

## The soul of the project (remember this in every design decision)
AHAM (Sanskrit *aham*, "I", the self; tagline "The quiet art of tending") is not a maintenance system, it is a place where **taking care of the things in your home feels
therapeutic**. Looking after things is an act of care, not a chore list.

- Icons: soulful, not mechanical. Prefer hands, hearts, leaves, sprouts, light (e.g. lucide `HandHeart`, `Sprout`, `Leaf`)
  over wrenches, gears and tools. The "add care" button on an item is `HandHeart` in a soft rose tone.
- Words: warm and human. "Care for the kettle", "Tend to this", "A note to your future self", "Not now" — not
  "Create maintenance ticket".
- Prompts are small and gentle: suggestions as chips first, free text second, sensible defaults, no walls of fields.
- Colour: soft, calm accents (rose for care); avoid alarm-red unless something is truly overdue.
- Language: a recurring act of care is a **ritual** (never "task", "chore" or "overdue"). Completing one is **"Tended to it"**. A late
  one is "Waiting for you · 3 days". The data model, API and MCP tool names still say `Task` (kept stable); only the wording changed.

## Rituals and their plants
Every ritual grows its own flowering plant (`Task.plant`, 6 species in `src/lib/plants.ts`: daisy, tulip, sunflower, lavender,
cosmos, succulent). New rituals get the least-used species (random among ties) so neighbours never look alike; the server does the
same for rituals created by the MCP agent. The ritual dialog can shuffle it.
- How alive it looks = `vitality()` in `src/lib/dates.ts`: 1 just tended, 0 on the due day, floored at -0.4 (never "dead", the
  worst state is "Waiting for you"). Stages: thriving > content > thirsty > waiting. Colour drains, leaves sag, the stem bends and
  the flower bows and closes. Drawn in `src/components/plant.tsx` (SVG + CSS, no libraries, respects reduced-motion).
- "Tended to it" waters the plant (droplets + glow) and the tile keeps its place for ~2.5s before moving to a calmer section.
- **Today page** (`src/views/Today.tsx`) is deliberately minimal: a greeting, "Today" (due today *plus anything already waiting*) and
  "Later this week" (tomorrow up to Sunday; weeks run Mon-Sun, so on Sunday there is no "later"). Same `RitualTile` cards as Rituals.
  No stats, warranties or counters there. Window logic is `src/lib/today.ts` (tested). Tending uses the shared `useTend()` hook.
- **Tapping a ritual card never opens an editor**: it opens a read-only **details view** (`src/components/ritual-details.tsx`: the plant and
  its mood, next care, last tended, rhythm, kind, what it looks after, where, the note, recent history, with **Tended to it** and **Edit**).
  The edit form (`TaskDialog`) opens only from Edit, and saving returns to the details. One `RitualDetailsProvider` (in `main.tsx`) serves
  every card on every page via `useRitualDetails().open(id)`; cards take no `onEdit`. Wording lives in `src/lib/ritual-facts.ts` (tested).
- Rituals page uses the compact tile (about a quarter of the full tile's area); Today and House use the full tile.
- Logic checks: `npm run check` (icon rules + `scripts/check-rituals.ts`), also run by the deploy workflow.

## The tended log
Every "Tended to it" is written to a permanent `completions` table (the ritual's name plus the item and room *as they were at that moment*,
the ritual's note at that moment, the day it was tended, and an exact timestamp). It has no foreign keys on purpose: entries must still read correctly after a ritual, item
or room is renamed or deleted. `task_history` is only the capped (30) per-ritual view used by the cards. The log is part of `State`
(newest first, latest 5000; `GET /api/completions` filters the rest), so export/import carry it; an older backup without it is rebuilt from
each ritual's history, as is an existing database the first time it starts (dates only, no time). "Reset to sample data" clears it.
It is the **first thing on the House page** (`src/components/tended-list.tsx`) and deliberately plain: one line per entry, newest first, the
ritual's name on the left and "Thu, Nov 19 · 4:28 PM" on the right, **no icons or plants**. Tapping a line expands it: the ritual's note
(its current note if the ritual still exists, otherwise the one saved with the entry), item, room, rhythm, how many times it has been tended,
and "Open this ritual". It is not tied to a room: it always shows the whole house. Display logic is `src/lib/completions.ts` (tested).
The MCP agent reads the log with `list_completions`.

## House page
The House page order is: the tended list, then **Rooms**. Rooms are always available as plain buttons (a room's items and rituals open under them),
whether or not the plan is shown. **The plan (the map) is optional**: a "Show the plan" / "Hide the plan" toggle, remembered in the browser
(`aham.house.plan`), **hidden by default**; Edit layout and + Room only exist while it is shown. The plan is a simple grid, **5 tiles wide and 10 long** (a narrow house): `GRID` in `src/lib/types.ts` and `server/layout.mjs` (keep in
sync). Rooms can't leave it: the UI clamps drags, the API rejects out-of-bounds rooms, and anything imported or already stored
off the plan is re-fitted (`fitAll`, reading order, shrinking only as needed; once on startup with a safety copy at
`backups/pre-layout-refit.db`, and on `PUT /api/state`). Selected-room details reuse `ItemIcon` and `RitualTile`. Checks: `npm run check:layout`.

## Small decision models
Small, repeatable judgements (like "which icon for this product?") are **deterministic rule tables with an explanation and a
manual override**, not ad-hoc code or an LLM call: fast, free, testable, and the UI can say why it chose.
- Item icons: `src/lib/item-icon-rules.ts` (pure; order = override > name > brand/model > category > default; most specific rule
  first) and `src/lib/item-icons.tsx` (icon + soft tone registry, `ItemIcon`, `IconPicker`). `Item.icon` = "" means automatic.
- When a product is misjudged, fix the rule and add the case to `scripts/check-icons.ts` (`npm run check:icons`, also run by the
  deploy workflow), don't special-case the item.

## Logo
A lotus mandala (8 outer + 8 inner rose petals) with a gold **bindu**, the still point, at its heart: the ritual flower. Dotted sage halo on
the full version only. `src/components/logo.tsx` (`LogoMark` full/small, `Logo` = mark + wordmark for the header); static files in `public/`
(`logo.svg` full, `favicon.svg` small, PNGs for tab/iOS/192/512). Alternative concepts (incl. the drop-of-water centre) are in `design/logo/`.
Use the small variant at <= 48px (the halo turns to fuzz). Palette: rose #ffc2d1 > #f4789b, deep rose #e5557f, gold #ffe08a > #f2a93b, sage #86bf8f.

## Naming
The app is **AHAM**, renamed from MAHA. All user-facing text says AHAM. The **deployment identifiers are still `maha` on purpose**: GitHub
repo, server folder `~/maha` (workflow `APP`), container / image / compose service / Traefik router, host: the app is served at **`aham.byteofprash.com`**, and the Traefik rule still also answers the old
`maha.byteofprash.com` until the owner retires it (Cloudflare tunnel + Access are per host), env vars `MAHA_PASSWORD` / `MAHA_DATA_DIR`, `maha.db`, `maha-*.db` backups. Renaming them needs steps
outside the repo, and a half-rename breaks the deploy (compose requires `MAHA_DATA_DIR`). Don't touch them piecemeal: when the owner asks,
follow the checklist in README ("Naming").

## Working style
The owner is going through the app page by page, describing changes per page. Do one page at a time.

**Git: work directly on `main`.** Commit and push straight to `main` (the owner's standing instruction): no feature branches,
no PRs. A push to `main` auto-deploys to Hetzner via GitHub Actions, so test locally (`npm run build`, run the server) before pushing.

## Stack / ops
See README.md (SQLite storage, REST + MCP API, Hetzner deploy via GitHub Actions on push to `main`).
