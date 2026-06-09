# ── Stage 1: React 프론트엔드 빌드 ────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Python FastAPI 백엔드 + 프론트엔드 ───────────────────────────
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python 패키지 설치
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 백엔드 코드 복사
COPY backend/ ./

# 빌드된 프론트엔드 복사
COPY --from=frontend-build /build/dist ./frontend_dist/

ENV PORT=8001

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
