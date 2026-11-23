<p align="center"><img src="public/logo.svg" alt="AHAM logo" width="120" /></p>

# AHAM — The quiet art of tending

A home-care tracker built around caring for the things you live with: **rituals** (recurring acts of care, each with a plant that
thrives while you tend to it), a purchase/model inventory grouped by room, and a spatial house view (a simple 5-wide by 10-long plan).
Stack: Vite + React + TypeScript + Tailwind + shadcn/ui (hand-written components in `src/components/ui`), Express server with SQLite persistence (built-in `node:sqlite`, Node >= 22.13).

## Run
    npm install
    npm run build && PORT=3000 npm start        # UI + API on :3000
    # or dev: `npm start` in one terminal, `npm run dev` in another (Vite proxies /api)

## Env
- `PORT` (default 3000), `DATA_DIR` (default ./data — `maha.db` and `backups/` live here; **point it at a persistent disk**)
- `MAHA_PASSWORD` optional (old name `HOME_OS_PASSWORD` still works); enables HTTP Basic (any username) + `?token=` on the calendar feed
- `EPHEMERAL_STORAGE=1` shows the "storage not durable" banner (only for hosts without a volume)

## Storage
SQLite (WAL) with real tables: `rooms`, `items`, `tasks`, `task_history`, `completions`, `floors`, `audit_log`. Foreign keys are enforced
(deleting a room/item nulls the references on items/tasks). Every write is validated server-side and recorded in `audit_log`
(`GET /api/audit`), with the actor taken from the `X-Actor` header (default `ui`) so agent writes are distinguishable.
A consistent backup is written to `DATA_DIR/backups/maha-YYYY-MM-DD.db` on start and daily (last 7 kept).
On first start an existing `state.json` is imported and renamed to `state.json.migrated`.

## API
- `GET /api/state`, `PUT /api/state` (bulk replace: import / reset)
- `PUT|DELETE /api/{rooms,items,tasks}/:id`, `POST /api/tasks/:id/complete` (`{date?}`), `POST /api/floors` (`{name}`)
- `GET /api/completions?room=&task=&since=&limit=` (the permanent log of everything tended to, newest first)
- `GET /api/audit?limit=`

## MCP server (agent access)
Streamable HTTP, stateless, at `POST /mcp` on the same port. It uses the same auth as the app: with `MAHA_PASSWORD` set, send
`Authorization: Bearer <password>` (Basic also works), **or `X-API-Key: <password>`** (no "Bearer" prefix) for connector screens that reserve
the `Authorization` header for their own sign-in. All writes are audited with actor `agent`.

Tools: `get_overview`, `search_items`, `get_item`, `search_tasks`, `list_completions` (read); `add_item`, `update_item`, `add_task`, `update_task`,
`complete_task` (write); `delete_item`, `delete_task` (require `confirm: true`; the tool descriptions tell the model to ask you first).
Rooms are referenced by name. Room layout (add/move rooms, floors) is intentionally UI-only for now.

Connect from Claude Code (once the app is reachable over HTTPS):

    claude mcp add --transport http aham https://<your-domain>/mcp --header "Authorization: Bearer <password>"

For claude.ai custom connectors, which expect OAuth rather than a static token, see "Ideas / next".

## Deploy (Hetzner: Traefik + Cloudflare Tunnel)
Served at `https://aham.byteofprash.com`. The Host rule in `docker-compose.yml` also still answers the old `maha.byteofprash.com`; delete that
half of the rule (and its Cloudflare route and Access app) once you no longer need it. On the server:

Normally the Action does this (see below). By hand, once:

    git clone <repo> ~/maha && cd ~/maha
    echo 'MAHA_PASSWORD=<choose one>' > .env      # needed for the MCP endpoint and the calendar feed token
    docker compose up -d --build

Then in Cloudflare Zero Trust: add a tunnel route `aham` / `byteofprash.com` -> HTTP `traefik:80`, and an Access application
for `aham.byteofprash.com` with an Allow policy for your email. Verify with `docker logs traefik` (router `maha@docker`, a name only Traefik sees).

Access will also gate `/mcp` and `/api/tasks.ics`, which non-browser clients can't pass. Add a second Access application for
path `aham.byteofprash.com/mcp` (and `/api/tasks.ics`) with a Bypass policy; those paths are protected by `MAHA_PASSWORD` instead.

## Where the data lives (Hetzner volume)
`maha.db` and `backups/` live in the folder named by `MAHA_DATA_DIR` in `~/maha/.env` on the server, bind-mounted at `/app/data`.
Create the folder on the attached volume and set it once:

    sudo mkdir -p /mnt/HC_Volume_<id>/maha
    echo 'MAHA_DATA_DIR=/mnt/HC_Volume_<id>/maha' >> ~/maha/.env

Compose refuses to start if the variable is unset or the folder is missing (volume not mounted).

## Auto-deploy (GitHub Actions)
`.github/workflows/deploy.yml` runs on every push to `main` (and by hand from the Actions tab): typecheck + build, rsync the code to
`~/maha` on the server over SSH, write `.env` from secrets, `docker compose up -d --build`, then wait for `/api/health`.
Add these repo secrets (Settings > Secrets and variables > Actions). The app's own password is *not* a GitHub secret: the first
deploy generates `~/maha/.env` on the server (`cat ~/maha/.env` to read `MAHA_PASSWORD`, which is also the MCP bearer token).

| Secret | Value |
|---|---|
| `HETZNER_HOST`, `HETZNER_USER`, optional `HETZNER_PORT` | same as the ey430 repo |
| `HETZNER_SSH_KEY`, optional `HETZNER_SSH_PASSPHRASE` | dedicated deploy private key; its public half is in the server's `~/.ssh/authorized_keys` |

Requires SSH to be reachable from GitHub runners. The data lives on the Hetzner volume at `MAHA_DATA_DIR` (see below) and is never touched by a deploy;
copy `backups/*.db` off the box.

## Naming
The app is **AHAM** (Sanskrit *aham*, "I", the self). It was called MAHA; user-facing text now says AHAM, but the **deployment identifiers
are still `maha` on purpose** (GitHub repo, server folder `~/maha`, container / image / compose service / Traefik router, the host
`maha.byteofprash.com` (still answered alongside the new `aham.byteofprash.com`), `MAHA_PASSWORD`, `MAHA_DATA_DIR`, `maha.db`), because renaming them needs steps outside the repo. Renaming the
deployment, in this order, so nothing breaks:
1. Cloudflare: add the tunnel route and Access application for the new host (and the `/mcp`, `/api/tasks.ics` bypass).
2. Server: stop the app, `mv ~/maha ~/aham`, move the data folder on the volume if you want it renamed, update `~/aham/.env`.
3. Repo: rename it on GitHub, then change `APP`, the compose service/container/image/router names and the Host rule to `aham`.
4. Env vars: accept `AHAM_PASSWORD` / `AHAM_DATA_DIR` next to the old names first, switch the server `.env`, then drop the old names.
Never rename these piecemeal: the compose file refuses to start without `MAHA_DATA_DIR`.

## Ideas / next
- OAuth for the MCP endpoint (needed for claude.ai custom connectors); in-app chat panel on the same tools
- Platform auth instead of the shared password
- Push notifications (calendar feed .ics is the stand-in today)
