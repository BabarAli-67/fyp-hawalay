# Hawalay

**AI-powered lost & found platform** — report lost or found items, get smart matches, chat with finders, and recover belongings faster.

Final Year Project (FYP) monorepo: React PWA frontend, Express API, FastAPI AI sidecar, MongoDB + GridFS.

---

## Features

### Core platform
- **Authentication** — email/password with OTP verification, Google OAuth, password reset
- **Dashboard** — manage your reported items and status (lost / found / resolved)
- **Multi-step report wizard** — report type, item details, location & contact, review & submit
- **Browse feed** — filter and explore community reports
- **Item details** — full report view with map and images (GridFS)

### AI & matching
- **Unified image analyze** — OCR (EasyOCR + optional YOLO regions), Gemini caption, embeddings
- **AI-assisted form fill** — category, description, and distinctive features from uploaded photos
- **Smart matching** — embedding similarity + geo/date filters; match results per item
- **Background matching** — triggered automatically after report submission

### Real-time & social
- **In-app notifications** — match alerts and system events with unread counts
- **Real-time chat** — Socket.io messaging between matched users, typing indicators, read receipts
- **Chat inbox** — room list with peer info and avatars

### Profile & media
- **Profile management** — edit name/email, bio, avatar upload (GridFS), change password
- **Authenticated avatars** — secure blob loading for profile and chat peer images

### Progressive Web App (PWA)
- **Installable** — web manifest, service worker, global install button in navbar
- **Offline report queue** — submit reports offline; IndexedDB queue synced by service worker
- **Offline hub** — `/offline` page for queue status, retry, and sync progress

### Maps & UX
- **OpenStreetMap + Leaflet** — no Google Maps billing; location picker on report flow
- **Mobile-first UI** — Tailwind design system, bottom navigation, responsive layouts
- **Rate limiting & image caching** — API protection and deduplicated item thumbnail loads

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React PWA (Vite)          client/          :5173 / Vercel      │
│  Service worker · IndexedDB offline queue · Socket.io client    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│  Express API               server/          :5000 / Render      │
│  Auth · Items · Matches · Chat · Notifications · Users          │
│  GridFS images · JWT · Socket.io server                         │
└────────────┬───────────────────────────────┬────────────────────┘
             │ HTTP (internal)               │
┌────────────▼──────────────┐    ┌───────────▼────────────────────┐
│  FastAPI AI server         │    │  MongoDB Atlas + GridFS       │
│  ai-server/       :8000    │    │  Users · Items · Matches ·    │
│  OCR · Gemini · Matching   │    │  Messages · Notifications     │
└────────────────────────────┘    └───────────────────────────────┘
```

| Layer | Directory | Role |
|-------|-----------|------|
| Frontend | `client/` | React 18 SPA, PWA, Tailwind |
| API | `server/` | Express 4, Mongoose, Socket.io |
| AI | `ai-server/` | FastAPI — OCR, caption, embeddings, matching |
| Models (local) | `OCR_Model/` | YOLO training repo (gitignored; optional weights path) |

---

## Tech stack

| Area | Technologies |
|------|----------------|
| Frontend | React 18, Vite 6, React Router 6, Tailwind CSS, Framer Motion, Leaflet |
| Backend | Node.js, Express 4, Mongoose 8, Socket.io, JWT, Multer, GridFS |
| AI | Python 3, FastAPI, EasyOCR, YOLO (Ultralytics), Google Gemini |
| Database | MongoDB Atlas |
| Auth | bcrypt, email OTP, Google OAuth |
| Deploy | Vercel (client), Render/similar (API + AI server) |

---

## Project structure

```
fyp-hawalay/
├── client/                 # React PWA
│   ├── public/             # sw.js, manifest.webmanifest, icons
│   └── src/
│       ├── api/            # axios service modules
│       ├── components/     # UI, chat, PWA, report steps, layout
│       ├── context/        # Auth, PWA install
│       ├── hooks/
│       ├── pages/          # Route screens
│       ├── socket/         # Socket.io client
│       └── utils/          # offline sync, OCR normalize, image cache
├── server/                 # Express REST + Socket.io
│   ├── controllers/
│   ├── models/             # User, Item, Match, Message, Notification
│   ├── routes/
│   ├── services/           # matching, AI client, email, OTP
│   └── utils/
├── ai-server/              # FastAPI microservice
│   ├── routers/            # ocr, blip, clip, matching, ai
│   ├── services/
│   ├── core/               # pipeline, YOLO, Gemini client
│   └── artifacts/          # model config (.gitkeep; .pt gitignored)
├── OCR_Model/              # Local YOLO training (gitignored)
├── Flow0-1.md              # MERN learning handbook
├── package.json            # npm workspaces root
└── vercel.json             # Client deploy config
```

---

## Prerequisites

- **Node.js** 18+ (20.x recommended — see `.nvmrc`)
- **npm** 9+
- **MongoDB** — Atlas cluster or local instance
- **Python** 3.10+ (for `ai-server/`)
- **Google Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey)
- *(Optional)* YOLO `best.pt` weights for card/CNIC region OCR

---

## Quick start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd fyp-hawalay
npm install
```

### 2. Environment files

Copy each example and fill in real values:

| Service | Template | Output |
|---------|----------|--------|
| API | `server/.env.example` | `server/.env` |
| Client | `client/.env.example` | `client/.env` |
| AI | `ai-server/.env.example` | `ai-server/.env` |

Minimum required variables:

**`server/.env`**
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://...
JWT_SECRET=<long-random-string>
FASTAPI_URL=http://127.0.0.1:8000
INTERNAL_SECRET=<shared-secret-with-ai-server>
```

**`client/.env`**
```env
VITE_API_URL=http://localhost:5000
# VITE_GOOGLE_CLIENT_ID=   # same as server GOOGLE_CLIENT_ID
```

**`ai-server/.env`**
```env
GEMINI_API_KEY=<your-key>
INTERNAL_SECRET=<same-as-server>
MONGO_URI=<same-as-server>
NODE_SERVER_URL=http://localhost:5000
```

See `.env.example` files for SMTP, Google OAuth, JWT expiry, Gemini tuning, and YOLO paths.

### 3. AI server (Python)

```bash
cd ai-server
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

python -m pip install -r requirements.txt
copy .env.example .env   # Windows — use cp on Unix
python main.py
```

Verify: `GET http://127.0.0.1:8000/health` → `gemini_client_initialized: true`

Details: [`ai-server/README.md`](ai-server/README.md)

### 4. Run the MERN stack

From repository root:

```bash
# Client + Express only
npm run dev

# Client + Express + AI server (three terminals worth — or use dev:all)
npm run dev:all
```

| Service | URL |
|---------|-----|
| Client | http://localhost:5173 |
| API | http://localhost:5000 |
| AI server | http://127.0.0.1:8000 |

**Start order:** AI server → Express → client (Express probes AI health at startup).

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Client + server (concurrently) |
| `npm run dev:all` | Client + server + AI server |
| `npm run dev:client` | Vite dev server only |
| `npm run dev:server` | Express with nodemon |
| `npm run dev:ai` | FastAPI (`python main.py`) |
| `npm run build:client` | Production build → `client/dist/` |
| `npm run start:server` | Production Express |

---

## Application routes

| Route | Description | Auth |
|-------|-------------|------|
| `/login`, `/register` | Authentication | Guest |
| `/forgot-password`, `/reset-password` | Password recovery | Guest |
| `/dashboard` | Your items | Required |
| `/report` | Multi-step lost/found report | Required |
| `/matches` | Browse community items | Required |
| `/matches/ai/:itemId` | AI match results for an item | Required |
| `/item/:id` | Item detail page | Required |
| `/chats`, `/chat/:id` | Messaging inbox & thread | Required |
| `/notifications` | Alerts & match notifications | Required |
| `/profile` | Profile & settings | Required |
| `/offline` | PWA offline queue & sync | Required |

---

## API overview

Base URL: `http://localhost:5000` (production: your Render/Railway URL)

| Prefix | Endpoints |
|--------|-----------|
| `/api/auth` | register, verify-otp, login, google, me, password reset |
| `/api/items` | CRUD, OCR, analyze-image, process-image, image stream |
| `/api/matches` | `GET /for-item/:itemId` |
| `/api/chat` | rooms, messages (REST); real-time via Socket.io |
| `/api/notifications` | list, unread count, mark read |
| `/api/users` | profile update, avatar, password |

AI routes are **proxied through Express** — the browser does not call FastAPI directly.

Socket.io events: `chat:join`, `chat:send`, `chat:message`, `chat:typing`, `chat:read`, `chat:notify`

---

## PWA & offline

- **Manifest:** `client/public/manifest.webmanifest`
- **Service worker:** `client/public/sw.js` — caches app shell, drains offline report queue
- **Install:** download icon in navbar (all pages until installed)
- **Offline reports:** queued in IndexedDB when `navigator.onLine` is false; synced on reconnect

Hard-refresh after service worker updates during development.

---

## OCR model setup (optional)

The `OCR_Model/` folder contains a friend's YOLO + EasyOCR training repository (~600 MB). It is **gitignored** — clone or copy it locally for development only.

To enable region-based card/CNIC OCR:

1. Place weights at the path referenced in `ai-server/.env.example` (`YOLO_WEIGHTS_PATH`)
2. Restart the AI server
3. Confirm `GET /api/v1/ocr/status` shows `yolo.ready: true`

Production servers should mount weights via env path or object storage — not via Git.

---

## Deployment

### Client (Vercel)

Root `vercel.json` builds `client/dist` from the monorepo:

- Set `VITE_API_URL` to your production API URL (HTTPS)
- Set `VITE_GOOGLE_CLIENT_ID` if using Google login
- Add `https://your-app.vercel.app` to Google OAuth authorized origins

### API (Render / Railway / VPS)

- Set all `server/.env` variables
- `CLIENT_URL` = your Vercel URL (comma-separate preview URLs if needed)
- `FASTAPI_URL` = internal or public AI server URL
- Start: `npm run start:server`

### AI server

- Deploy `ai-server/` as a separate Python service
- Set `GEMINI_API_KEY`, `MONGO_URI`, `INTERNAL_SECRET`, `NODE_SERVER_URL`
- Ensure Express can reach port 8000

---

## Security notes

- JWT access tokens (configurable expiry via `JWT_EXPIRES`)
- Rate limiting on auth and general API routes
- Helmet security headers, strict CORS origin allowlist
- Internal secret header between Express ↔ FastAPI
- GridFS image streaming with auth on sensitive routes
- Never commit `.env` files — use `.env.example` templates only

---

## What is gitignored

See [`.gitignore`](.gitignore). Key exclusions:

| Path / pattern | Reason |
|----------------|--------|
| `node_modules/` | npm dependencies |
| `**/.env` | secrets |
| `client/dist/` | Vite build output |
| `venv/`, `__pycache__/` | Python runtime |
| `*.pt`, `*.pth` | ML model weights |
| `OCR_Model/` | local training dataset (~628 MB) |
| `.vercel/` | deploy cache |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`Flow0-1.md`](Flow0-1.md) | MERN learning handbook (architecture, auth, flows) |
| [`ai-server/README.md`](ai-server/README.md) | AI server setup, Gemini, YOLO, troubleshooting |
| `server/.env.example` | Full API environment reference |
| `client/.env.example` | Frontend environment reference |
| `ai-server/.env.example` | AI server environment reference |

---

## Team & context

**Hawalay** — Final Year Project, AI-assisted lost & found for communities.

Built with a three-tier architecture separating UI, business logic, and AI inference for maintainability and independent scaling of the ML sidecar.

---

## License

Academic / FYP project — add your institutional license or `LICENSE` file before public release if required by your university.
