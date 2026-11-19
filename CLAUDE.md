# MAHA — project notes for Claude

## The soul of the project (remember this in every design decision)
MAHA ("Master your Aham") is not a maintenance system, it is a place where **taking care of the things in your home feels
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
- Logic checks: `npm run check` (icon rules + `scripts/check-rituals.ts`), also run by the deploy workflow.

## Small decision models
Small, repeatable judgements (like "which icon for this product?") are **deterministic rule tables with an explanation and a
manual override**, not ad-hoc code or an LLM call: fast, free, testable, and the UI can say why it chose.
- Item icons: `src/lib/item-icon-rules.ts` (pure; order = override > name > brand/model > category > default; most specific rule
  first) and `src/lib/item-icons.tsx` (icon + soft tone registry, `ItemIcon`, `IconPicker`). `Item.icon` = "" means automatic.
- When a product is misjudged, fix the rule and add the case to `scripts/check-icons.ts` (`npm run check:icons`, also run by the
  deploy workflow), don't special-case the item.

## Working style
The owner is going through the app page by page, describing changes per page. Do one page at a time.

**Git: work directly on `main`.** Commit and push straight to `main` (the owner's standing instruction): no feature branches,
no PRs. A push to `main` auto-deploys to Hetzner via GitHub Actions, so test locally (`npm run build`, run the server) before pushing.

## Stack / ops
See README.md (SQLite storage, REST + MCP API, Hetzner deploy via GitHub Actions on push to `main`).
