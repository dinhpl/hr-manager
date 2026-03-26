#!/bin/bash
set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"

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
  ./dev.sh             Start dev stack with build
  ./dev.sh up          Start dev stack with build
  ./dev.sh down        Stop dev stack
  ./dev.sh restart     Restart dev stack
  ./dev.sh logs        Tail dev logs
  ./dev.sh ps          Show dev containers
EOF
}

cmd="${1:-up}"

if ! load_env_file ".env.local"; then
  load_env_file ".env" || true
fi

case "$cmd" in
  up)
    docker compose -f "$COMPOSE_FILE" up --build
    ;;
  down)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    docker compose -f "$COMPOSE_FILE" down
    docker compose -f "$COMPOSE_FILE" up --build
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f
    ;;
  ps)
    docker compose -f "$COMPOSE_FILE" ps
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
