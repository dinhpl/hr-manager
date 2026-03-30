#!/bin/bash
set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"
SERVICES=("db" "backend")

load_env_file() {
  local env_file="$1"
  [ -f "$env_file" ] || return 1
  set -a
  # shellcheck disable=SC1090
  . "./$env_file"
  set +a
  return 0
}

usage() {
  cat <<'EOF'
Usage:
  ./dev-be.sh             Start backend + postgres dev stack with build
  ./dev-be.sh up          Start backend + postgres dev stack with build
  ./dev-be.sh down        Stop backend + postgres dev stack
  ./dev-be.sh restart     Restart backend + postgres dev stack
  ./dev-be.sh logs        Tail backend + postgres logs
  ./dev-be.sh ps          Show backend + postgres containers
EOF
}

cmd="${1:-up}"

if ! load_env_file ".env.local"; then
  load_env_file ".env" || true
fi

case "$cmd" in
  up)
    docker compose -f "$COMPOSE_FILE" up --build "${SERVICES[@]}"
    ;;
  down)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    docker compose -f "$COMPOSE_FILE" down
    docker compose -f "$COMPOSE_FILE" up --build "${SERVICES[@]}"
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "${SERVICES[@]}"
    ;;
  ps)
    docker compose -f "$COMPOSE_FILE" ps "${SERVICES[@]}"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
