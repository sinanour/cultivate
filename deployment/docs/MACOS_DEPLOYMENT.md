# macOS Deployment Guide

## Overview

Deploying to macOS targets requires special consideration due to how Finch (the container runtime for macOS) operates. This guide explains two critical issues and their solutions:

1. **Filesystem Boundary**: Finch VM only mounts certain directories
2. **Port Forwarding**: Finch VM only forwards ports to localhost by default

## Critical Issue: Port Forwarding on macOS

### The Problem

**Even though the deployment system correctly configures docker-compose.yml with `0.0.0.0` port bindings, Finch's Lima VM only forwards ports to localhost (127.0.0.1) by default.**

This means:
- ✅ Application accessible from macOS host: `http://localhost:8080`
- ❌ Application NOT accessible from external machines: `http://hostname:8080`

### The Solution

**Before deploying to a macOS production host, configure Lima port forwarding.**

#### Quick Fix: Run the Configuration Script

We provide a script that automatically configures Finch port forwarding:

```bash
# On the macOS target host, run:
./deployment/scripts/configure-finch-ports.sh 8080 1443

# Or with default ports (80, 443):
./deployment/scripts/configure-finch-ports.sh
```

This script will:
1. ✅ Backup your existing Finch configuration
2. ✅ Configure port forwarding to 0.0.0.0
3. ✅ Restart the Finch VM to apply changes
4. ✅ Verify the configuration

#### Manual Configuration

If you prefer to configure manually, edit `~/.finch/finch.yaml`:

```yaml
# Add or modify the portForwards section
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
  # HTTP port - bind to all interfaces
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
  # HTTPS port - bind to all interfaces
  - guestPort: 443
    hostIP: "0.0.0.0"
    hostPort: 1443
```

Then restart Finch VM:

```bash
finch vm stop
finch vm start
```

### Verification

After configuration, verify external access:

```bash
# From another machine on the network:
curl http://macos-hostname:8080

# Or from the macOS host itself:
curl http://$(hostname):8080
```

## The Finch VM Filesystem Boundary

### What is the Issue?

Finch on macOS runs containers inside a Lima-managed Linux VM. This creates a filesystem boundary between the macOS host and the Linux VM where containers actually execute:

```
┌─────────────────────────────────────────────────────────┐
│                    macOS Host                           │
│                                                         │
│  /Users/username/  ✅ Mounted in VM                     │
│  /opt/cultivate/   ❌ NOT mounted in VM                 │
│  /var/log/         ❌ NOT mounted in VM                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Lima Linux VM (Finch)                   │ │
│  │                                                   │ │
│  │  Only sees:                                       │ │
│  │  - /Users (mounted from host)                     │ │
│  │  - Sometimes /Volumes (if configured)             │ │
│  │  - VM-internal paths only                         │ │
│  │                                                   │ │
│  │  Containers run HERE, not on macOS host          │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Why This Matters

1. **File paths passed to `finch compose` must exist inside the VM**, not just on the macOS host
2. **Default VM mounts**: Lima typically only mounts `/Users` and sometimes `/Volumes` into the VM
3. **Paths like `/opt` are NOT mounted** by default, so `/opt/cultivate` appears as "no such file or directory" inside the VM
4. **This is NOT a permissions issue** - `chown` and `chmod` on the host won't help because the path doesn't exist in the VM filesystem

## Automatic Path Handling

The deployment system automatically detects macOS targets and uses appropriate paths:

### Linux Deployment Paths (Standard FHS)

```
/opt/cultivate/              # Base deployment directory
/opt/cultivate/config/       # Configuration files
/var/log/cultivate/          # Log files
/opt/cultivate/volumes/      # Docker volumes
```

### macOS Deployment Paths (Home Directory)

```
/Users/username/cultivate/           # Base deployment directory
/Users/username/cultivate/config/    # Configuration files
/Users/username/cultivate/logs/      # Log files
/Users/username/cultivate/volumes/   # Docker volumes
```

## Deployment Examples

### Successful macOS Deployment

```bash
# Deploy to macOS target
npm run deploy -- user@macos-host.local

# The system will automatically:
# 1. Detect macOS
# 2. Use /Users/username/cultivate paths
# 3. Generate docker-compose.yml with VM-accessible paths
# 4. Deploy successfully
```

### What Happens Behind the Scenes

1. **OS Detection**: System detects macOS using `uname` command
2. **Path Selection**: Automatically selects home directory paths
3. **Path Validation**: Validates all paths are VM-accessible
4. **Configuration Generation**: Generates docker-compose.yml with correct paths
5. **Deployment**: Transfers files and starts containers

## Manual Path Configuration

If you need to use custom paths, ensure they're under VM-mounted directories:

### Valid Paths for macOS

✅ `/Users/username/custom-path`
✅ `/Volumes/External/cultivate`
✅ `~/cultivate` (expands to /Users/username/cultivate)

### Invalid Paths for macOS

❌ `/opt/cultivate` (not mounted in VM)
❌ `/var/log/cultivate` (not mounted in VM)
❌ `/etc/cultivate` (not mounted in VM)
❌ `/usr/local/cultivate` (not mounted in VM)

## Troubleshooting

### Error: "no such file or directory" on macOS

**Symptom**: Finch compose fails with "no such file or directory" error

**Cause**: Paths are not accessible inside the Finch VM

**Solution**: The deployment system should handle this automatically. If you see this error:

1. Check that you're using the latest deployment script
2. Verify the deployment paths are under `/Users`
3. Check the deployment logs for path validation errors

### Ports Only Accessible on Localhost (127.0.0.1)

**Symptom**: Application is accessible from the macOS host at `http://localhost:8080` but not from external machines at `http://hostname:8080`

**Cause**: Finch's Lima VM only forwards ports to localhost by default, even when docker-compose specifies `0.0.0.0`

**Solution**: Configure Lima to forward ports to all interfaces

#### Option 1: Configure Lima Port Forwarding (Recommended)

Edit `~/.finch/finch.yaml` on the target macOS host:

```yaml
# Add or modify the portForwards section
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
  # Add explicit port forwards for your application
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
  - guestPort: 443
    hostIP: "0.0.0.0"
    hostPort: 1443
```

Then restart Finch VM:

```bash
finch vm stop
finch vm start
```

#### Option 2: Use SSH Port Forwarding

If you can't modify Lima configuration, use SSH port forwarding:

```bash
# On a machine that can access the macOS host
ssh -L 8080:localhost:8080 user@macos-host.local
ssh -L 1443:localhost:1443 user@macos-host.local
```

#### Option 3: Use Nginx Reverse Proxy on Host

Install Nginx on the macOS host to proxy to the Finch VM:

```bash
# Install Nginx on macOS
brew install nginx

# Configure Nginx to proxy to localhost:8080
# Edit /opt/homebrew/etc/nginx/nginx.conf
```

**Note**: This is a Finch/Lima limitation, not a Docker Compose issue. The deployment system correctly specifies `0.0.0.0` in the compose file, but Lima's network configuration overrides this.

### Using /opt Paths on macOS (Advanced)

If you must use `/opt` paths on macOS, you have two options:

#### Option 1: Symlink (Recommended)

Create a symlink from your home directory to `/opt`:

```bash
# On the macOS target
sudo mkdir -p /opt
sudo ln -s /Users/username/cultivate /opt/cultivate

# Then deploy using the symlink
# The deployment system will use ~/cultivate which points to /opt/cultivate
```

#### Option 2: Configure Lima Mounts (Advanced)

Edit `~/.finch/finch.yaml` on the target host:

```yaml
mounts:
  - location: /Users
    writable: true
  - location: /opt
    writable: true
  - location: /Volumes
    writable: true
```

Then restart Finch VM:

```bash
finch vm stop
finch vm start
```

**Warning**: This requires manual configuration on each target host and may have security implications.

## Docker Compose Configuration

The deployment system generates different docker-compose.yml files based on the target OS:

### Linux docker-compose.yml

```yaml
services:
  database:
    volumes:
      - /opt/cultivate/volumes/db_data:/var/lib/postgresql/data  # Host path
      - db_socket:/var/run/postgresql  # Named volume (required for sockets)

volumes:
  db_socket:
    driver: local
```

### macOS docker-compose.yml

```yaml
services:
  database:
    volumes:
      - db_data:/var/lib/postgresql/data  # Named volume
      - db_socket:/var/run/postgresql  # Named volume (required for sockets)

volumes:
  db_data:
    driver: local
  db_socket:
    driver: local
```

### Why Named Volumes for Sockets?

**Critical Constraint:** Unix domain sockets CANNOT be created on macOS filesystems mounted into the Finch VM.

Even if you use a path under `/Users` that's accessible in the VM, PostgreSQL will fail with:

```
could not set permissions of file "/var/run/postgresql/.s.PGSQL.5432": Invalid argument
FATAL: could not create any Unix-domain sockets
```

**Solution:** Always use Docker named volumes for socket directories. Named volumes exist inside the VM's native Linux filesystem where Unix sockets work properly.

**Impact:**
- Socket volumes: MUST use named volumes on all platforms
- Data volumes: Can use host paths on Linux (easier backups), named volumes on macOS

## Best Practices

1. **Let the system handle paths automatically** - Don't override deployment paths unless necessary
2. **Use home directory paths on macOS** - They're guaranteed to be VM-accessible
3. **Test deployments** - Always test on a staging macOS host before production
4. **Monitor disk space** - Home directories may have different quotas than system directories
5. **Document custom configurations** - If you use symlinks or custom Lima mounts, document them

## Finch Installation

If Finch is not installed on the target macOS system, install it using Homebrew:

```bash
# Install Finch
brew install --cask finch

# Initialize Finch VM
finch vm init

# Verify installation
finch --version
finch ps
```

## Additional Resources

- [Finch Documentation](https://github.com/runfinch/finch)
- [Lima Documentation](https://github.com/lima-vm/lima)
- [Design Document: Component 3.2](../design.md#component-32-macosfinch-filesystem-boundary-constraints)

## Support

If you encounter issues with macOS deployment:

1. Check the deployment logs for path validation errors
2. Verify Finch is installed and initialized: `finch vm status`
3. Confirm paths are under `/Users`: `ls -la ~/cultivate`
4. Review this guide's troubleshooting section
5. Contact the deployment team with logs and error messages
