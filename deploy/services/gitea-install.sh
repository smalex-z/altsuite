#!/bin/bash
set -e

SERVICE_DIR="$1"
DOMAIN_ARG="$2"
POSTGRES_PASSWORD_ARG="${3:-}"

if [ -z "$SERVICE_DIR" ] || [ -z "$DOMAIN_ARG" ]; then
	echo "Usage: $0 <service_dir> <domain> [postgres_password]"
	exit 1
fi

if ! command -v docker &>/dev/null; then
	echo "Docker is required. Install Docker and try again."
	exit 1
fi

# Generate a strong random password if none was provided
if [ -z "$POSTGRES_PASSWORD_ARG" ]; then
	POSTGRES_PASSWORD_ARG=$(openssl rand -hex 16)
fi

mkdir -p "$SERVICE_DIR"

cat > "$SERVICE_DIR/docker-compose.yml" <<EOF
version: "3"

networks:
  gitea:
    external: false

services:
  server:
    image: docker.gitea.com/gitea:1.25.4
    container_name: gitea
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__database__DB_TYPE=postgres
      - GITEA__database__HOST=db:5432
      - GITEA__database__NAME=gitea
      - GITEA__database__USER=gitea
      - GITEA__database__PASSWD=${POSTGRES_PASSWORD_ARG}
      - GITEA__server__DOMAIN=${DOMAIN_ARG}
      - GITEA__server__ROOT_URL=https://${DOMAIN_ARG}/
      - GITEA__server__HTTP_PORT=3080
      - GITEA__server__LOCAL_ROOT_URL=http://localhost:3080/
      - GITEA__server__SSH_PORT=222
    restart: always
    networks:
      - gitea
    volumes:
      - ./gitea:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "127.0.0.1:3080:3080"
      - "222:22"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: docker.io/library/postgres:14
    restart: always
    environment:
      - POSTGRES_USER=gitea
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD_ARG}
      - POSTGRES_DB=gitea
    networks:
      - gitea
    volumes:
      - ./postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "gitea"]
      interval: 10s
      timeout: 5s
      retries: 5
EOF

chown -R altsuite:altsuite "$SERVICE_DIR"

echo "Starting Gitea containers..."
cd "$SERVICE_DIR"
docker compose up -d

echo ""
echo "========================================"
echo "Gitea running at https://$DOMAIN_ARG (Caddy proxies host port 3000)"
echo "Visit https://$DOMAIN_ARG to complete the setup wizard."
echo "========================================"
