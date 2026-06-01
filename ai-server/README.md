---
title: Hawalay AI Backend
emoji: 🔍
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
suggested_hardware: cpu-upgrade
short_description: FastAPI OCR (YOLO + EasyOCR), Gemini caption/embeddings, and MongoDB matching for Hawalay.
---

# Hawalay AI Server

Modular FastAPI microservice for Hawalay FYP AI features.

## Modules

| Module | Prefix | Status |
|--------|--------|--------|
| OCR | `/api/v1/ocr` | Active (EasyOCR); YOLO when `YOLO_WEIGHTS_PATH` is set |
| Caption | `/api/v1/blip` | Google Gemini (`GEMINI_API_KEY`) |
| Embedding | `/api/v1/clip` | Google Gemini `gemini-embedding-2` |
| Matching | `/api/v1/matching` | MongoDB + embedding similarity |
| Unified pipeline | `/ai/process-image` | OCR + Gemini caption + embedding fusion |
| **Unified analyze** | `POST /ai/analyze-image` | Structured OCR + Gemini caption + embeddings (one upload) |
| Background match | `POST /ai/match` | Express calls after item create (requires `X-Internal-Secret`) |

## Quick start

```bash
cd ai-server
python -m venv venv
venv\Scripts\activate          # Windows (prompt shows (venv))
python -m pip install -r requirements.txt
copy .env.example .env
# Set GEMINI_API_KEY in .env — https://aistudio.google.com/apikey
python main.py
```

If you see `ModuleNotFoundError: No module named 'google'`, the Gemini SDK is missing **in this venv** — run:

```bash
python -m pip install "google-genai>=1.0.0,<2.0"
```

Use `python -m pip` (not bare `pip`) so packages install into the active venv, not global Python.

Health: `GET http://localhost:8000/health` → includes `gemini_client_initialized: true` and `gemini_key_suffix: ***xxxx` when Gemini is live.

## Troubleshooting: Gemini works in sandbox but not in the app

Express uses `FASTAPI_URL=http://127.0.0.1:8000`. **Only one** ai-server process may use that port.

If an old `uvicorn` is still running from a previous session, Windows can bind both `127.0.0.1:8000` (stale) and `0.0.0.0:8000` (new `python main.py`). Express always hits `127.0.0.1` → the **stale** server → OCR works, Gemini never called, usage dashboard unchanged.

```powershell
netstat -ano | findstr :8000
Stop-Process -Id <PID> -Force   # kill every python on 8000 except your current main.py
python main.py
```

Verify the correct server:

```powershell
curl http://127.0.0.1:8000/health
# Must include: "gemini_client_initialized": true, "gemini_key_suffix": "***...."
```

Start order: **ai-server first**, then `npm run dev` (Express probes `/health` once at startup).

OCR extract: `POST http://localhost:8000/api/v1/ocr/extract` (multipart `image` + optional `document_type`)

Unified pipeline: `POST http://localhost:8000/ai/process-image` → `{ caption, ocr_text, embedding_vector }` (512 floats for matching)

## Gemini configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | (required) | API key from Google AI Studio |
| `GEMINI_CAPTION_MODEL` | `gemini-2.0-flash` | Image captioning (`gemini-1.5-flash` is retired on the API) |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | Text + image embeddings (native 3072-d, truncated to 512 for MongoDB) |

## YOLO weights (when available)

1. Set in `.env`: `YOLO_WEIGHTS_PATH=.../best.pt`
2. Restart server — `/api/v1/ocr/status` should show `yolo.ready: true`

## Express integration

Point MERN `FASTAPI_URL` to this server (e.g. `http://127.0.0.1:8000`). Proxy from Express (do not call from browser).

**Local dev:** `npm run dev` starts client + Express only. You must also run the AI server:

```bash
cd ai-server
python main.py
# or from repo root: npm run dev:ai
```

Wait until logs show `EasyOCR ready` before uploading images in the report wizard.

CORS allows only `NODE_SERVER_URL` (your Express API origin).
