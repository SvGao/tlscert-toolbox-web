#!/usr/bin/env bash
# Management helper for cert-toolbox.
# Two sources:
#   registry  -> pull the prebuilt image from GHCR
#   local     -> git pull + docker build from source
#
# Usage:  ./ctl.sh <command>
set -euo pipefail

# ---- config (override via env) ----
IMAGE="${IMAGE:-ghcr.io/svgao/tlscert-toolbox-web:latest}"   # GHCR image
LOCAL_TAG="${LOCAL_TAG:-cert-toolbox:local}"                  # locally built tag
NAME="${NAME:-cert-toolbox}"                                  # container name
PORT="${PORT:-8088}"                                          # host port -> 8080

cd "$(dirname "$0")"

run() {
  docker run -d --name "$NAME" \
    -p "${PORT}:8080" \
    --tmpfs /tmp/cert-toolbox \
    --restart unless-stopped \
    "$1"
  echo "started '$NAME' -> http://localhost:${PORT}"
}

rm_container() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }

case "${1:-help}" in
  # ================= registry (Docker/GHCR) =================
  pull-new)      # create: pull image and start
    docker pull "$IMAGE"; rm_container; run "$IMAGE" ;;
  pull-update)   # update: pull newer image and recreate
    docker pull "$IMAGE"; rm_container; run "$IMAGE"
    docker image prune -f >/dev/null 2>&1 || true ;;

  # ================= local build (GitHub) =================
  build-new)     # create: git pull, build, start
    git pull --ff-only; docker build -t "$LOCAL_TAG" .; rm_container; run "$LOCAL_TAG" ;;
  build-update)  # update: git pull, rebuild, recreate
    git pull --ff-only; docker build -t "$LOCAL_TAG" .; rm_container; run "$LOCAL_TAG"
    docker image prune -f >/dev/null 2>&1 || true ;;

  # ================= shared =================
  delete)        # remove the running container (image kept)
    rm_container; echo "removed container '$NAME'" ;;
  purge)         # remove container AND both images
    rm_container; docker rmi "$IMAGE" "$LOCAL_TAG" >/dev/null 2>&1 || true
    echo "removed container and images" ;;
  logs)          docker logs -f "$NAME" ;;
  status)        docker ps -a --filter "name=$NAME" ;;
  restart)       docker restart "$NAME" ;;

  *)
    cat <<EOF
cert-toolbox control script

Registry (pull prebuilt image from GHCR):
  ./ctl.sh pull-new       create: pull image + start
  ./ctl.sh pull-update    update: pull newer image + recreate

Local build (from your git checkout):
  ./ctl.sh build-new      create: git pull + build + start
  ./ctl.sh build-update   update: git pull + rebuild + recreate

Manage:
  ./ctl.sh delete         stop & remove the container (keeps image)
  ./ctl.sh purge          remove container + images
  ./ctl.sh restart        restart the container
  ./ctl.sh logs           follow logs
  ./ctl.sh status         show container state

Env overrides: PORT (default 8088), NAME, IMAGE, LOCAL_TAG
EOF
    ;;
esac
