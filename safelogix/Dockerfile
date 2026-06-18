# ================================
# 백엔드 stage
# ================================
FROM python:3.11 AS backend

RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libffi-dev \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    shared-mime-info \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY src/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/backend/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# ================================
# 프론트엔드 stage
# ================================
FROM node:20-slim AS frontend

WORKDIR /app

COPY src/frontend/package*.json ./
RUN npm install

COPY src/frontend/ .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5176"]