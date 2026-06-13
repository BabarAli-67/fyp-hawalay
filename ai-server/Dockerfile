FROM python:3.10-slim

WORKDIR /app

# Non-secret defaults only. Secrets (GEMINI_API_KEY, MONGO_URI, etc.) come from .env
# copied into the image at build time — never hardcode secrets in this file.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=7860 \
    ENVIRONMENT=production \
    YOLO_WEIGHTS_PATH=/app/artifacts/ocr/weights/best.pt \
    OBJECT_MODEL_PATH=/app/artifacts/object_v1/weights/hawaly_model_final.keras

# OpenCV + EasyOCR runtime libraries (libgl1 replaces obsolete libgl1-mesa-glx on Debian 12+)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# If weights are present locally at build time (not in git), uncomment:
# COPY artifacts/ocr/weights/best.pt artifacts/ocr/weights/best.pt
# COPY artifacts/object_v1/weights/hawaly_model_final.keras artifacts/object_v1/weights/hawaly_model_final.keras

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
