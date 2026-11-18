# MAHA — Master your Aham

Digital-twin-style home maintenance tracker: recurring tasks, purchase/model inventory, and a spatial house view.
Stack: Vite + React + TypeScript + Tailwind + shadcn/ui (hand-written components in `src/components/ui`), Express server with JSON-file persistence.

## Run
    npm install
    npm run build && PORT=3000 npm start        # UI + API on :3000
    # or dev: `npm start` in one terminal, `npm run dev` in another (Vite proxies /api)

## Env
- `PORT` (default 3000), `DATA_DIR` (default ./data — state.json lives here)
- `HOME_OS_PASSWORD` optional; enables HTTP Basic (any username) + `?token=` on the calendar feed
- `EPHEMERAL_STORAGE=1` shows the "storage not durable" banner (set on EY430)

## Deploy to EY430
`deploy_app` with name `maha`, port 3000, all source files incl. Dockerfile. EY430 has no persistent volume: redeploy wipes data (use Data -> Export JSON first).

## Ideas / next
- Persistent storage once EY430 offers a volume/DB
- Platform auth instead of the shared password
- Push notifications (calendar feed .ics is the stand-in today)
