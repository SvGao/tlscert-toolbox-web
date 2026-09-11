# 🔐 Certificate Toolbox

A self-hosted, Dockerized web app for common X.509 / OpenSSL certificate tasks. No database, no persistence — everything runs in a temp directory and download links self-destruct after one use or 1 hour.

## Features

| Tool | What it does |
|------|--------------|
| **PFX → Key + Cert** | Extract certificate and private key from a `.pfx` / `.p12`, optionally stripping the key passphrase (`server.key`). |
| **Key + Cert → PFX** | Merge a private key + certificate (+ optional chain) into a `.pfx`, with `-legacy` support for old Windows/IIS imports. Intermediates may be uploaded as several separate files. |
| **Merge cert + chain** | Combine a certificate with its intermediate(s) into one `fullchain.pem`, auto-ordered leaf → root. No private key needed; PEM or DER in, and the intermediate and root may be separate files. |
| **PEM ⇄ DER** | Convert certificates between PEM and DER (CER/CRT/DER/PEM). Input format auto-detected. |
| **Chain check (file)** | Detect whether a certificate chain is complete, ordered leaf → root, and flag missing intermediates. Accepts the CA certificates as one bundle or as separate files. |
| **Chain check (URL)** | Connect to a live server, fetch the chain it presents, and report whether it is complete and trusted (catches missing-intermediate misconfigurations, expiry, etc.). |
| **Generate CSR** | Create a new private key + CSR with SAN, RSA/EC key options. |
| **Remove key passphrase** | Strip the passphrase from an encrypted private key. |
| **Inspect cert** | Decode and view full certificate details. |

## Architecture

**One container.** A multi-stage Docker build compiles the React app, then a single Node.js + Express process serves both the static UI and the API on one port.

- **Frontend** — React (Vite), built to static files and served by Express from the same origin (no CORS, no nginx).
- **Backend** — Node.js + Express, shells out to system **OpenSSL 3** (`-legacy` capable). Uploads are held in memory, processed in a per-request temp work directory, and deleted immediately.
- **Storage** — Produced files get a one-time download token. The link is invalidated (and the file deleted) after the first successful download or after `LINK_TTL_MS` (default 1 hour). The temp dir is a `tmpfs`, so nothing is ever written to a persistent disk.

## Run it

There are two sources for the image: **pull the prebuilt one from GHCR**, or **build it yourself from source** after a `git pull` (no waiting for GitHub Actions). A helper script, [`ctl.sh`](ctl.sh), wraps both. After open http://localhost:8088.

```bash
chmod +x ctl.sh
```

### Quick reference

| Action | From Docker registry (GHCR) | From GitHub (build locally) |
|--------|------------------------------|------------------------------|
| **Create** | `./ctl.sh pull-new` | `./ctl.sh build-new` |
| **Update** | `./ctl.sh pull-update` | `./ctl.sh build-update` |
| **Delete** | `./ctl.sh delete` | `./ctl.sh delete` |

Other commands: `./ctl.sh logs` · `status` · `restart` · `purge` (removes container **and** images). Override defaults with env vars, e.g. `PORT=9000 ./ctl.sh build-new`.

### What each does (equivalent manual commands)

**A. From the Docker registry** — pull the image GitHub Actions published:

```bash
# create
docker pull ghcr.io/svgao/tlscert-toolbox-web:latest
docker run -d --name cert-toolbox -p 8088:8080 --tmpfs /tmp/cert-toolbox \
  --restart unless-stopped ghcr.io/svgao/tlscert-toolbox-web:latest

# update (re-pull + recreate)
docker pull ghcr.io/svgao/tlscert-toolbox-web:latest
docker rm -f cert-toolbox
docker run -d --name cert-toolbox -p 8088:8080 --tmpfs /tmp/cert-toolbox \
  --restart unless-stopped ghcr.io/svgao/tlscert-toolbox-web:latest

# delete
docker rm -f cert-toolbox
```

> If the GHCR package is private, log in first (PAT needs `read:packages`); or make the package public in the repo's Packages settings:
> ```bash
> echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u SvGao --password-stdin
> ```

**B. From GitHub** — pull the latest code and build the image yourself:

```bash
# first time: clone
git clone git@github.com:SvGao/tlscert-toolbox-web.git && cd tlscert-toolbox-web

# create
git pull --ff-only
docker build -t cert-toolbox:local .
docker run -d --name cert-toolbox -p 8088:8080 --tmpfs /tmp/cert-toolbox \
  --restart unless-stopped cert-toolbox:local

# update (pull new code + rebuild + recreate)
git pull --ff-only
docker build -t cert-toolbox:local .
docker rm -f cert-toolbox
docker run -d --name cert-toolbox -p 8088:8080 --tmpfs /tmp/cert-toolbox \
  --restart unless-stopped cert-toolbox:local

# delete
docker rm -f cert-toolbox
```

Prefer compose for the build path? `docker compose up -d --build` (build) and `docker compose down` (delete) also work.

## Configuration

| Env var (backend) | Default | Meaning |
|-------------------|---------|---------|
| `LINK_TTL_MS` | `3600000` | Download link / temp file lifetime in ms. |
| `PORT` | `8080` | Backend listen port. |
| `TMP_ROOT` | `/tmp/cert-toolbox` | Temp working root (mounted as tmpfs). |

## Security notes

- Passphrases are passed to OpenSSL via environment variables (`env:VAR`), never on the command line or argument list.
- OpenSSL is invoked with an argument array (no shell), so uploaded filenames/values cannot inject shell commands.
- Upload size is capped at 10 MB per file.
- This tool decrypts and handles private keys. Run it on a trusted host; prefer HTTPS in front (e.g. a TLS-terminating reverse proxy) for any non-local use.

## Local development

```bash
# backend
cd backend && npm install && npm run dev

# frontend (proxies to http://localhost:8080)
cd frontend && npm install && npm run dev
```
