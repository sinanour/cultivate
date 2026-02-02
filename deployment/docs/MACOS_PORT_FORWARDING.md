# macOS Port Forwarding Quick Reference

## The Issue

When deploying to macOS with Finch, ports are only accessible on localhost (127.0.0.1), not from external machines, even though docker-compose.yml correctly specifies `0.0.0.0`.

**Symptom:**
```bash
# On the macOS host - WORKS
curl http://localhost:8080

# From another machine - FAILS
curl http://macos-hostname:8080
# Connection refused or timeout
```

## The Cause

Finch uses Lima VM to run containers. Lima's default network configuration only forwards ports to localhost, overriding the docker-compose port binding.

## The Solution

Configure Lima to forward ports to all network interfaces (0.0.0.0).

### Option 1: Automated Script (Recommended)

```bash
# On the macOS target host:
./deployment/scripts/configure-finch-ports.sh 8080 1443
```

This automatically:
- Backs up existing configuration
- Configures port forwarding
- Restarts Finch VM
- Verifies the setup

### Option 2: Manual Configuration

1. Edit `~/.finch/finch.yaml` on the macOS host:

```yaml
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
  - guestPort: 443
    hostIP: "0.0.0.0"
    hostPort: 1443
```

2. Restart Finch VM:

```bash
finch vm stop
finch vm start
```

### Option 3: SSH Port Forwarding (Temporary)

If you can't modify Lima configuration:

```bash
# From your local machine:
ssh -L 8080:localhost:8080 user@macos-host
ssh -L 1443:localhost:1443 user@macos-host
```

## Deployment Workflow for macOS

### Step 1: Configure Port Forwarding (One-time setup)

```bash
# SSH to macOS host
ssh user@macos-host

# Run configuration script
./configure-finch-ports.sh 8080 1443

# Verify
curl http://$(hostname):8080
```

### Step 2: Deploy Application

```bash
# From your local machine:
cd deployment
npm run deploy -- user@macos-host
```

### Step 3: Verify External Access

```bash
# From another machine:
curl http://macos-hostname:8080
```

## Troubleshooting

### Ports Still Not Accessible

1. **Check Finch configuration:**
   ```bash
   cat ~/.finch/finch.yaml
   # Verify portForwards section exists with hostIP: "0.0.0.0"
   ```

2. **Check Finch VM status:**
   ```bash
   finch vm status
   # Should show "running"
   ```

3. **Restart Finch VM:**
   ```bash
   finch vm stop
   finch vm start
   ```

4. **Check macOS firewall:**
   ```bash
   # System Preferences → Security & Privacy → Firewall
   # Ensure ports 8080 and 1443 are allowed
   ```

5. **Verify port binding inside VM:**
   ```bash
   finch exec cultivate_frontend netstat -tlnp | grep :80
   # Should show 0.0.0.0:80
   ```

### Configuration Not Applied

If changes to `finch.yaml` don't take effect:

```bash
# Stop VM completely
finch vm stop

# Remove VM (WARNING: This deletes all containers and images)
finch vm remove

# Reinitialize with new config
finch vm init

# Redeploy application
```

### Alternative: Use Docker Instead

If Finch port forwarding is problematic, consider using Docker Desktop on macOS instead:

```bash
# Install Docker Desktop
brew install --cask docker

# Docker Desktop handles port forwarding correctly by default
```

## Why This Happens

This is a known limitation of Lima (the VM technology Finch uses):
- Lima is designed for local development, not production hosting
- Default configuration prioritizes security (localhost only)
- Production deployments require explicit port forwarding configuration

## References

- [Lima Port Forwarding Documentation](https://github.com/lima-vm/lima/blob/master/docs/network.md)
- [Finch Configuration Reference](https://github.com/runfinch/finch/blob/main/finch.yaml)
- [Full macOS Deployment Guide](MACOS_DEPLOYMENT.md)

## Summary

✅ **Before deploying to macOS:** Run `./configure-finch-ports.sh` on the target host
✅ **The deployment system:** Correctly configures docker-compose.yml with 0.0.0.0
✅ **Lima VM configuration:** Must be updated separately for external access
✅ **One-time setup:** Configuration persists across deployments
