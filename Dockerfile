# ---------- stage 1: build the React frontend ----------
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- stage 2: backend + static UI (single image) ----------
FROM node:20-alpine
# openssl 3 (with -legacy support) runs the certificate operations;
# ca-certificates provides the trust store used by the URL chain check.
RUN apk add --no-cache openssl ca-certificates && update-ca-certificates

WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/server.js ./
COPY backend/src ./src
# Drop the built UI where the server serves it from.
COPY --from=frontend /fe/dist ./public

ENV PORT=8080
ENV TMP_ROOT=/tmp/cert-toolbox
ENV LINK_TTL_MS=3600000
EXPOSE 8080

CMD ["node", "server.js"]
