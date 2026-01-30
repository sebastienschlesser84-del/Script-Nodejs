# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains two broadcast production control applications:

- **PlayLink Manager** (`playlink-manager/`) — Lightweight rundown/playout controller integrated with the Superconductor system
- **PlayLink Studio** (`playlink-studio/`) — Full-featured production suite with CasparCG playout and FTP media ingestion

Both are broadcast-domain tools for controlling live video playout, graphics, and media.

## Commands

### PlayLink Manager & PlayLink Studio Frontend

```bash
# From playlink-manager/ or playlink-studio/frontend/
npm run dev        # Vite dev server (port 5173, listens on all interfaces)
npm run build      # Production build to dist/
npm run lint       # ESLint (flat config, ESLint 9+)
npm run preview    # Preview production build
```

### PlayLink Studio Backend

```bash
# From playlink-studio/Backend/
node server.js     # Start Express server on port 3000
```

No test framework is configured in either project.

## Architecture

### Frontend Pattern

Both frontends are React 19 + Vite 7 SPAs using a **monolithic single-component architecture** — each app lives entirely in one `App.jsx` file (576 lines for Manager, 1534 lines for Studio). All state, handlers, and UI are colocated in that file.

Styling uses Tailwind CSS 3 with a custom broadcast dark theme (`broadcast.dark: #0f1115`, `broadcast.panel: #161920`). Icons come from `lucide-react`.

### PlayLink Manager

- Connects to **Superconductor** API at `127.0.0.1:5500`
- Vite proxy (`/api/*` → Superconductor) handles CORS in dev
- Has a mock/simulation mode for offline development
- Manages rundown items with PVW (preview) / PGM (program) workflow and on-air timers

### PlayLink Studio

- **Frontend** talks to the local Express backend at `localhost:3000`
- **Backend** (`server.js`, 216 lines) is a gateway that bridges HTTP REST calls to:
  - **CasparCG** via TCP/AMCP protocol on `127.0.0.1:5250` (auto-reconnects every 5s)
  - **FTP server** at `192.168.1.100` for media file discovery (filters by today's date)
- Backend API: `/health`, `/caspar/files`, `/caspar/templates`, `/ftp/sync`, `/caspar/load`, `/caspar/play`, `/caspar/pause`, `/caspar/clear`, `/caspar/cg-add`, `/caspar/cg-stop`
- Frontend polls `/health` every 3 seconds for connection status

### Key Conventions

- JavaScript only (no TypeScript despite `@types/*` in devDeps)
- ESLint allows unused variables prefixed with uppercase or underscore
- No component library — all UI built with Tailwind utilities
- State managed via React hooks (useState, useEffect, useCallback, useRef) — no external state library
