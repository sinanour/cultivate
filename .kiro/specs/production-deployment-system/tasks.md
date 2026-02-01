# Implementation Plan: Production Deployment System

## Overview

This implementation plan breaks down the production deployment system into discrete coding tasks. The system will be implemented using TypeScript for the deployment script, with Docker for containerization and Docker Compose for orchestration. The implementation follows a bottom-up approach: first building the container infrastructure, then the deployment automation, and finally the health checking and rollback capabilities.

## Tasks

- [x] 1. Set up project structure and core types
  - Create TypeScript project with proper configuration (tsconfig.json, package.json)
  - Define core TypeScript interfaces for deployment state, configuration, and Docker images
  - Set up directory structure for Dockerfiles, scripts, and configuration
  - Install dependencies: ssh2, dockerode, commander, winston for logging
  - _Requirements: 11.1, 11.2, 12.1_

- [x] 2. Implement Docker container definitions
  - [x] 2.1 Create Web Frontend Dockerfile with multi-stage build
    - Write Dockerfile.frontend with Node.js build stage and Nginx serving stage
    - Create nginx.conf with HTTP/HTTPS configuration
    - Add conditional HTTPS configuration based on certificate presence
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  
  - [ ]* 2.2 Write property test for static asset serving
    - **Property 1: Static asset accessibility**
    - **Validates: Requirements 1.1**
  
  - [x] 2.3 Create Backend API Dockerfile with peer authentication setup
    - Write Dockerfile.backend with Node.js base image
    - Add apiuser creation with specific UID/GID (1001)
    - Configure Prisma client generation
    - Set USER directive to run as apiuser
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 2.4 Write property test for Unix socket connectivity
    - **Property 5: Unix socket connectivity**
    - **Validates: Requirements 2.2**
  
  - [x] 2.5 Create Database Dockerfile with peer authentication
    - Write Dockerfile.database with PostgreSQL base image
    - Add apiuser creation matching backend UID/GID
    - Copy pg_hba.conf for peer authentication configuration
    - Copy init-db.sh for database initialization
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 2.6 Write property test for peer authentication
    - **Property 7: Peer authentication mapping**
    - **Validates: Requirements 3.3**
  
  - [ ]* 2.7 Write property test for password rejection
    - **Property 8: Password authentication rejection**
    - **Validates: Requirements 3.4**

- [x] 3. Implement Docker Compose configuration
  - [x] 3.1 Create docker-compose.yml with all services
    - Define database service with volumes and health checks
    - Define backend service with socket volume mount and dependencies
    - Define frontend service with port mappings and optional certificate mount
    - Configure private network for inter-container communication
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 3.2 Write property test for environment variable interpolation
    - **Property 12: Environment variable interpolation**
    - **Validates: Requirements 5.5**
  
  - [x] 3.3 Create volume definitions for socket and data persistence
    - Define db_socket volume with appropriate driver
    - Define db_data volume for PostgreSQL persistence
    - Configure volume permissions and ownership
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 3.4 Write property test for volume persistence
    - **Property 10: Volume persistence after container removal**
    - **Validates: Requirements 4.3**
  
  - [ ]* 3.5 Write property test for socket volume exclusivity
    - **Property 6: Socket volume exclusivity**
    - **Validates: Requirements 2.4, 4.1, 4.4**

- [x] 4. Checkpoint - Verify container definitions
  - Build all Docker images locally to verify Dockerfiles
  - Start containers using docker-compose to verify orchestration
  - Verify socket volume sharing between backend and database
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Implement database initialization scripts
  - [x] 5.1 Create init-db.sh for database setup
    - Write script to create apiuser database user
    - Create cultivate database with proper ownership
    - Grant necessary privileges to apiuser
    - _Requirements: 3.1, 3.3_
  
  - [x] 5.2 Create pg_hba.conf for peer authentication
    - Configure local connections to use peer authentication
    - Reject all host-based connections (TCP/IP)
    - Document authentication rules
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 5.3 Write property test for socket file creation
    - **Property 9: Socket file creation**
    - **Validates: Requirements 3.2**

- [x] 6. Implement TypeScript deployment script core
  - [x] 6.1 Create main deployment script structure
    - Set up Commander.js for CLI argument parsing
    - Define main deployment workflow function
    - Implement logging with Winston (file and console output)
    - Create error handling framework
    - _Requirements: 7.1, 15.1, 15.5_
  
  - [x] 6.2 Implement SSH connection module
    - Create SSHClient class using ssh2 library
    - Implement connection establishment with timeout
    - Implement SSH key-based authentication
    - Add connection verification method
    - _Requirements: 7.2, 7.3, 7.5_
  
  - [ ]* 6.3 Write property test for SSH connectivity verification
    - **Property 16: SSH connectivity verification**
    - **Validates: Requirements 7.2, 7.3**
  
  - [ ]* 6.4 Write unit tests for SSH error messages
    - Test connection timeout error messages
    - Test authentication failure error messages
    - Test host unreachable error messages
    - _Requirements: 7.4_

- [x] 7. Implement dependency checking and installation
  - [x] 7.1 Create dependency checker module
    - Implement Docker version detection via SSH
    - Implement Docker Compose version detection via SSH
    - Add version comparison logic for minimum requirements
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [ ]* 7.2 Write property test for dependency verification
    - **Property 18: Dependency verification and installation**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  
  - [x] 7.3 Create dependency installer module
    - Implement Docker installation for Ubuntu/Debian
    - Implement Docker Compose installation
    - Add installation verification
    - _Requirements: 8.3, 8.4_
  
  - [ ]* 7.4 Write property test for version requirement enforcement
    - **Property 19: Version requirement enforcement**
    - **Validates: Requirements 8.5**
  
  - [x] 7.5 Add macOS/Finch support for target hosts
    - Update OS detector to detect macOS using `uname`
    - Add Finch detection for macOS targets
    - Provide Finch installation instructions when not found
    - Update dependency checker to support Finch on macOS
    - Update container deployment to use Finch commands on macOS targets
    - _Requirements: 8.6, 8.9, 8.10, 10.6_

- [x] 8. Checkpoint - Verify SSH and dependency management
  - Test SSH connection to a test host
  - Test dependency detection on clean system
  - Test dependency installation (if safe to do so)
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Implement Docker image building and transfer
  - [x] 9.1 Create local image builder module
    - Implement Docker image building using dockerode
    - Add Finch support for macOS users as alternative to Docker
    - Detect available container runtime (Docker or Finch) automatically
    - Use runtime-agnostic commands that work with both Docker and Finch
    - Add progress reporting during build
    - Implement image tagging with version information
    - _Requirements: 9.1, 9.5, 9.6, 9.7, 9.8, 14.3_
  
  - [x] 9.2 Create remote image builder module
    - Transfer Dockerfiles and build context via SSH
    - Execute docker build commands on remote host
    - Capture and stream build output
    - _Requirements: 9.2, 9.5_
  
  - [x] 9.3 Create image transfer module
    - Implement docker save for local images
    - Transfer image tar files via SSH/SCP
    - Implement docker load on remote host
    - Add progress reporting during transfer
    - _Requirements: 9.3, 9.5_
  
  - [ ]* 9.4 Write property test for image transfer verification
    - **Property 20: Image transfer verification**
    - **Validates: Requirements 9.3, 9.4**
  
  - [ ]* 9.5 Write property test for progress feedback
    - **Property 21: Progress feedback during operations**
    - **Validates: Requirements 9.5**

- [x] 10. Implement configuration management
  - [x] 10.1 Create configuration validator module
    - Implement validation for required configuration values
    - Add default value application for optional settings
    - Validate certificate files when HTTPS is enabled
    - _Requirements: 11.3, 11.4, 6.4_
  
  - [ ]* 10.2 Write property test for required configuration validation
    - **Property 25: Required configuration validation**
    - **Validates: Requirements 11.3**
  
  - [ ]* 10.3 Write property test for default value application
    - **Property 26: Default value application**
    - **Validates: Requirements 11.4**
  
  - [x] 10.4 Create configuration transfer module
    - Transfer docker-compose.yml to target host
    - Transfer .env file with environment variables
    - Transfer certificates if HTTPS is enabled
    - Set appropriate file permissions
    - _Requirements: 10.1, 10.2, 6.1_
  
  - [ ]* 10.5 Write property test for configuration deployment completeness
    - **Property 22: Configuration deployment completeness**
    - **Validates: Requirements 10.1, 10.2**
  
  - [ ]* 10.6 Write property test for certificate validation
    - **Property 14: Certificate validation before mounting**
    - **Validates: Requirements 6.4**

- [x] 11. Checkpoint - Verify build and configuration
  - Test local image building
  - Test image transfer to remote host
  - Test configuration validation and transfer
  - Ensure all tests pass, ask the user if questions arise

- [x] 12. Implement container deployment and startup
  - [x] 12.1 Create container deployment module
    - Implement docker-compose up via SSH
    - Add container startup monitoring
    - Capture container logs during startup
    - _Requirements: 10.3, 10.4_
  
  - [x] 12.2 Create health check module
    - Implement health check polling for all containers
    - Add timeout and retry logic with exponential backoff
    - Verify all containers reach healthy state
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 12.3 Write property test for container startup verification
    - **Property 23: Container startup verification**
    - **Validates: Requirements 2.5, 10.4, 13.3**
  
  - [ ]* 12.4 Write unit tests for health check timeout handling
    - Test health check with slow-starting containers
    - Test health check with failing containers
    - Test health check retry logic
    - _Requirements: 13.3_

- [x] 13. Implement rollback functionality
  - [x] 13.1 Create deployment state tracking module
    - Implement deployment state persistence to JSON file
    - Track image versions, configuration hashes, timestamps
    - Store previous deployment state for rollback
    - _Requirements: 14.1, 14.3_
  
  - [ ]* 13.2 Write property test for previous deployment preservation
    - **Property 28: Previous deployment preservation**
    - **Validates: Requirements 14.1**
  
  - [x] 13.3 Create rollback executor module
    - Implement rollback command to restore previous deployment
    - Restore previous Docker images
    - Restore previous configuration files
    - Restart containers with previous versions
    - _Requirements: 14.2, 14.4_
  
  - [ ]* 13.4 Write property test for configuration restoration
    - **Property 30: Configuration restoration on rollback**
    - **Validates: Requirements 14.4**
  
  - [x] 13.5 Add rollback verification
    - Verify containers start successfully after rollback
    - Run health checks on rolled-back deployment
    - _Requirements: 14.5_
  
  - [ ]* 13.6 Write property test for rollback verification
    - **Property 31: Rollback verification**
    - **Validates: Requirements 14.5**

- [x] 14. Implement failure handling and diagnostics
  - [x] 14.1 Create failure detection module
    - Detect container startup failures
    - Detect health check failures
    - Detect SSH connection failures
    - _Requirements: 10.5, 13.5_
  
  - [x] 14.2 Create diagnostic capture module
    - Capture container logs on failure
    - Capture docker-compose logs
    - Capture system logs from target host
    - _Requirements: 15.2, 15.3_
  
  - [ ]* 14.3 Write property test for container log capture
    - **Property 33: Container log capture on failure**
    - **Validates: Requirements 15.2**
  
  - [x] 14.3 Implement automatic rollback on failure
    - Trigger rollback when deployment fails
    - Display diagnostic information before rollback
    - Verify rollback success
    - _Requirements: 10.5, 14.1_
  
  - [ ]* 14.4 Write property test for failure rollback
    - **Property 24: Failure rollback with diagnostics**
    - **Validates: Requirements 10.5**

- [x] 15. Checkpoint - Verify deployment and rollback
  - Test full deployment workflow end-to-end
  - Test rollback after simulated failure
  - Test health check failure detection
  - Ensure all tests pass, ask the user if questions arise

- [x] 16. Implement logging and monitoring
  - [x] 16.1 Enhance logging with timestamps and levels
    - Add ISO 8601 timestamps to all log entries
    - Implement log levels (info, warn, error, debug)
    - Configure log file rotation
    - _Requirements: 15.1, 15.4_
  
  - [ ]* 16.2 Write property test for timestamped logs
    - **Property 32: Timestamped deployment logs**
    - **Validates: Requirements 15.1**
  
  - [x] 16.3 Add verbose mode implementation
    - Add --verbose flag to CLI
    - Output detailed diagnostic information in verbose mode
    - Include Docker command output in verbose mode
    - _Requirements: 15.5_
  
  - [ ]* 16.4 Write property test for verbose mode output
    - **Property 35: Verbose mode output**
    - **Validates: Requirements 15.5**
  
  - [x] 16.5 Implement log persistence on target host
    - Create log directory on target host
    - Write deployment logs to target host
    - Configure log retention policy
    - _Requirements: 15.3_
  
  - [ ]* 16.6 Write property test for log persistence
    - **Property 34: Log persistence**
    - **Validates: Requirements 15.3**

- [x] 17. Implement HTTPS certificate management
  - [x] 17.1 Create certificate validator module
    - Validate certificate file format (PEM)
    - Check certificate expiration dates
    - Verify certificate and key pair match
    - _Requirements: 6.4_
  
  - [x] 17.2 Add certificate mounting logic
    - Mount certificates as read-only volumes
    - Configure Nginx to use certificates when present
    - Support certificate paths via environment variables
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 17.3 Write property test for certificate mounting
    - **Property 13: Certificate mounting when provided**
    - **Validates: Requirements 6.1**
  
  - [ ]* 17.4 Write property test for conditional HTTPS
    - **Property 3: Conditional HTTPS enablement**
    - **Validates: Requirements 1.3, 6.2**
  
  - [ ]* 17.5 Write property test for HTTP-only fallback
    - **Property 4: HTTP-only fallback**
    - **Validates: Requirements 6.3**
  
  - [x] 17.6 Add certificate renewal support
    - Implement certificate update without container rebuild
    - Reload Nginx configuration after certificate update
    - _Requirements: 6.5_
  
  - [ ]* 17.7 Write property test for certificate renewal
    - **Property 15: Certificate renewal without rebuild**
    - **Validates: Requirements 6.5**

- [x] 18. Add cloud deployment compatibility documentation
  - [x] 18.1 Document architecture decisions for cloud compatibility
    - Document separation of application logic from deployment
    - Document use of environment variables for configuration
    - Document container interface standards
    - _Requirements: 12.1, 12.2, 12.5_
  
  - [x] 18.2 Create cloud migration guide
    - Document AWS ECS/Fargate migration path
    - Document Google Cloud Run migration path
    - Document Azure Container Instances migration path
    - List cloud-specific considerations
    - _Requirements: 12.3, 12.4_

- [ ] 19. Implement additional property tests for port and volume management
  - [ ]* 19.1 Write property test for port configuration flexibility
    - **Property 2: Port configuration flexibility**
    - **Validates: Requirements 1.2**
  
  - [ ]* 19.2 Write property test for volume mount verification
    - **Property 11: Volume mount verification before startup**
    - **Validates: Requirements 4.5**
  
  - [ ]* 19.3 Write property test for secret exclusion from images
    - **Property 27: Secret exclusion from images**
    - **Validates: Requirements 11.5**
  
  - [ ]* 19.4 Write property test for image version tagging
    - **Property 29: Image version tagging**
    - **Validates: Requirements 14.3**

- [ ] 20. Final integration and end-to-end testing
  - [ ]* 20.1 Write integration tests for full deployment workflow
    - Test deployment to clean target host
    - Test deployment with existing containers
    - Test deployment with certificate configuration
    - Test deployment with custom environment variables
    - _Requirements: All_
  
  - [ ]* 20.2 Write integration tests for failure scenarios
    - Test SSH connection failure handling
    - Test Docker daemon unavailable scenario
    - Test disk space exhaustion scenario
    - Test network connectivity issues
    - _Requirements: 7.4, 10.5, 14.1_
  
  - [ ]* 20.3 Write integration tests for rollback scenarios
    - Test rollback after container startup failure
    - Test rollback after health check failure
    - Test rollback with missing previous deployment
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 21. Final checkpoint - Complete system verification
  - Run all unit tests and property tests
  - Run all integration tests
  - Perform manual end-to-end deployment test
  - Verify all requirements are covered by tests
  - Ensure all tests pass, ask the user if questions arise

- [x] 22. Fix macOS/Finch compose command detection in rollback workflow
  - [x] 22.1 Extract compose command detection into reusable function
    - Move the runtime detection logic from deploy.ts into a shared utility function
    - Function should detect macOS and check for Finch at multiple paths
    - Return the appropriate compose command ('finch compose' or 'docker-compose')
    - _Requirements: 8.9, 8.10, 10.6_
  
  - [x] 22.2 Update rollback workflow to use detected compose command
    - Call the compose command detection function in rollback.ts
    - Pass the detected compose command to ContainerDeployment constructor
    - Pass the detected compose command to HealthCheck constructor
    - _Requirements: 8.10, 10.6, 14.2_
  
  - [x] 22.3 Add Finch VM initialization check
    - Check if Finch VM is initialized on macOS targets
    - If not initialized, run 'finch vm init' automatically
    - Add logging for VM initialization status
    - Handle initialization failures gracefully
    - _Requirements: 8.9, 8.10_
  
  - [x] 22.4 Test rollback with Finch on macOS
    - Deploy to macOS target with Finch
    - Trigger rollback and verify it uses 'finch compose' commands
    - Verify containers stop and start correctly
    - _Requirements: 8.10, 14.2, 14.5_

- [x] 23. Implement macOS/Finch filesystem boundary handling
  - [x] 23.1 Create deployment paths utility module
    - Create deployment-paths.ts with OS-specific path strategies
    - Implement getDeploymentPaths() for Linux and macOS
    - Add validateMacOSPaths() to check VM accessibility
    - Add helper functions for path expansion and volume paths
    - _Requirements: 8.9, 8.10, 10.6_
  
  - [x] 23.2 Write comprehensive tests for deployment paths
    - Test Linux path generation (FHS standard)
    - Test macOS path generation (home directory)
    - Test path validation for macOS VM accessibility
    - Test rejection of /opt, /var, /etc paths on macOS
    - Test acceptance of /Users and /Volumes paths on macOS
    - Test path expansion and helper functions
    - _Requirements: 8.9, 8.10_
  
  - [x] 23.3 Update config-transfer to validate macOS paths
    - Add isPathInaccessibleOnMacOS() method
    - Update ensureRemoteDirectory() to check macOS paths
    - Provide helpful error messages with solutions
    - _Requirements: 8.9, 10.6_
  
  - [x] 23.4 Update deployment workflow to use path strategies
    - Import deployment-paths module in deploy.ts
    - Update checkAndInstallDependencies() to detect OS and return paths
    - Update deployConfiguration() to use deployment paths
    - Update generateDockerComposeFile() to use OS-appropriate paths
    - Validate paths before deployment
    - _Requirements: 8.9, 8.10, 10.6_
  
  - [x] 23.5 Create macOS deployment documentation
    - Document Finch VM filesystem boundary issue
    - Explain automatic path handling
    - Provide troubleshooting guide
    - Document manual configuration options (symlinks, Lima mounts)
    - _Requirements: 8.9, 8.10_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation uses TypeScript for type safety and better tooling
- SSH operations use the ssh2 library for Node.js
- Docker operations use the dockerode library for programmatic Docker control
- CLI interface uses Commander.js for argument parsing
- Logging uses Winston for structured logging with file and console output
