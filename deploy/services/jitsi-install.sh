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

if ! command -v dig &>/dev/null; then
	echo "Installing dnsutils for IP resolution..."
	apt-get install -y dnsutils
fi

if ! command -v unzip &>/dev/null; then
	echo "Installing unzip..."
	apt-get install -y unzip
fi

# Resolve the public IP from the domain name
PUBLIC_IP=$(dig +short "$DOMAIN_ARG" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | tail -1)
if [ -z "$PUBLIC_IP" ]; then
	echo "ERROR: Could not resolve an IPv4 address for $DOMAIN_ARG"
	echo "Make sure your DNS A record is pointing to this server before installing Jitsi Meet."
	exit 1
fi
echo "Resolved $DOMAIN_ARG -> $PUBLIC_IP"

mkdir -p "$SERVICE_DIR"
cd "$SERVICE_DIR"

echo "Downloading latest Jitsi Meet Docker release..."
RELEASE_ZIP_URL=$(wget -q -O - https://api.github.com/repos/jitsi/docker-jitsi-meet/releases/latest | grep zipball_url | cut -d'"' -f4)
if [ -z "$RELEASE_ZIP_URL" ]; then
	echo "ERROR: Could not fetch Jitsi release URL from GitHub API."
	echo "This is usually a network or rate-limit issue. Check connectivity and try again."
	exit 1
fi
wget -O jitsi-release.zip "$RELEASE_ZIP_URL"
unzip -o jitsi-release.zip
# The zipball extracts into a directory named jitsi-docker-jitsi-meet-<hash> — move contents up
EXTRACTED_DIR=$(ls -d jitsi-docker-jitsi-meet-* 2>/dev/null | head -1)
if [ -n "$EXTRACTED_DIR" ] && [ -d "$EXTRACTED_DIR" ]; then
	mv "$EXTRACTED_DIR"/* "$EXTRACTED_DIR"/.* . 2>/dev/null || true
	rm -rf "$EXTRACTED_DIR"
fi
rm -f jitsi-release.zip

# Create .env from the bundled example
cp env.example .env

# Core settings
sed -i "s|#\?PUBLIC_URL=.*|PUBLIC_URL=https://${DOMAIN_ARG}|" .env
sed -i "s|#\?HTTP_PORT=.*|HTTP_PORT=8000|" .env
sed -i "s|#\?HTTPS_PORT=.*|HTTPS_PORT=8443|" .env

# Disable Jitsi's built-in HTTPS — Caddy handles TLS
sed -i "s|#\?DISABLE_HTTPS=.*|DISABLE_HTTPS=1|" .env
sed -i "s|#\?ENABLE_HTTP_REDIRECT=.*|ENABLE_HTTP_REDIRECT=0|" .env
sed -i "s|#\?ENABLE_LETSENCRYPT=.*|ENABLE_LETSENCRYPT=0|" .env

# Bind web container to localhost only (Caddy proxies in)
sed -i 's|^\(\s*\)- "${HTTP_PORT}:80"|\1- "127.0.0.1:${HTTP_PORT}:80"|' docker-compose.yml || true
sed -i 's|^\(\s*\)- "${HTTPS_PORT}:443"|\1- "127.0.0.1:${HTTPS_PORT}:443"|' docker-compose.yml || true

# Remap JVB colibri/health port away from 8080 (altsuite uses 8080)
sed -i "s|#\?JVB_COLIBRI_PORT=.*|JVB_COLIBRI_PORT=18080|" .env
grep -q "^JVB_COLIBRI_PORT=" .env || echo "JVB_COLIBRI_PORT=18080" >> .env
# Also remove the binding line in case docker-compose.yml hardcodes 127.0.0.1:8080
sed -i '/127\.0\.0\.1.*8080.*8080/d' docker-compose.yml || true

# Move JVB off the default 10000 port
grep -q "^JVB_PORT=" .env && sed -i "s|^JVB_PORT=.*|JVB_PORT=10001|" .env || echo "JVB_PORT=10001" >> .env

# Set JVB advertise IP (needed for NAT/reverse-proxy setups)
grep -q "^JVB_ADVERTISE_IPS=" .env && sed -i "s|^JVB_ADVERTISE_IPS=.*|JVB_ADVERTISE_IPS=${PUBLIC_IP}|" .env || echo "JVB_ADVERTISE_IPS=${PUBLIC_IP}" >> .env

# Generate strong internal passwords
./gen-passwords.sh

# Create required config directories
mkdir -p ~/.jitsi-meet-cfg/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri}
# Store cfg path in .env
sed -i "s|#\?CONFIG=.*|CONFIG=${SERVICE_DIR}/.jitsi-meet-cfg|" .env
mkdir -p "$SERVICE_DIR/.jitsi-meet-cfg"/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri}

chown -R altsuite:altsuite "$SERVICE_DIR"

echo "Starting Jitsi Meet containers..."
docker compose up -d

echo ""
echo "========================================"
echo "Jitsi Meet running at https://$DOMAIN_ARG (Caddy proxies localhost:8000)"
echo "IMPORTANT: UDP port 10001 must be open on your firewall/router."
echo "========================================"
