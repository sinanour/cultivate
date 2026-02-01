# Unix Domain Socket Volumes - Critical Implementation Guide

## The Problem

Unix domain sockets are special file types that require native filesystem support. When deploying with Finch on macOS, there's a critical constraint:

**Unix domain sockets CANNOT be created on macOS filesystems mounted into the Finch VM.**

## Why This Happens

1. **Finch runs in a Lima VM**: Containers execute inside a Linux VM, not directly on macOS
2. **Host directories are mounted via 9p/virtio-fs**: These mount protocols don't support all Linux filesystem features
3. **Socket files require special support**: Unix sockets use special file types that don't work across mount boundaries
4. **PostgreSQL fails immediately**: When it tries to create `.s.PGSQL.5432`, it gets "Invalid argument"

## The Error

When using host path mounts for socket directories on macOS, PostgreSQL fails with:

```
LOG:  could not set permissions of file "/var/run/postgresql/.s.PGSQL.5432": Invalid argument
WARNING:  could not create Unix-domain socket in directory "/var/run/postgresql"
FATAL:  could not create any Unix-domain sockets
```

## The Solution

**Use Docker named volumes for socket directories on ALL platforms.**

Named volumes exist inside the VM's native Linux filesystem where Unix sockets work properly.

### Correct Configuration

```yaml
services:
  database:
    volumes:
      - db_socket:/var/run/postgresql  # ✅ Named volume

  backend:
    volumes:
      - db_socket:/var/run/postgresql:rw  # ✅ Same named volume

volumes:
  db_socket:
    driver: local  # VM-internal volume
```

### Incorrect Configuration (Fails on macOS)

```yaml
services:
  database:
    volumes:
      - /Users/username/cultivate/socket:/var/run/postgresql  # ❌ Host path mount

  backend:
    volumes:
      - /Users/username/cultivate/socket:/var/run/postgresql:rw  # ❌ Host path mount
```

## Implementation in Deployment System

The deployment system automatically handles this:

```typescript
function generateDockerComposeFile(version: string, deploymentPaths: DeploymentPathStrategy): string {
    // Socket MUST always be a named volume
    const dbSocketVolume = 'db_socket';
    
    // Data can use host paths on Linux, named volumes on macOS
    const useNamedVolumes = deploymentPaths.targetOS === 'macos';
    const dbDataVolume = useNamedVolumes 
        ? 'db_data' 
        : path.join(deploymentPaths.volumePath, 'db_data');
    
    return `
services:
  database:
    volumes:
      - ${dbDataVolume}:/var/lib/postgresql/data
      - ${dbSocketVolume}:/var/run/postgresql  # Always named volume

volumes:
  db_socket:
    driver: local  # Required for socket support
${useNamedVolumes ? '  db_data:\n    driver: local' : ''}
`;
}
```

## Volume Type Comparison

| Volume Type | Linux Strategy | macOS Strategy | Reason |
|-------------|---------------|----------------|---------|
| Socket | Named volume | Named volume | Unix sockets require native filesystem |
| Data | Host path | Named volume | Host paths easier for backup on Linux; avoid boundary on macOS |
| Logs | Host path | Host path or named | Logs are regular files, work on mounted FS |
| Config | Host path | Host path | Config files are regular files |

## Testing

The implementation includes tests that verify:

1. Socket volumes always use named volumes
2. Data volumes use appropriate strategy for each OS
3. Generated docker-compose.yml has correct volume configuration
4. Path validation catches filesystem boundary issues

## Backup Considerations

### Named Volumes on macOS

Since macOS uses named volumes for data persistence, backups require different commands:

```bash
# List volumes
finch volume ls

# Backup a named volume
finch run --rm -v db_data:/data -v $(pwd):/backup alpine tar czf /backup/db_data.tar.gz -C /data .

# Restore a named volume
finch run --rm -v db_data:/data -v $(pwd):/backup alpine tar xzf /backup/db_data.tar.gz -C /data
```

### Host Paths on Linux

On Linux, data volumes use host paths for easier backup:

```bash
# Backup
tar czf db_data.tar.gz /opt/cultivate/volumes/db_data

# Restore
tar xzf db_data.tar.gz -C /
```

## Troubleshooting

### Socket Creation Fails

**Symptom:**
```
FATAL: could not create any Unix-domain sockets
```

**Check:**
1. Verify socket volume is a named volume, not host path
2. Check docker-compose.yml for volume definition
3. Ensure volume is defined in `volumes:` section

**Fix:**
```yaml
# Change from:
volumes:
  - /path/to/socket:/var/run/postgresql

# To:
volumes:
  - db_socket:/var/run/postgresql

# And add:
volumes:
  db_socket:
    driver: local
```

### Backend Cannot Connect

**Symptom:**
```
Error: P1001: Can't reach database server at `/var/run/postgresql:5432`
```

**Check:**
1. Verify both containers mount the same named volume
2. Check DATABASE_URL uses correct socket path
3. Ensure database container is healthy before backend starts

**Fix:**
```yaml
backend:
  volumes:
    - db_socket:/var/run/postgresql:rw  # Must match database volume name
  environment:
    - DATABASE_URL=postgresql://apiuser@localhost/cultivate?host=/var/run/postgresql
```

## Best Practices

1. **Always use named volumes for sockets** - Never use host path mounts
2. **Use named volumes on macOS for data** - Avoid filesystem boundary issues
3. **Use host paths on Linux for data** - Easier backup and management
4. **Document volume strategy** - Make it clear why each volume type is used
5. **Test on target platform** - Socket issues only appear on actual macOS/Finch deployments

## References

- [PostgreSQL Unix Domain Sockets](https://www.postgresql.org/docs/current/runtime-config-connection.html#GUC-UNIX-SOCKET-DIRECTORIES)
- [Docker Named Volumes](https://docs.docker.com/storage/volumes/)
- [Lima Filesystem Mounts](https://github.com/lima-vm/lima/blob/master/docs/mount.md)
- [Finch Documentation](https://github.com/runfinch/finch)

## Support

If you encounter socket-related issues:

1. Verify you're using named volumes for sockets
2. Check container logs: `finch logs cultivate_database`
3. Inspect volume: `finch volume inspect db_socket`
4. Review this guide's troubleshooting section
5. Contact the deployment team with logs and docker-compose.yml
