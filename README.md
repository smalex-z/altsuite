# AltSuite

**Free Open Source Software Hub & Monitoring Solution**

AltSuite is a self-hosted platform for managing and monitoring your FOSS installations. Track resource usage, manage updates, and keep all your open source tools in one place.

## Features

- **Real-time Resource Monitoring** - CPU, memory, disk usage for all installed FOSS applications
- **Centralized Dashboard** - Manage all your open source software from a single interface
- **Easy Installation** - Automated setup scripts for quick deployment
- **Lightweight** - Minimal resource footprint, written in Go
- **Modern Web UI** - Clean React-based interface

## Project Structure

```
/frontend    - React web application
/api         - Golang backend server
/deploy      - Installation and deployment scripts
```

## Tech Stack

- **Frontend**: React, Next.js
- **Backend**: Go
- **Deployment**: Single binary + static files

## Quick Start

### Prerequisites

Ensure you have the following installed on your system: (Commands for Ubuntu)
- **Go 1.21+**: `sudo apt install golang-go`
- **Node.js 18+**: [Download](https://nodejs.org/) or use `nvm`

### Production Deployment

**Prerequisites:**
- Ubuntu/Debian Linux system
- Go 1.21+ installed (for building)
- Node.js 18+ installed (for building frontend)

**Deploy Steps:**


Quick Install: (Frowned upon for security reasons)
```bash
curl -fsSL https://raw.githubusercontent.com/smalex-z/altsuite/main/deploy/quick-install.sh | bash
```
(Enter Sudo Password when prompted!)

OR

Manual install:
```bash
# 1. Run the build script
git clone https://github.com/smalex-z/altsuite.git
cd ../deploy
chmod +x ./build.sh
./build.sh
sudo ./install.sh
```

**What the installer does:**
- Creates `altsuite` system user
- Installs sudoers configuration for passwordless privileged operations
- Copies binaries to `/opt/altsuite`
- Creates and enables systemd service
- Sets up proper permissions and security

**Managing the Service:**

```bash
# Start AltSuite
sudo systemctl start altsuite

# Check status
sudo systemctl status altsuite

# View logs
sudo journalctl -u altsuite -f

# Stop service
sudo systemctl stop altsuite
```

The API will be available at `http://localhost:8080`

**Security Note:** The installation configures passwordless sudo for specific operations (systemctl, apt-get, docker) limited to the `altsuite` user only. See `/etc/sudoers.d/altsuite` after installation.

### Development:

#### Frontend:
Install Packages first:

```bash
cd frontend
npm install
```

Start the server
```bash
cd frontend
npm run dev
```

#### API:
Install Packages first:

```bash
cd api
go mod download
```

Start the server
```
cd api
go run main.go
```

## Requirements

- **Development**: Go 1.21+, Node.js 18+
- **Production**: Linux system (systemd recommended)


## Contributors

smalex-z, nathanzhang1, SamuelLo1, alexshells, usecymk

For any questions, email altsuiteco@gmail.com
