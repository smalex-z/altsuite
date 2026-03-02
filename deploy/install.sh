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
            "$SCRIPT_DIR/services/mattermost-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
            ;;
        penpot)
            "$SCRIPT_DIR/services/penpot-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
            ;;
        gitea)
            "$SCRIPT_DIR/services/gitea-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
            ;;
        caldotcom)
            "$SCRIPT_DIR/services/caldotcom-install.sh" "$SERVICE_DIR" "$DOMAIN_ARG"
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
