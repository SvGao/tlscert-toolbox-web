# 🔐 Certificate Toolbox

A self-hosted, Dockerized web app for common X.509 / OpenSSL certificate tasks. No database, no persistence — everything runs in a temp directory and download links self-destruct after one use or 1 hour.

## Features

| Tool | What it does |
|------|--------------|
| **PFX → Key + Cert** | Extract certificate and private key from a `.pfx` / `.p12`, optionally stripping the key passphrase (`server.key`). |
| **Key + Cert → PFX** | Merge a private key + certificate (+ optional chain) into a `.pfx`, with `-legacy` support for old Windows/IIS imports. |
| **PEM ⇄ DER** | Convert certificates between PEM and DER (CER/CRT/DER/PEM). Input format auto-detected. |
| **Chain check** | Detect whether a certificate chain is complete, ordered leaf → root, and flag missing intermediates. |
| **Generate CSR** | Create a new private key + CSR with SAN, RSA/EC key options. |
| **Remove key passphrase** | Strip the passphrase from an encrypted private key. |
| **Inspect cert** | Decode and view full certificate details. |

## Architecture

**One container.** A multi-stage Docker build compiles the React app, then a single Node.js + Express process serves both the static UI and the API on one port.

- **Frontend** — React (Vite), built to static files and served by Express from the same origin (no CORS, no nginx).
- **Backend** — Node.js + Express, shells out to system **OpenSSL 3** (`-legacy` capable). Uploads are held in memory, processed in a per-request temp work directory, and deleted immediately.
- **Storage** — Produced files get a one-time download token. The link is invalidated (and the file deleted) after the first successful download or after `LINK_TTL_MS` (default 1 hour). The temp dir is a `tmpfs`, so nothing is ever written to a persistent disk.

## Run it

### Option A — pull the prebuilt image (recommended)

Every push to `main` auto-builds and publishes a multi-arch image to GitHub Container Registry via GitHub Actions. Just pull and run:

```bash
docker pull ghcr.io/svgao/tlscert-toolbox-web:latest

docker run -d --name cert-toolbox -p 8088:8080 \
  --tmpfs /tmp/cert-toolbox \
  ghcr.io/svgao/tlscert-toolbox-web:latest
```

Then open http://localhost:8088

> If the package is private, log in first:
> ```bash
> echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u SvGao --password-stdin
> ```
> (PAT needs the `read:packages` scope. Make the package public in the repo's Packages settings to skip this.)

### Option B — build from source

```bash
git clone git@github.com:SvGao/tlscert-toolbox-web.git
cd tlscert-toolbox-web
docker compose up --build
```

Or plain Docker without compose:

```bash
docker build -t cert-toolbox . && docker run --rm -p 8088:8080 cert-toolbox
```

## Configuration

| Env var (backend) | Default | Meaning |
|-------------------|---------|---------|
| `LINK_TTL_MS` | `3600000` | Download link / temp file lifetime in ms. |
| `PORT` | `8080` | Backend listen port. |
| `TMP_ROOT` | `/tmp/cert-toolbox` | Temp working root (mounted as tmpfs). |

## Security notes

- Passphrases are passed to OpenSSL via environment variables (`env:VAR`), never on the command line or argument list.
- OpenSSL is invoked with an argument array (no shell), so uploaded filenames/values cannot inject shell commands.
- Upload size is capped (10 MB backend / 15 MB nginx).
- This tool decrypts and handles private keys. Run it on a trusted host; prefer HTTPS in front (e.g. a TLS-terminating reverse proxy) for any non-local use.

## Local development

```bash
# backend
cd backend && npm install && npm run dev

# frontend (proxies to http://localhost:8080)
cd frontend && npm install && npm run dev
```
