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
- Data model still says `Task`; the user-facing language is "care routine" / "care".

## Working style
The owner is going through the app page by page, describing changes per page. Do one page at a time.

**Git: work directly on `main`.** Commit and push straight to `main` (the owner's standing instruction): no feature branches,
no PRs. A push to `main` auto-deploys to Hetzner via GitHub Actions, so test locally (`npm run build`, run the server) before pushing.

## Stack / ops
See README.md (SQLite storage, REST + MCP API, Hetzner deploy via GitHub Actions on push to `main`).
