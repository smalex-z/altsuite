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

### Production Deployment

```bash
## TODO:
```

## Requirements

- **Development**: Go 1.21+, Node.js 18+
- **Production**: Linux system (systemd recommended)


## Contributors

smalex-z, nathanzhang1, SamuelLo1, alexshells, usecymk

For any questions, email altsuiteco@gmail.com
