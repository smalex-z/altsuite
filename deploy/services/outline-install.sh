#!/bin/bash
set -e

SERVICE_DIR="$1"
DOMAIN_ARG="$2"
GOOGLE_CLIENT_ID_ARG="${3:-}"
GOOGLE_CLIENT_SECRET_ARG="${4:-}"
POSTGRES_PASSWORD_ARG="${5:-}"

if [ -z "$SERVICE_DIR" ] || [ -z "$DOMAIN_ARG" ]; then
	echo "Usage: $0 <service_dir> <domain> [google_client_id] [google_client_secret]"
	exit 1
fi

if ! command -v docker &>/dev/null; then
	echo "Docker is required. Install Docker and try again."
	exit 1
fi

echo "Setting up Outline Wiki..."
mkdir -p "$SERVICE_DIR"
cd "$SERVICE_DIR"

# Use caller-supplied postgres password if provided; otherwise reuse from existing
# docker.env to avoid a mismatch with an already-initialised postgres volume.
if [ -f "$SERVICE_DIR/docker.env" ]; then
	SECRET_KEY=$(grep '^SECRET_KEY=' "$SERVICE_DIR/docker.env" | cut -d= -f2)
	UTILS_SECRET=$(grep '^UTILS_SECRET=' "$SERVICE_DIR/docker.env" | cut -d= -f2)
	EXISTING_POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' "$SERVICE_DIR/docker.env" | cut -d= -f2)
fi
SECRET_KEY=${SECRET_KEY:-$(openssl rand -hex 32)}
UTILS_SECRET=${UTILS_SECRET:-$(openssl rand -hex 32)}
# Priority: 1) arg from wizard  2) existing docker.env  3) generated
POSTGRES_PASSWORD=${POSTGRES_PASSWORD_ARG:-${EXISTING_POSTGRES_PASSWORD:-$(openssl rand -hex 16)}}

# Write docker.env
cat > docker.env <<EOF
# === Outline ===
SECRET_KEY=$SECRET_KEY
UTILS_SECRET=$UTILS_SECRET
URL=https://$DOMAIN_ARG
PORT=3000
NODE_ENV=production

# === Database ===
DATABASE_URL=postgres://user:${POSTGRES_PASSWORD}@postgres:5432/outline
PGSSLMODE=disable
POSTGRES_USER=user
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=outline

# === Redis ===
REDIS_URL=redis://redis:6379

# === File storage (local) ===
FILE_STORAGE=local
FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data
FILE_STORAGE_UPLOAD_MAX_SIZE=26214400

EOF

# Append Google OAuth credentials if provided
if [ -n "$GOOGLE_CLIENT_ID_ARG" ]; then
	cat >> docker.env <<EOF

# === Auth: Google ===
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID_ARG
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET_ARG
EOF
fi

# Write redis.conf
cat > redis.conf <<'EOF'
# Redis config for Outline
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

# Write docker-compose.yml
cat > docker-compose.yml <<EOF
services:
  outline:
    image: docker.getoutline.com/outlinewiki/outline:latest
    env_file: ./docker.env
    ports:
      - "8890:3000"
    volumes:
      - storage-data:/var/lib/outline/data
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  redis:
    image: redis
    env_file: ./docker.env
    expose:
      - "6379"
    volumes:
      - ./redis.conf:/redis.conf
    command: ["redis-server", "/redis.conf"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 30s
      retries: 3

  postgres:
    image: postgres:18
    env_file: ./docker.env
    expose:
      - "5432"
    volumes:
      - database-data:/var/lib/postgresql
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "pg_isready", "-d", "outline", "-U", "user"]
      interval: 30s
      timeout: 20s
      retries: 3
    environment:
      POSTGRES_USER: 'user'
      POSTGRES_PASSWORD: '${POSTGRES_PASSWORD}'
      POSTGRES_DB: 'outline'

volumes:
  storage-data:
  database-data:
EOF

chown -R altsuite:altsuite "$SERVICE_DIR"

echo "Starting Outline containers..."
docker compose up -d

echo ""
echo "========================================"
echo "Outline running at https://$DOMAIN_ARG (Caddy proxies host port 8890)"
echo "========================================"
