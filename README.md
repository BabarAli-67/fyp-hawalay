
# fyp-hawalay
AI-powered Lost &amp; Found web platform built with the MERN stack, integrating OCR and BLIP image captioning for smart item recognition and automated detail extraction. Features include AI-based item matching, real-time notifications, secure authentication, and an intuitive dashboard to simplify recovery of lost belongings.
# Hawalay (EthicalFinder)

# Hawalay

Monorepo: **React (Vite)** client and **Express + MongoDB** API.

## Layout

| Path | Role |
|------|------|
| `client/` | SPA: `npm run dev`, `npm run build`, `npm run lint` |
| `server/` | REST API: `npm run dev`, `npm start`, `npm run lint` |
| `package.json` | Workspaces + `npm run dev` (client + server via `concurrently`) |

## Quick start

1. **Environment**

   - Server: copy `server/.env.example` → `server/.env` and fill required variables.
   - Client: copy `client/.env.example` → `client/.env` (e.g. `VITE_API_URL`).

2. **Install** (from repository root)

   ```bash
   npm install
   ```

3. **Run both apps**

   ```bash
   npm run dev
   ```

   - Client: default Vite URL (e.g. `http://localhost:5173`)
   - API: port from `server/.env` (`PORT`)

## Documentation

- Design-to-route mapping for the UI lives in `client/src/constants/stitchRoutes.js` (historical Stitch screen names → React paths).
