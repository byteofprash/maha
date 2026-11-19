# MAHA — Master your Aham

Digital-twin-style home maintenance tracker: recurring tasks, purchase/model inventory, and a spatial house view.
Stack: Vite + React + TypeScript + Tailwind + shadcn/ui (hand-written components in `src/components/ui`), Express server with SQLite persistence (built-in `node:sqlite`, Node >= 22.13).

## Run
    npm install
    npm run build && PORT=3000 npm start        # UI + API on :3000
    # or dev: `npm start` in one terminal, `npm run dev` in another (Vite proxies /api)

## Env
- `PORT` (default 3000), `DATA_DIR` (default ./data — `maha.db` and `backups/` live here; **mount a persistent volume on it**)
- `MAHA_PASSWORD` optional (old name `HOME_OS_PASSWORD` still works); enables HTTP Basic (any username) + `?token=` on the calendar feed
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

## MCP server (agent access)
Streamable HTTP, stateless, at `POST /mcp` on the same port. It uses the same auth as the app: with `MAHA_PASSWORD` set, send
`Authorization: Bearer <password>` (Basic also works). All writes are audited with actor `agent`.

Tools: `get_overview`, `search_items`, `get_item`, `search_tasks` (read); `add_item`, `update_item`, `add_task`, `update_task`,
`complete_task` (write); `delete_item`, `delete_task` (require `confirm: true`; the tool descriptions tell the model to ask you first).
Rooms are referenced by name. Room layout (add/move rooms, floors) is intentionally UI-only for now.

Connect from Claude Code (once the app is reachable over HTTPS):

    claude mcp add --transport http maha https://maha.example.com/mcp --header "Authorization: Bearer <password>"

For claude.ai custom connectors, which expect OAuth rather than a static token, see "Ideas / next".

## Deploy (Hetzner: Traefik + Cloudflare Tunnel)
Served at `https://maha.byteofprash.com` (change the Host rule in `docker-compose.yml` for another subdomain). On the server:

    git clone <repo> ~/maha && cd ~/maha
    echo 'MAHA_PASSWORD=<choose one>' > .env      # needed for the MCP endpoint and the calendar feed token
    docker compose up -d --build

Then in Cloudflare Zero Trust: add a tunnel route `maha` / `byteofprash.com` -> HTTP `traefik:80`, and an Access application
for `maha.byteofprash.com` with an Allow policy for your email. Verify with `docker logs traefik` (router `maha@docker`).

Access will also gate `/mcp` and `/api/tasks.ics`, which non-browser clients can't pass. Add a second Access application for
path `maha.byteofprash.com/mcp` (and `/api/tasks.ics`) with a Bypass policy; those paths are protected by `MAHA_PASSWORD` instead.

Update: `git pull && docker compose up -d --build`. The data lives in the `maha-data` volume; copy `backups/*.db` off the box.

## Ideas / next
- OAuth for the MCP endpoint (needed for claude.ai custom connectors); in-app chat panel on the same tools
- Platform auth instead of the shared password
- Push notifications (calendar feed .ics is the stand-in today)
