# macOS/Finch Filesystem Boundary Implementation Summary

## Overview

This document summarizes the implementation of macOS/Finch filesystem boundary handling in the production deployment system, including the critical Unix domain socket volume constraint.

## Problem Statement

Finch on macOS runs containers inside a Lima-managed Linux VM, creating two critical issues:

1. **Filesystem Boundary**: Only certain host directories (typically `/Users` and `/Volumes`) are mounted into the VM. Paths like `/opt`, `/var`, and `/etc` are NOT accessible inside the VM.

2. **Unix Socket Constraint**: Unix domain sockets CANNOT be created on macOS filesystems mounted into the VM, even if the directory is accessible. PostgreSQL fails with "Invalid argument" when trying to create sockets on mounted filesystems.

## Solution

Implemented automatic OS-specific path selection and volume strategy:

**Path Strategy:**
- **Linux**: Standard FHS paths (`/opt/cultivate`, `/var/log/cultivate`)
- **macOS**: Home directory paths (`/Users/username/cultivate`)

**Volume Strategy:**
- **Socket volumes**: ALWAYS use Docker named volumes (Unix sockets don't work on mounted filesystems)
- **Data volumes on Linux**: Use host paths for easier backup/management
- **Data volumes on macOS**: Use named volumes to avoid filesystem boundary issues

## Implementation Details

### 1. New Deployment Paths Module (`deployment-paths.ts`)

Created a new utility module that provides:

- `getDeploymentPaths()`: Returns OS-appropriate deployment paths
- `validateMacOSPaths()`: Validates paths are VM-accessible on macOS
- `expandHomePath()`: Expands `~` to actual home directory
- `getComposeVolumePaths()`: Generates volume paths for docker-compose
- `getUsername()`: Gets username from SSH or environment
- `logDeploymentPaths()`: Logs path configuration for debugging

**Key Features:**
- Automatic OS detection and path selection
- Validation of macOS paths before deployment
- Helpful error messages with solutions
- Support for both `/Users` and `/Volumes` on macOS

### 2. Updated Volume Strategy

**generateDockerComposeFile() Function:**

```typescript
function generateDockerComposeFile(version: string, deploymentPaths: DeploymentPathStrategy): string {
    // For macOS, use named volumes for both data and socket
    // For Linux, use host path for data (easier backup) and named volume for socket
    const useNamedVolumes = deploymentPaths.targetOS === 'macos';
    
    const dbDataVolume = useNamedVolumes 
        ? 'db_data'  // Named volume on macOS
        : path.join(deploymentPaths.volumePath, 'db_data');  // Host path on Linux
    
    // Socket MUST always be a named volume (Unix sockets don't work on mounted filesystems)
    const dbSocketVolume = 'db_socket';
    
    // Generate compose file with appropriate volume configuration...
}
```

**Why This Works:**

- **Named volumes are VM-internal**: They exist in the VM's native Linux filesystem
- **Native filesystem supports sockets**: Unix domain sockets work properly
- **No filesystem boundary**: Named volumes never cross the macOS → VM boundary

### 3. Updated Modules

#### `config-transfer.ts`
- Added `isPathInaccessibleOnMacOS()` method
- Updated `ensureRemoteDirectory()` to validate macOS paths
- Provides clear error messages when paths are inaccessible

#### `deploy.ts` (Deployment Workflow)
- Updated `checkAndInstallDependencies()` to detect OS and return deployment paths
- Updated `deployConfiguration()` to accept and use deployment paths
- Updated `generateDockerComposeFile()` to use named volumes for sockets
- Added path validation before deployment starts

### 4. Comprehensive Tests

Created `deployment-paths.test.ts` with 23 test cases covering:
- Linux path generation
- macOS path generation with and without username
- Path validation for VM accessibility
- Rejection of inaccessible paths (`/opt`, `/var`, `/etc`)
- Acceptance of accessible paths (`/Users`, `/Volumes`)
- Path expansion and helper functions
- Integration scenarios

**Test Results:** ✅ All 23 tests passing (453 total tests passing)

### 5. Documentation

Created comprehensive documentation:
- `MACOS_DEPLOYMENT.md`: User-facing deployment guide with socket volume explanation
- `MACOS_IMPLEMENTATION_SUMMARY.md`: This technical summary
- Updated design document with Component 3.2 and volume strategy

## Files Changed

### New Files
- `deployment/src/utils/deployment-paths.ts` (new module)
- `deployment/src/utils/deployment-paths.test.ts` (tests)
- `deployment/docs/MACOS_DEPLOYMENT.md` (user guide)
- `deployment/docs/MACOS_IMPLEMENTATION_SUMMARY.md` (this file)

### Modified Files
- `deployment/src/utils/config-transfer.ts` (path validation)
- `deployment/src/workflows/deploy.ts` (path integration + volume strategy)
- `.kiro/specs/production-deployment-system/design.md` (documentation)
- `.kiro/specs/production-deployment-system/tasks.md` (task tracking)
- `web-frontend/package-lock.json` (fixed typo: concultivate-map → concat-map)
- `backend-api/package-lock.json` (fixed typos: concultivate-map → concat-map, concultivate-stream → concat-stream)

## Critical Fixes

### 1. Package Lock Typos

Fixed corrupted package-lock.json files that had typos in dependency names:
- `concultivate-map` → `concat-map`
- `concultivate-stream` → `concat-stream`

These typos were causing npm install failures during Docker builds.

### 2. Unix Socket Volume Strategy

Changed from host path mounts to Docker named volumes for socket directories:

**Before (Failed on macOS):**
```yaml
volumes:
  - /Users/username/cultivate/volumes/db_socket:/var/run/postgresql
```

**After (Works on macOS):**
```yaml
volumes:
  - db_socket:/var/run/postgresql

volumes:
  db_socket:
    driver: local
```

**Why:** Unix domain sockets require native filesystem support. They use special file types (socket files) that don't work on filesystems mounted from macOS into the Finch VM. Named volumes exist inside the VM's native Linux filesystem where sockets work properly.

## Example Usage

### Automatic Volume Strategy

```typescript
// Detect OS and get appropriate paths
const osDetector = new OSDetector(sshClient);
const osResult = await osDetector.detectOS();
const username = getUsername(sshConfig?.username);
const deploymentPaths = getDeploymentPaths(osResult, username);

// Generate compose file with OS-appropriate volume strategy
const useNamedVolumes = deploymentPaths.targetOS === 'macos';
const dbDataVolume = useNamedVolumes 
    ? 'db_data'  // Named volume on macOS
    : path.join(deploymentPaths.volumePath, 'db_data');  // Host path on Linux

// Socket ALWAYS uses named volume
const dbSocketVolume = 'db_socket';
```

### Generated Volumes

**Linux:**
```
Data: /opt/cultivate/volumes/db_data (host path)
Socket: db_socket (named volume)
```

**macOS:**
```
Data: db_data (named volume)
Socket: db_socket (named volume)
```

## Error Handling

### Filesystem Boundary Errors

When invalid paths are detected on macOS:

```
Error: Cannot access path '/opt/cultivate' on macOS target

Finch runs containers in a Linux VM that only mounts certain host directories.
The path '/opt/cultivate' is not accessible inside the VM.

Solutions:
1. Use a path under /Users (recommended):
   DEPLOYMENT_PATH=/Users/username/cultivate

2. Create a symlink in your home directory:
   ln -s /opt/cultivate ~/cultivate
   DEPLOYMENT_PATH=~/cultivate

3. Configure Lima to mount /opt (advanced):
   Edit ~/.finch/finch.yaml to add /opt to mounts

For more information, see: docs/MACOS_DEPLOYMENT.md
```

### Socket Creation Errors

If socket creation fails (should not happen with named volumes):

```
PostgreSQL Error:
could not set permissions of file "/var/run/postgresql/.s.PGSQL.5432": Invalid argument
FATAL: could not create any Unix-domain sockets

Solution:
Ensure socket volume uses Docker named volume, not host path mount.
Named volumes exist in VM's native filesystem where sockets work properly.
```

## Testing

### Unit Tests
- 23 tests in `deployment-paths.test.ts`
- All tests passing
- Coverage includes:
  - Path generation for both OS types
  - Path validation
  - Error cases
  - Integration scenarios

### Integration Tests
- All 453 existing deployment tests still passing
- No regressions introduced
- Build compiles without errors or warnings

## Requirements Satisfied

This implementation satisfies the following requirements:
- **8.9**: Check for Finch installation on macOS and provide installation instructions
- **8.10**: Use Finch commands instead of Docker commands on macOS targets
- **10.6**: Use `finch compose` commands for all compose operations on macOS
- **3.2**: Database container exposes Unix domain socket (via named volume)
- **4.1**: Socket volume accessible only to backend and database containers

## Lessons Learned

### 1. Filesystem Boundaries Are Real

The macOS → VM boundary is not just about path accessibility. Even accessible paths may not support all filesystem features (like Unix sockets).

### 2. Named Volumes Are the Solution

Docker named volumes exist inside the VM's native filesystem, avoiding all boundary issues:
- No path accessibility problems
- Full filesystem feature support (including sockets)
- Portable across platforms

### 3. Different Strategies for Different Volume Types

- **Socket volumes**: Must use named volumes (filesystem feature requirement)
- **Data volumes**: Can use host paths on Linux (easier management) or named volumes on macOS (avoid boundary issues)

## Future Enhancements

Potential improvements for future iterations:

1. **Backup Strategy for Named Volumes**: Provide tools for backing up named volumes on macOS
2. **Volume Migration**: Tools for migrating between host paths and named volumes
3. **Automatic Symlink Creation**: Offer to create symlinks automatically when users prefer `/opt` paths
4. **Lima Configuration**: Provide automated Lima mount configuration
5. **Disk Space Monitoring**: Warn when VM disk space is limited

## Conclusion

The implementation successfully addresses both the macOS/Finch filesystem boundary constraint and the Unix socket creation limitation by:

1. Automatically detecting the target OS
2. Selecting appropriate paths for each OS
3. Using named volumes for socket directories on all platforms
4. Using named volumes for data on macOS, host paths on Linux
5. Validating paths before deployment
6. Providing clear error messages and solutions
7. Maintaining backward compatibility with Linux deployments

All tests pass, documentation is complete, and the system is ready for production use on both Linux and macOS targets.
