#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  echo "Script này cần bash. Hãy chạy: bash run.sh $*" >&2
  exit 1
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
BACKEND_DIR="$ROOT_DIR/backend"
INFRA_DIR="$BACKEND_DIR/infra"
DATABASE_DIR="$INFRA_DIR/database"
COMPOSE_FILE="$INFRA_DIR/docker-compose.yml"
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"
VENV_DIR="$BACKEND_DIR/.venv"
STAMP_FILE="$VENV_DIR/.requirements.stamp"
COMPOSE_UP_EXTRA=""

if [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]; then
  C_RESET=$'\033[0m'
  C_STEP=$'\033[36m'
  C_OK=$'\033[32m'
  C_WARN=$'\033[33m'
  C_ERR=$'\033[31m'
else
  C_RESET=""
  C_STEP=""
  C_OK=""
  C_WARN=""
  C_ERR=""
fi

step() { printf '%s==>%s %s\n' "$C_STEP" "$C_RESET" "$*"; }
ok()   { printf '%s  ok%s %s\n' "$C_OK" "$C_RESET" "$*"; }
warn() { printf '%swarn%s %s\n' "$C_WARN" "$C_RESET" "$*" >&2; }
die()  { printf '%serr %s %s\n' "$C_ERR" "$C_RESET" "$*" >&2; exit 1; }

# Xac dinh he dieu hanh dang chay de xu ly khac biet ve duong dan va lenh
detect_platform() {
  case "$(uname -s)" in
    Linux*)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        PLATFORM="wsl"
      else
        PLATFORM="linux"
      fi
      ;;
    Darwin*) PLATFORM="macos" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
    *) PLATFORM="unknown" ;;
  esac
}

# Kiem tra Docker da cai va da chay chua
require_docker() {
  command -v docker >/dev/null 2>&1 || die "Chưa cài Docker. Tải tại https://docs.docker.com/get-docker/"
  if ! docker info >/dev/null 2>&1; then
    case "$PLATFORM" in
      macos|windows) die "Docker chưa chạy. Hãy mở Docker Desktop rồi chạy lại." ;;
      linux|wsl)     die "Docker chưa chạy. Thử: sudo systemctl start docker" ;;
      *)             die "Docker chưa chạy." ;;
    esac
  fi
}

# Chon giua 'docker compose' (v2) va 'docker-compose' (v1)
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_V2=true
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_V2=false
  else
    die "Không tìm thấy Docker Compose (cả 'docker compose' và 'docker-compose')."
  fi
}

compose() {
  if [ "$COMPOSE_V2" = true ]; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    docker-compose -f "$COMPOSE_FILE" "$@"
  fi
}

# docker-compose v1 hong khi recreate container tren Docker Engine 25+,
# nen khi gap phai thi them --no-recreate de khong lam hong container dang co
check_compose_compatibility() {
  [ "$COMPOSE_V2" = true ] && return 0

  local engine major
  engine="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
  major="${engine%%.*}"

  case "$major" in
    ''|*[!0-9]*) return 0 ;;
  esac

  if [ "$major" -ge 25 ]; then
    warn "docker-compose v1 không tương thích Docker Engine $engine (lỗi 'ContainerConfig' khi recreate)."
    warn "Đang dùng --no-recreate để tránh làm hỏng container hiện có."
    warn "Nên cài Docker Compose v2: https://docs.docker.com/compose/install/linux/"
    COMPOSE_UP_EXTRA="--no-recreate"
  fi
}

# Doc mot bien tu backend/.env, tra ve gia tri mac dinh neu khong co
env_value() {
  local key="$1" fallback="$2" value=""
  if [ -f "$ENV_FILE" ]; then
    value="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)"
    value="${value%$'\r'}"
  fi
  if [ -n "$value" ]; then printf '%s' "$value"; else printf '%s' "$fallback"; fi
}

# Tim interpreter Python >= 3.11, co the loai tru mot duong dan cu the
find_python() {
  local exclude="${1:-}" candidate resolved
  for candidate in ${SMARTWATT_PYTHON:-} python3 python; do
    [ -n "$candidate" ] || continue
    command -v "$candidate" >/dev/null 2>&1 || continue
    resolved="$(command -v "$candidate")"
    if [ -n "$exclude" ] && [ "$resolved" = "$exclude" ]; then
      continue
    fi
    if "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

# Tra ve duong dan python trong venv, khac nhau giua Windows va Unix
venv_python() {
  if [ -x "$VENV_DIR/bin/python" ]; then
    printf '%s' "$VENV_DIR/bin/python"
  elif [ -x "$VENV_DIR/Scripts/python.exe" ]; then
    printf '%s' "$VENV_DIR/Scripts/python.exe"
  else
    return 1
  fi
}

# Tao backend/.env tu file mau neu chua co
ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    ok "Đã tạo backend/.env từ .env.example"
  fi
}

# Doc interpreter da tao ra venv hien tai tu pyvenv.cfg
venv_base_python() {
  local cfg="$VENV_DIR/pyvenv.cfg"
  [ -f "$cfg" ] || return 1
  grep -E '^executable[[:space:]]*=' "$cfg" | head -n 1 | cut -d '=' -f 2- | tr -d ' \r'
}

# Tao lai virtualenv bang mot interpreter cu the
create_venv() {
  step "Tạo virtualenv backend/.venv bằng $1"
  rm -rf "$VENV_DIR"
  "$1" -m venv "$VENV_DIR"
}

# Cai thu vien Python khi requirements.txt moi hon lan cai truoc
install_requirements() {
  local vpy
  vpy="$(venv_python)"
  if [ -f "$STAMP_FILE" ] && [ ! "$BACKEND_DIR/requirements.txt" -nt "$STAMP_FILE" ]; then
    return 0
  fi
  step "Cài thư viện Python"
  "$vpy" -m pip install --quiet --upgrade pip
  "$vpy" -m pip install --quiet -r "$BACKEND_DIR/requirements.txt"
  touch "$STAMP_FILE"
  ok "Đã cài thư viện Python"
}

# Kiem tra venv nap duoc cac thu vien co phan bien dich
venv_works() {
  local vpy
  vpy="$(venv_python)" || return 1
  "$vpy" -c 'import fastapi, numpy, sklearn, asyncpg, paho.mqtt.client' >/dev/null 2>&1
}

# Tao virtualenv va cai thu vien, tu tao lai neu interpreter cu khong dung duoc.
# Thuong gap khi venv duoc tao bang Python cua Nix: python do khong nap duoc
# libstdc++ cua he thong, nen numpy/sklearn bao loi ImportError.
ensure_venv() {
  if ! venv_python >/dev/null 2>&1; then
    local base_python
    base_python="$(find_python)" || die "Cần Python >= 3.11 trong PATH."
    create_venv "$base_python"
  fi

  install_requirements
  if venv_works; then
    return 0
  fi

  local previous alternative
  previous="$(venv_base_python || true)"
  alternative="$(find_python "$previous")" || die \
    "Virtualenv hiện tại không nạp được thư viện và không tìm thấy Python khác.
Xoá thủ công rồi chạy lại: rm -rf backend/.venv"

  warn "Virtualenv hiện tại không nạp được thư viện Python."
  [ -n "$previous" ] && warn "Interpreter đã dùng: $previous"
  warn "Thử tạo lại bằng: $alternative"

  create_venv "$alternative"
  install_requirements
  venv_works || die "Vẫn không nạp được thư viện. Đặt SMARTWATT_PYTHON=<đường dẫn python> rồi chạy lại."
  ok "Đã tạo lại virtualenv thành công"
}

# Chay psql ben trong container PostgreSQL, an cac NOTICE khong can thiet
psql_exec() {
  compose exec -T -e PGOPTIONS="-c client_min_messages=warning" \
    postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

# Cho PostgreSQL san sang truoc khi migrate
wait_for_database() {
  local attempt=0
  step "Chờ PostgreSQL sẵn sàng"
  until compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 60 ]; then
      die "PostgreSQL không sẵn sàng sau 60 giây."
    fi
    sleep 1
  done
  ok "PostgreSQL sẵn sàng"
}

# Bang theo doi migration da ap dung
ensure_migrations_table() {
  psql_exec -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )" >/dev/null
}

migration_recorded() {
  local version="$1"
  [ "$(psql_exec -tAc "SELECT count(*) FROM schema_migrations WHERE version = '$version'")" = "1" ]
}

record_migration() {
  psql_exec -q -c "INSERT INTO schema_migrations (version) VALUES ('$1') ON CONFLICT DO NOTHING" >/dev/null
}

core_schema_exists() {
  [ "$(psql_exec -tAc "SELECT to_regclass('public.users') IS NOT NULL")" = "t" ]
}

apply_migration() {
  local file="$1" name="$2"
  psql_exec -q -f - < "$file" >/dev/null
  record_migration "$name"
}

# Ap dung cac file .sql theo thu tu, bo qua file da chay.
# Rieng 001 chua lenh DROP TABLE nen chi chay khi database con trong.
cmd_migrate() {
  require_docker
  detect_compose
  wait_for_database
  ensure_migrations_table

  local file name
  for file in "$DATABASE_DIR"/*.sql; do
    [ -e "$file" ] || continue
    name="$(basename "$file" .sql)"

    if migration_recorded "$name"; then
      continue
    fi

    if [ "$name" = "001_init_schema" ] && core_schema_exists; then
      warn "Schema đã tồn tại, ghi nhận 001 là đã áp dụng (không chạy lại để tránh mất dữ liệu)"
      record_migration "$name"
      continue
    fi

    step "Áp dụng migration $name"
    apply_migration "$file" "$name"
    ok "$name"
  done
}

# Lay ten Wi-Fi dang ket noi, hoat dong tren ca ba he dieu hanh
wifi_name() {
  local wifi=""
  case "$PLATFORM" in
    macos)
      wifi=$(ipconfig getsummary en0 2>/dev/null | grep ' SSID' | awk -F': ' '{print $2}')
      [ -z "$wifi" ] && wifi=$(ipconfig getsummary en1 2>/dev/null | grep ' SSID' | awk -F': ' '{print $2}')
      ;;
    windows)
      wifi=$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s*SSID\s*:' | awk -F': ' '{print $2}' | tr -d '\r')
      ;;
    *)
      if command -v nmcli >/dev/null 2>&1; then
        wifi=$(nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes' | cut -d: -f2)
      elif command -v iwgetid >/dev/null 2>&1; then
        wifi=$(iwgetid -r 2>/dev/null)
      fi
      ;;
  esac
  printf '%s' "$wifi"
}

# Lay dia chi IP noi bo cua may dang chay server
lan_ip() {
  local ip=""
  case "$PLATFORM" in
    macos)
      ip=$(ipconfig getifaddr en0 2>/dev/null)
      [ -z "$ip" ] && ip=$(ipconfig getifaddr en1 2>/dev/null)
      ;;
    windows)
      ip=$(ipconfig 2>/dev/null | grep -i "IPv4" | head -n 1 | awk -F': ' '{print $2}' | tr -d '\r')
      ;;
    *)
      if command -v hostname >/dev/null 2>&1; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
      fi
      if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
        ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
      fi
      ;;
  esac
  printf '%s' "$ip"
}

# In thong tin mang va dia chi can dien vao firmware va app
cmd_info() {
  local ip wifi
  ip="$(lan_ip)"
  wifi="$(wifi_name)"
  [ -z "$ip" ] && ip="Không xác định"
  [ -z "$wifi" ] && wifi="Không xác định"

  printf '\n'
  printf 'Thông tin cấu hình:\n'
  printf -- '- Wi-Fi đang dùng      : %s\n' "$wifi"
  printf -- '- IP broker MQTT       : %s\n' "$ip"
  printf -- '- API cho mobile app   : http://%s:%s\n' "$ip" "$APP_PORT"
  printf -- '- WebSocket            : ws://%s:%s/ws\n' "$ip" "$APP_PORT"
  printf -- '- MQTT broker          : %s:%s\n' "$ip" "$MQTT_PORT"
  printf '\n'
  printf 'Điền các giá trị trên vào trang cấu hình của thiết bị.\n'
  printf 'Mật khẩu Wi-Fi không hiển thị được.\n\n'
  printf 'Với app mobile, đặt trong mobile/.env:\n'
  printf '  EXPO_PUBLIC_API_BASE_URL=http://%s:%s\n' "$ip" "$APP_PORT"
  printf '  EXPO_PUBLIC_WS_BASE_URL=ws://%s:%s\n\n' "$ip" "$APP_PORT"
  printf 'Android emulator thì dùng 10.0.2.2 thay cho IP LAN.\n\n'
}

cmd_setup() {
  ensure_env_file
  ensure_venv
}

cmd_up() {
  require_docker
  detect_compose
  check_compose_compatibility
  ensure_env_file

  step "Khởi động PostgreSQL và Mosquitto"
  compose up -d $COMPOSE_UP_EXTRA postgres mosquitto
  ok "Container đã chạy"

  cmd_migrate
  ensure_venv
  cmd_info

  step "Chạy backend tại http://127.0.0.1:$APP_PORT (Ctrl+C để dừng)"
  printf 'Tài liệu API: http://127.0.0.1:%s/docs\n\n' "$APP_PORT"
  printf 'Dừng hạ tầng khi cần: ./run.sh down\n\n'

  cd "$BACKEND_DIR"
  exec "$(venv_python)" -m uvicorn app.main:app --host "$APP_HOST" --port "$APP_PORT"
}

cmd_down() {
  require_docker
  detect_compose
  step "Dừng PostgreSQL và Mosquitto"
  compose down
  ok "Đã dừng"
}

cmd_logs() {
  require_docker
  detect_compose
  compose logs -f postgres mosquitto
}

# Sao luu toan bo database ra mot file .sql
cmd_backup() {
  require_docker
  detect_compose
  wait_for_database

  local target="${1:-$ROOT_DIR/smartwatt-backup-$(date +%Y%m%d-%H%M%S).sql}"
  step "Sao lưu database vào $target"
  compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$target"
  ok "Đã sao lưu $(wc -c < "$target" | tr -d ' ') bytes"
}

cmd_reset() {
  require_docker
  detect_compose
  warn "Lệnh này XOÁ TOÀN BỘ dữ liệu người dùng, thiết bị và telemetry."
  printf 'Gõ "yes" để tiếp tục: '
  read -r answer
  [ "$answer" = "yes" ] || die "Đã huỷ."

  wait_for_database
  step "Xoá schema hiện tại"
  psql_exec -q -c "DROP TABLE IF EXISTS telemetry CASCADE;
                   DROP TABLE IF EXISTS devices CASCADE;
                   DROP TABLE IF EXISTS alert_logs CASCADE;
                   DROP TABLE IF EXISTS users CASCADE;
                   DROP TABLE IF EXISTS schema_migrations CASCADE;" >/dev/null
  ok "Đã xoá"

  cmd_migrate
}

usage() {
  cat <<'EOF'
SmartWatt - chạy dự án trên Linux, macOS và Windows (Git Bash/WSL)

Cách dùng: ./run.sh [lệnh]

  up        Bật hạ tầng, migrate và chạy backend  (mặc định)
  down      Dừng PostgreSQL và Mosquitto
  logs      Xem log của PostgreSQL và Mosquitto
  migrate   Chỉ áp dụng migration còn thiếu
  backup    Sao lưu database ra file .sql (mặc định: smartwatt-backup-<ngày>.sql)
  setup     Chỉ tạo .env, virtualenv và cài thư viện
  info      In Wi-Fi, IP LAN và địa chỉ API/MQTT cần cấu hình
  reset     Xoá sạch dữ liệu rồi migrate lại (cần xác nhận)
  help      Hiện trợ giúp này

Ví dụ:
  ./run.sh                      chạy toàn bộ dự án
  ./run.sh backup mydata.sql    sao lưu ra mydata.sql
EOF
}

main() {
  detect_platform

  DB_NAME="$(env_value DB_NAME smartwatt)"
  DB_USER="$(env_value DB_USER smartwatt)"
  APP_HOST="$(env_value APP_HOST 0.0.0.0)"
  APP_PORT="$(env_value APP_PORT 8000)"
  MQTT_PORT="$(env_value MQTT_BROKER_PORT 1883)"

  local command="${1:-up}"
  if [ $# -gt 0 ]; then shift; fi

  case "$command" in
    up)      cmd_up "$@" ;;
    down)    cmd_down "$@" ;;
    logs)    cmd_logs "$@" ;;
    migrate) cmd_migrate "$@" ;;
    backup)  cmd_backup "$@" ;;
    setup)   cmd_setup "$@" ;;
    info)    cmd_info "$@" ;;
    reset)   cmd_reset "$@" ;;
    help|-h|--help) usage ;;
    *)       warn "Lệnh không hợp lệ: $command"; usage; exit 1 ;;
  esac
}

main "$@"
