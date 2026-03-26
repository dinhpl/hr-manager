#!/bin/bash
set -euo pipefail

SERVER_USER="ec2-user"
SERVER_HOST="13.115.82.223"
SERVER_PORT="22"
SERVER_DIR="/home/ec2-user/www/ota-hr"
SSH_KEY="/Users/dinhpl/Documents/TEST_AI/ota-workspace-app/pms-server.pem"

FRONTEND_IMAGE="${FRONTEND_IMAGE:-ota-hr-frontend}"
BACKEND_IMAGE="${BACKEND_IMAGE:-ota-hr-backend}"
FRONTEND_VERSION="${FRONTEND_VERSION:-latest}"
BACKEND_VERSION="${BACKEND_VERSION:-latest}"

LOCAL_FRONTEND_TAR="/tmp/${FRONTEND_IMAGE}-${FRONTEND_VERSION}.tar.gz"
LOCAL_BACKEND_TAR="/tmp/${BACKEND_IMAGE}-${BACKEND_VERSION}.tar.gz"
REMOTE_FRONTEND_TAR="/tmp/${FRONTEND_IMAGE}-${FRONTEND_VERSION}.tar.gz"
REMOTE_BACKEND_TAR="/tmp/${BACKEND_IMAGE}-${BACKEND_VERSION}.tar.gz"

SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info()    { echo -e "\n${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
log_step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

for tool in docker rsync ssh gzip; do
  command -v "$tool" >/dev/null 2>&1 || log_error "$tool chưa được cài."
done

if [ -f ".env.production" ]; then
  log_info "Nạp biến build từ .env.production"
  set -a
  . ./.env.production
  set +a
elif [ -f ".env" ]; then
  log_info "Nạp biến build từ .env"
  set -a
  . ./.env
  set +a
else
  log_warning "Không có .env.production hoặc .env. Sẽ dùng fallback mặc định."
fi

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://hr.onetech.vn}"
BACKEND_URL="${BACKEND_URL:-http://backend:5501}"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${SERVER_PORT}"
if [ -n "${SSH_KEY}" ]; then
  SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
fi

ssh_run() {
  ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" "$@"
}

rsync_push() {
  local src="$1"
  local dest="$2"
  rsync -avz --progress -e "ssh ${SSH_OPTS}" "$src" "${SERVER_USER}@${SERVER_HOST}:${dest}"
}

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              OTA HR Deploy Script               ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC} Server : ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}"
echo -e "${CYAN}║${NC} Dir    : ${SERVER_DIR}"
echo -e "${CYAN}║${NC} FE API : ${NEXT_PUBLIC_API_URL}"
echo -e "${CYAN}║${NC} FE BE  : ${BACKEND_URL}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"

START_TIME=$SECONDS

log_step "Bước 1/4: Build Docker images"
if [ "${SKIP_BUILD}" = false ]; then
  log_info "Build frontend image ${FRONTEND_IMAGE}:${FRONTEND_VERSION}"
  docker build \
    --platform linux/amd64 \
    --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
    --build-arg BACKEND_URL="${BACKEND_URL}" \
    -t "${FRONTEND_IMAGE}:${FRONTEND_VERSION}" \
    .

  log_info "Build backend image ${BACKEND_IMAGE}:${BACKEND_VERSION}"
  docker build \
    --platform linux/amd64 \
    -t "${BACKEND_IMAGE}:${BACKEND_VERSION}" \
    ./backend

  log_success "Build images thành công"
else
  log_warning "Bỏ qua build, dùng image local có sẵn"
  docker image inspect "${FRONTEND_IMAGE}:${FRONTEND_VERSION}" >/dev/null 2>&1 || log_error "Thiếu image frontend local"
  docker image inspect "${BACKEND_IMAGE}:${BACKEND_VERSION}" >/dev/null 2>&1 || log_error "Thiếu image backend local"
fi

log_step "Bước 2/4: Save images"
log_info "Đóng gói frontend image"
docker save "${FRONTEND_IMAGE}:${FRONTEND_VERSION}" | gzip > "${LOCAL_FRONTEND_TAR}"
log_info "Frontend tar size: $(du -h "${LOCAL_FRONTEND_TAR}" | cut -f1)"
log_info "Đóng gói backend image"
docker save "${BACKEND_IMAGE}:${BACKEND_VERSION}" | gzip > "${LOCAL_BACKEND_TAR}"
log_info "Backend tar size: $(du -h "${LOCAL_BACKEND_TAR}" | cut -f1)"
log_success "Đã tạo tar images"

log_step "Bước 3/4: Rsync files lên server"
ssh_run "mkdir -p '${SERVER_DIR}'"
rsync_push "${LOCAL_FRONTEND_TAR}" "/tmp/"
rsync_push "${LOCAL_BACKEND_TAR}" "/tmp/"
rsync_push "docker-compose.server.yml" "${SERVER_DIR}/docker-compose.yml"

if [ -f ".env.production" ]; then
  log_info "Rsync .env.production lên server thành .env"
  rsync_push ".env.production" "${SERVER_DIR}/.env"
elif [ -f ".env" ]; then
  log_info "Rsync .env lên server"
  rsync_push ".env" "${SERVER_DIR}/.env"
fi

rm -f "${LOCAL_FRONTEND_TAR}" "${LOCAL_BACKEND_TAR}"
log_success "Transfer hoàn tất"

log_step "Bước 4/4: Load images và khởi động server"
ssh_run "
  set -e
  cd '${SERVER_DIR}'

  echo '📦 Loading frontend image...'
  gunzip -c '${REMOTE_FRONTEND_TAR}' | sudo docker load
  rm -f '${REMOTE_FRONTEND_TAR}'

  echo '📦 Loading backend image...'
  gunzip -c '${REMOTE_BACKEND_TAR}' | sudo docker load
  rm -f '${REMOTE_BACKEND_TAR}'

  FRONTEND_IMAGE='${FRONTEND_IMAGE}' FRONTEND_VERSION='${FRONTEND_VERSION}' BACKEND_IMAGE='${BACKEND_IMAGE}' BACKEND_VERSION='${BACKEND_VERSION}' \
    sudo docker compose up -d db

  FRONTEND_IMAGE='${FRONTEND_IMAGE}' FRONTEND_VERSION='${FRONTEND_VERSION}' BACKEND_IMAGE='${BACKEND_IMAGE}' BACKEND_VERSION='${BACKEND_VERSION}' \
    sudo docker compose up -d --no-deps --force-recreate --wait backend

  FRONTEND_IMAGE='${FRONTEND_IMAGE}' FRONTEND_VERSION='${FRONTEND_VERSION}' BACKEND_IMAGE='${BACKEND_IMAGE}' BACKEND_VERSION='${BACKEND_VERSION}' \
    sudo docker compose up -d --no-deps --force-recreate --wait frontend

  echo ''
  sudo docker compose ps
  echo ''

  cleanup_old_project_images() {
    image_name=\"\$1\"
    keep_ref=\"\$2\"
    removed_any=0
    image_lines=\$(sudo docker images --format '{{.Repository}}:{{.Tag}} {{.Repository}} {{.ID}}')

    echo \"🧹 Cleanup old images for \$image_name (keeping \$keep_ref)\"

    while read -r full_ref repo image_id; do
      [ -n \"\$full_ref\" ] || continue
      [ \"\$repo\" = \"\$image_name\" ] || continue
      [ \"\$full_ref\" = \"\$keep_ref\" ] && continue
      echo \" - removing \$full_ref (\$image_id)\"
      sudo docker image rm -f \"\$image_id\" || true
      removed_any=1
    done <<EOF
\$image_lines
EOF

    if [ \"\$removed_any\" = \"0\" ]; then
      echo \" - no old images to remove\"
    fi
  }

  cleanup_old_project_images '${FRONTEND_IMAGE}' '${FRONTEND_IMAGE}:${FRONTEND_VERSION}'
  cleanup_old_project_images '${BACKEND_IMAGE}' '${BACKEND_IMAGE}:${BACKEND_VERSION}'
"

ELAPSED=$((SECONDS - START_TIME))
MINUTES=$((ELAPSED / 60))
SECS=$((ELAPSED % 60))

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Deploy hoàn tất                    ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC} Server dir : ${SERVER_DIR}"
echo -e "${GREEN}║${NC} Frontend   : http://${SERVER_HOST}:5500"
echo -e "${GREEN}║${NC} Time       : ${MINUTES}m ${SECS}s"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
