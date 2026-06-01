FROM python:3.10-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=7860 \
    ENVIRONMENT=production \
    YOLO_WEIGHTS_PATH=/app/artifacts/ocr/weights/best.pt

# OpenCV + EasyOCR runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# If best.pt is present locally at build time (not in git), uncomment:
# COPY artifacts/ocr/weights/best.pt artifacts/ocr/weights/best.pt

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
