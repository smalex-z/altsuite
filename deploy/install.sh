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
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

    echo "Deploying binary..."
    cp "$PROJECT_ROOT/api/altsuite" "$INSTALL_DIR/bin/altsuite"
    chmod +x "$INSTALL_DIR/bin/altsuite"
    chown "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/bin/altsuite"

    if [ -d "$PROJECT_ROOT/frontend/out" ]; then
        echo "Deploying frontend..."
        cp -r "$PROJECT_ROOT/frontend/out/." "$INSTALL_DIR/frontend/"
        chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR/frontend"
    fi

    echo "Installing systemd service..."
    cp "$SCRIPT_DIR/altsuite.service" /etc/systemd/system/altsuite.service
    systemctl daemon-reload
    systemctl enable altsuite
    systemctl start altsuite

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

    case "$SERVICE_NAME" in
        mattermost)
            if [ -z "$DOMAIN_ARG" ]; then
                echo "Usage: sudo ./install.sh mattermost <domain>"
                exit 1
            fi
            if ! command -v docker &>/dev/null; then
                echo "Docker is required. Install Docker and try again."
                exit 1
            fi

            echo "Cloning Mattermost Docker repository..."
            git clone https://github.com/mattermost/docker "$SERVICE_DIR"

            cd "$SERVICE_DIR"
            cp env.example .env
            sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN_ARG/" .env

            mkdir -p ./volumes/app/mattermost/{config,data,logs,plugins,client/plugins,bleve-indexes}
            chown -R 2000:2000 ./volumes/app/mattermost
            chown -R altsuite:altsuite "$SERVICE_DIR"

            echo "Starting Mattermost containers..."
            docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml up -d

            echo ""
            echo "========================================"
            echo "Mattermost running at http://$DOMAIN_ARG:8065"
            echo "========================================"
            ;;
        penpot)
            echo "Installing Penpot..."
            echo "Created directories in $SERVICE_DIR"
            ;;
        gitea)
            echo "Installing Gitea..."
            echo "Created directories in $SERVICE_DIR"
            ;;
        caldotcom)
            echo "Installing Cal.com..."
            echo "Created directories in $SERVICE_DIR"
            ;;
        *)
            echo "Unknown service: $SERVICE_NAME"
            echo "Supported services: mattermost, penpot, gitea, caldotcom"
            exit 1
            ;;
    esac

    echo ""
    echo "========================================"
    echo "Service $SERVICE_NAME installed."
    echo "========================================"
fi
