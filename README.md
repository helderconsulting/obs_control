# obs_control

## Getting Started

### Prerequisites

- **OBS Studio ≥ 28** — the built-in WebSocket server (obs-websocket v5) is required. Download from [obsproject.com](https://obsproject.com).

### Option A — Docker

The entire stack (OBS headless + Hono server + SvelteKit UI) runs in three containers. No local OBS installation needed.

**Requirements:** Docker Desktop or Docker Engine with Compose v2.

```bash
docker compose up -d --build

open http://localhost
```

To follow logs: `docker compose logs -f`  
To stop: `docker compose down`

OBS scenes and the recordings database persist in named Docker volumes across restarts. To reset them: `docker compose down -v`

> **WebSocket auth:** Authentication is disabled by default in `docker/obs-config/global.ini`, so no password is needed out of the box. To enable it: set `AuthRequired=true` and `ServerPassword` in `global.ini`, set the same value as `OBS_WEBSOCKET_PASSWORD` in `.env`, then rebuild: `docker compose up -d --build obs`.

---

### Option B — Local development

**Requirements:** Node.js ≥ 22.5, OBS Studio ≥ 28 installed locally.

**1. Configure OBS WebSocket**

In OBS: `Tools → WebSocket Server Settings`
- Enable the WebSocket server
- Note the port (default `4455`) and password if set

**2. Install dependencies**

```bash
npm install
```

**3. Configure the server**

Create a `.env` file in the project root:

```env
LOG_LEVEL=debug
OBS_WEBSOCKET_URL=ws://192.168.0.205:4455
# OBS_WEBSOCKET_PASSWORD=your_password_here  # only needed if auth is enabled in OBS
```

**4. Start OBS**, then in two separate terminals:

```bash
# Terminal 1 — Hono server (auto-restarts on file changes)
npm run dev:server

# Terminal 2 — SvelteKit client (Vite dev server with HMR)
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173).

The Vite dev server proxies `/obs`, `/recording`, `/health`, and `/ws` to the Hono server automatically — no extra config needed.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `OBS_WEBSOCKET_URL` | `ws://127.0.0.1:4455` | WebSocket URL of the OBS instance |
| `OBS_WEBSOCKET_PASSWORD` | _(none)_ | Password if OBS auth is enabled |
| `PORT` | `3000` | Port the Hono server listens on |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
