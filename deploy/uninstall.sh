#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script as root or with sudo"
    exit 1
fi

# Parse arguments
MODE="altsuite"
SERVICE_NAME_ARG=""

if [ $# -eq 1 ]; then
    MODE="service"
    SERVICE_NAME_ARG="$1"
fi

# ============================================
# SERVICE UNINSTALLATION
# ============================================

if [ "$MODE" = "service" ]; then
    SERVICE_NAME="$SERVICE_NAME_ARG"
    SERVICE_DIR="/etc/altsuite/$SERVICE_NAME"

    echo "Uninstall Service: $SERVICE_NAME"
    echo "========================================"

    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "Stopping $SERVICE_NAME..."
        systemctl stop "$SERVICE_NAME" || true
    fi

    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "Disabling $SERVICE_NAME..."
        systemctl disable "$SERVICE_NAME" || true
    fi

    if [ -d "$SERVICE_DIR" ]; then
        case "$SERVICE_NAME" in
            mattermost)
                echo "Stopping Mattermost containers..."
                cd "$SERVICE_DIR"
                docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml down || true
                read -p "Remove all Mattermost data/volumes? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    rm -rf "$SERVICE_DIR/volumes"
                fi
                ;;
        esac
        echo "Removing service directory $SERVICE_DIR..."
        rm -rf "$SERVICE_DIR"
    else
        echo "Service directory $SERVICE_DIR not found."
    fi

    echo ""
    echo "========================================"
    echo "Service $SERVICE_NAME removed."
    echo "========================================"
fi

# ============================================
# ALTSUITE UNINSTALLATION
# ============================================

if [ "$MODE" = "altsuite" ]; then
    echo "AltSuite Uninstall Script"
    echo "========================================"

    INSTALL_USER="altsuite"
    INSTALL_DIR="/opt/altsuite"
    SERVICE_NAME="altsuite"

    echo "Stopping and disabling service..."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true

    echo "Removing systemd service..."
    rm -f /etc/systemd/system/${SERVICE_NAME}.service
    systemctl daemon-reload

    echo "Removing sudoers configuration..."
    rm -f /etc/sudoers.d/altsuite

    echo "Removing installation directory..."
    rm -rf "$INSTALL_DIR"

    read -p "Remove $INSTALL_USER user? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing $INSTALL_USER user..."
        userdel "$INSTALL_USER" 2>/dev/null || true
    else
        echo "Keeping $INSTALL_USER user."
    fi

    echo ""
    echo "========================================"
    echo "AltSuite has been uninstalled."
    echo "========================================"
fi
