# MAHA — Master your Aham

Digital-twin-style home maintenance tracker: recurring tasks, purchase/model inventory, and a spatial house view.
Stack: Vite + React + TypeScript + Tailwind + shadcn/ui (hand-written components in `src/components/ui`), Express server with SQLite persistence (built-in `node:sqlite`, Node >= 22.13).

## Run
    npm install
    npm run build && PORT=3000 npm start        # UI + API on :3000
    # or dev: `npm start` in one terminal, `npm run dev` in another (Vite proxies /api)

## Env
- `PORT` (default 3000), `DATA_DIR` (default ./data — `maha.db` and `backups/` live here; **mount a persistent volume on it**)
- `HOME_OS_PASSWORD` optional; enables HTTP Basic (any username) + `?token=` on the calendar feed
- `EPHEMERAL_STORAGE=1` shows the "storage not durable" banner (only for hosts without a volume)

## Storage
SQLite (WAL) with real tables: `rooms`, `items`, `tasks`, `task_history`, `floors`, `audit_log`. Foreign keys are enforced
(deleting a room/item nulls the references on items/tasks). Every write is validated server-side and recorded in `audit_log`
(`GET /api/audit`), with the actor taken from the `X-Actor` header (default `ui`) so agent writes are distinguishable.
A consistent backup is written to `DATA_DIR/backups/maha-YYYY-MM-DD.db` on start and daily (last 7 kept).
On first start an existing `state.json` is imported and renamed to `state.json.migrated`.

## API
- `GET /api/state`, `PUT /api/state` (bulk replace: import / reset)
- `PUT|DELETE /api/{rooms,items,tasks}/:id`, `POST /api/tasks/:id/complete` (`{date?}`), `POST /api/floors` (`{name}`)
- `GET /api/audit?limit=`

## Deploy (Hetzner, Docker)
    docker build -t maha .
    docker run -d --name maha -p 3000:3000 -v maha-data:/app/data -e HOME_OS_PASSWORD=... maha
Back up by copying `backups/*.db` (or the named volume) off the box.

## Ideas / next
- Agent tools (in-app chat and/or MCP server) on top of the REST API
- Platform auth instead of the shared password
- Push notifications (calendar feed .ics is the stand-in today)
