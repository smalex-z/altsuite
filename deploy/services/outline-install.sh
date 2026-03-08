#!/bin/bash
set -e

SERVICE_DIR="$1"
DOMAIN_ARG="$2"

if [ -z "$SERVICE_DIR" ] || [ -z "$DOMAIN_ARG" ]; then
	echo "Usage: $0 <service_dir> <domain>"
	exit 1
fi

if ! command -v docker &>/dev/null; then
	echo "Docker is required. Install Docker and try again."
	exit 1
fi

echo "Setting up Outline Wiki..."
mkdir -p "$SERVICE_DIR"
cd "$SERVICE_DIR"

# Generate secure keys
SECRET_KEY=$(openssl rand -hex 32)
UTILS_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Write docker.env
cat > docker.env <<EOF
# === Outline ===
SECRET_KEY=$SECRET_KEY
UTILS_SECRET=$UTILS_SECRET
URL=http://$DOMAIN_ARG
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

# === Auth: configure at least one provider ===
# Slack:
# SLACK_CLIENT_ID=
# SLACK_CLIENT_SECRET=
# Google:
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# Email/password (SMTP required):
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USERNAME=
# SMTP_PASSWORD=
# SMTP_FROM_EMAIL=
# SMTP_REPLY_EMAIL=
EOF

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
      - "3000:3000"
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
echo "Outline running at http://$DOMAIN_ARG (HTTPS handled by your gateway)"
echo ""
echo "IMPORTANT: Before users can log in you must configure"
echo "at least one auth provider in:"
echo "  $SERVICE_DIR/docker.env"
echo "Then restart with: docker compose -f $SERVICE_DIR/docker-compose.yml restart outline"
echo "========================================"
