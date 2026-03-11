#!/bin/bash
set -e

# AltSuite Installation Script
# Must be run as root/sudo

if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script as root or with sudo"
    exit 1
fi

# Parse arguments
MODE="altsuite"
SERVICE_NAME_ARG=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -ge 1 ]; then
    MODE="service"
    SERVICE_NAME_ARG="$1"
    DOMAIN_ARG="${2:-}"
fi

# ============================================
# ALTSUITE INSTALLATION
# ============================================

if [ "$MODE" = "altsuite" ]; then
    echo "AltSuite Installation Script"
    echo "========================================"

    # Configuration
    INSTALL_USER="altsuite"
    INSTALL_DIR="/opt/altsuite"
    SERVICE_NAME="altsuite"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

    # Create altsuite user if it doesn't exist
    if ! id "$INSTALL_USER" &>/dev/null; then
        echo "Creating $INSTALL_USER user..."
        useradd -r -s /bin/bash -d "$INSTALL_DIR" -m "$INSTALL_USER"
        echo "User $INSTALL_USER created."
    else
        echo "User $INSTALL_USER already exists."
    fi

    # Create installation directory
    echo "Creating installation directory at $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"/{bin,frontend,logs}
    chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR"

    # Set up sudoers configuration
    echo "Configuring sudoers for passwordless Altsuite operations..."
    cp "$SCRIPT_DIR/altsuite.sudoers" /etc/sudoers.d/altsuite
    chmod 0440 /etc/sudoers.d/altsuite

    # Validate sudoers syntax
    if visudo -c -f /etc/sudoers.d/altsuite; then
        echo "Sudoers validated."
    else
        echo "Sudoers has syntax errors. Removing..."
        rm /etc/sudoers.d/altsuite
        exit 1
    fi

    echo "Stopping service (if running)..."
    systemctl stop altsuite 2>/dev/null || true

    echo "Deploying binary..."
    cp -f "$PROJECT_ROOT/api/altsuite" "$INSTALL_DIR/bin/altsuite"
    chmod +x "$INSTALL_DIR/bin/altsuite"
    chown "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/bin/altsuite"
    cp -f "$PROJECT_ROOT/api/supported_apps.json" "$INSTALL_DIR/supported_apps.json"
    chown "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/supported_apps.json"

    echo "Deploying service scripts..."
    mkdir -p "$INSTALL_DIR/deploy/services"
    cp -f "$SCRIPT_DIR/install.sh" "$INSTALL_DIR/deploy/install.sh"
    chmod +x "$INSTALL_DIR/deploy/install.sh"
    cp -f "$SCRIPT_DIR/configure-dashboard.sh" "$INSTALL_DIR/deploy/configure-dashboard.sh"
    chmod +x "$INSTALL_DIR/deploy/configure-dashboard.sh"
    cp -f "$SCRIPT_DIR/services/"*.sh "$INSTALL_DIR/deploy/services/"
    chmod +x "$INSTALL_DIR/deploy/services/"*.sh
    chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/deploy"

    if [ -d "$PROJECT_ROOT/frontend/out" ]; then
        echo "Deploying frontend..."
        rm -rf "$INSTALL_DIR/frontend/*"
        cp -rf "$PROJECT_ROOT/frontend/out/." "$INSTALL_DIR/frontend/"
        chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/frontend"
    fi

    echo "Installing systemd service..."
    cp "$SCRIPT_DIR/altsuite.service" /etc/systemd/system/altsuite.service
    systemctl daemon-reload
    systemctl enable altsuite
    systemctl restart altsuite

    # Optional: set up user management (Postgres + DATABASE_URL) so the Users tab works out of the box
    if [ ! -f "$INSTALL_DIR/env" ] && command -v docker &>/dev/null; then
        echo "Setting up user management (Postgres)..."
        mkdir -p "$INSTALL_DIR/postgres"
        cp -f "$SCRIPT_DIR/altsuite-postgres/docker-compose.yml" "$INSTALL_DIR/postgres/"
        POSTGRES_PASSWORD=$(openssl rand -hex 16)
        echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" > "$INSTALL_DIR/postgres/.env"
        chmod 600 "$INSTALL_DIR/postgres/.env"
        printf "DATABASE_URL=postgres://altsuite:%s@127.0.0.1:5432/altsuite?sslmode=disable\n" "$POSTGRES_PASSWORD" > "$INSTALL_DIR/env"
        chmod 600 "$INSTALL_DIR/env"
        chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/postgres" "$INSTALL_DIR/env"
        (cd "$INSTALL_DIR/postgres" && docker compose up -d)
        echo "Waiting for Postgres to be ready..."
        for _ in $(seq 1 60); do
            status=$(docker inspect altsuite-postgres-postgres-1 --format='{{.State.Health.Status}}' 2>/dev/null)
            if [ "$status" = "healthy" ]; then
                break
            fi
            sleep 1
        done
        if [ "$(docker inspect altsuite-postgres-postgres-1 --format='{{.State.Health.Status}}' 2>/dev/null)" != "healthy" ]; then
            echo "WARNING: Postgres did not become healthy in time. User management may not work."
        fi
        systemctl restart altsuite
        echo "User management enabled (Users tab in the dashboard)."
    elif [ ! -f "$INSTALL_DIR/env" ]; then
        echo "Skipping user management (Docker not found). To enable later: run deploy/altsuite-postgres, create $INSTALL_DIR/env with DATABASE_URL=..., then systemctl restart altsuite."
    fi

    # Install Caddy
    echo "Installing Caddy..."
    if ! command -v caddy &>/dev/null; then
        apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
            | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
            | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update
        apt-get install -y caddy
        echo "Caddy installed."
    else
        echo "Caddy already installed."
    fi

    # Configure Caddy with an import-based layout
    mkdir -p /etc/caddy/conf.d
    cat > /etc/caddy/Caddyfile <<'EOF'
# AltSuite managed Caddyfile
# Global options (uncomment and set email to enable HTTPS):
# {
#     email you@example.com
# }

import /etc/caddy/conf.d/*.caddy
EOF

    # Drop a template for the dashboard — activate by renaming once a domain is set
    cat > /etc/caddy/conf.d/dashboard.caddy.example <<'EOF'
# AltSuite Dashboard
# Rename this file to dashboard.caddy and replace YOUR_DOMAIN:
#
# dashboard.YOUR_DOMAIN {
#     # Proxy API requests to the AltSuite backend
#     handle /api/* {
#         reverse_proxy localhost:8080
#     }
#     # Serve the static frontend
#     handle {
#         root * /opt/altsuite/frontend
#         file_server
#     }
# }
EOF

    systemctl enable caddy
    systemctl start caddy
    echo "Caddy installed and running."

    echo ""
    echo "========================================"
    echo "AltSuite installed successfully."
    echo "========================================"
fi

# ============================================
# SERVICE INSTALLATION
# ============================================

if [ "$MODE" = "service" ]; then
    # Check if AltSuite is installed
    if ! id "altsuite" &>/dev/null; then
        echo "Error: AltSuite must be installed first."
        echo "Run: sudo ./install.sh"
        exit 1
    fi

    SERVICE_NAME="$SERVICE_NAME_ARG"
    SERVICE_DIR="/etc/altsuite/$SERVICE_NAME"

    echo "Install Service: $SERVICE_NAME"
    echo "========================================"

    mkdir -p "$SERVICE_DIR"
    chown altsuite:altsuite "$SERVICE_DIR"

    # Add a reverse-proxy block to Caddy for the given service and reload.
    # Usage: caddy_add_site <full-domain> <upstream> <service-name>
    caddy_add_site() {
        local domain="$1"
        local upstream="$2"
        local service="$3"
        local conf_file="/etc/caddy/conf.d/${service}.caddy"

        if [ -z "$domain" ]; then
            echo "Caddy: no domain provided for $service — skipping Caddy config."
            return
        fi
        if [ -f "$conf_file" ]; then
            echo "Caddy: config for $service already exists at $conf_file — skipping."
            return
        fi

        mkdir -p /etc/caddy/conf.d
        cat > "$conf_file" <<EOF
${domain} {
    reverse_proxy ${upstream}
}
EOF
        echo "Caddy: added ${domain} -> ${upstream}"
        systemctl reload caddy
    }

    case "$SERVICE_NAME" in
        mattermost)
            "$SCRIPT_DIR/services/mattermost-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG" "${3:-}" "${4:-}"
            caddy_add_site "$DOMAIN_ARG" "localhost:8065" "$SERVICE_NAME"
            ;;
        penpot)
            "$SCRIPT_DIR/services/penpot-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
            caddy_add_site "$DOMAIN_ARG" "localhost:9001" "$SERVICE_NAME"
            ;;
        gitea)
            "$SCRIPT_DIR/services/gitea-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
            caddy_add_site "$DOMAIN_ARG" "localhost:3000" "$SERVICE_NAME"
            ;;
        caldotcom)
            "$SCRIPT_DIR/services/caldotcom-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
            caddy_add_site "$DOMAIN_ARG" "localhost:3000" "$SERVICE_NAME"
            ;;
        outline)
            "$SCRIPT_DIR/services/outline-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG" "${3:-}" "${4:-}" "${5:-}"
            caddy_add_site "$DOMAIN_ARG" "localhost:8890" "$SERVICE_NAME"
            ;;
        *)
            echo "Unknown service: $SERVICE_NAME"
            echo "Supported services: mattermost, penpot, gitea, caldotcom, outline"
            exit 1
            ;;
    esac

    echo ""
    echo "========================================"
    echo "Service $SERVICE_NAME installed."
    echo "========================================"
fi
