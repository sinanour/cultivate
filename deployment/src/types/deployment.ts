/**
 * Core type definitions for the deployment system
 * Based on the design document data models
 */

/**
 * Deployment state tracking
 * Represents the current or historical state of a deployment
 */
export interface DeploymentState {
  /** Deployment version/tag identifier */
  version: string;

  /** Timestamp when deployment was initiated */
  timestamp: Date;

  /** Target host identifier (hostname or IP) */
  targetHost: string;

  /** Docker image versions for each container */
  imageVersions: {
    frontend: string;
    backend: string;
    database: string;
  };

  /** Hash of configuration files for change detection */
  configurationHash: string;

  /** Current deployment status */
  status: 'pending' | 'active' | 'failed' | 'rolled_back';

  /** Health check results for all services */
  healthChecks: HealthCheckResult[];
}

/**
 * Health check result for a single service
 */
export interface HealthCheckResult {
  /** Service being checked */
  service: 'frontend' | 'backend' | 'database';

  /** Health status */
  status: 'healthy' | 'unhealthy';

  /** Timestamp of health check */
  timestamp: Date;

  /** Optional diagnostic message */
  message?: string;
}

/**
 * Complete deployment configuration
 * Defines all settings needed for a deployment
 */
export interface DeploymentConfiguration {
  /** Network configuration */
  network: {
    /** HTTP port for web frontend */
    httpPort: number;

    /** HTTPS port for web frontend */
    httpsPort: number;

    /** Whether HTTPS is enabled */
    enableHttps: boolean;
  };

  /** Volume configuration */
  volumes: {
    /** Path for database data persistence */
    dataPath: string;

    /** Path for Unix domain socket */
    socketPath: string;

    /** Optional path for SSL certificates */
    certPath?: string;
  };

  /** Environment variables */
  environment: {
    /** Node environment (production/staging) */
    nodeEnv: 'production' | 'staging';

    /** Database connection URL */
    databaseUrl: string;

    /** Backend API port */
    backendPort: number;
  };

  /** Security configuration */
  security: {
    /** UID for apiuser */
    apiUserUid: number;

    /** GID for apiuser */
    apiUserGid: number;

    /** Socket volume permissions (e.g., "0770") */
    socketPermissions: string;
  };
}

/**
 * Docker image metadata
 * Tracks information about built or transferred images
 */
export interface DockerImage {
  /** Image name (e.g., "cat_frontend") */
  name: string;

  /** Image tag/version (e.g., "1.0.0", "latest") */
  tag: string;

  /** Image digest (SHA256 hash) */
  digest: string;

  /** Image size in bytes */
  size: number;

  /** Timestamp when image was built */
  buildTimestamp: Date;

  /** Where the image was built */
  buildHost: 'local' | 'remote';
}

/**
 * SSH connection configuration
 */
export interface SSHConfig {
  /** Target host (hostname or IP) */
  host: string;

  /** SSH port (default: 22) */
  port: number;

  /** SSH username */
  username: string;

  /** Path to private key file */
  privateKeyPath?: string;

  /** Connection timeout in milliseconds */
  timeout: number;
}

/**
 * Build configuration options
 */
export interface BuildOptions {
  /** Where to build images */
  buildMode: 'local' | 'remote';

  /** Whether to enable verbose output */
  verbose: boolean;

  /** Docker build context path */
  contextPath: string;

  /** Optional build arguments */
  buildArgs?: Record<string, string>;

  /** Container runtime to use (auto-detected if not specified) */
  runtime?: 'docker' | 'finch';
}

/**
 * Container runtime configuration
 * Supports both Docker and Finch for local image building
 */
export interface ContainerRuntime {
  /** Runtime name */
  name: 'docker' | 'finch';

  /** Command for building images */
  buildCommand: string;

  /** Command for compose operations */
  composeCommand: string;

  /** Whether the runtime is available on the system */
  available: boolean;

  /** Runtime version string */
  version?: string;
}

/**
 * Deployment options passed to the deployment script
 */
export interface DeploymentOptions {
  /** Target SSH host */
  targetHost: string;

  /** SSH connection configuration */
  sshConfig?: {
    /** SSH username (default: 'root') */
    username?: string;

    /** SSH port (default: 22) */
    port?: number;

    /** Path to SSH private key */
    privateKeyPath?: string;

    /** Connection timeout in milliseconds (default: 30000) */
    timeout?: number;
  };

  /** Build configuration */
  buildOptions: BuildOptions;

  /** Deployment configuration */
  config: DeploymentConfiguration;

  /** Whether to perform rollback instead of deployment */
  rollback: boolean;

  /** Path to deployment state file */
  stateFilePath: string;
}

/**
 * Result of a deployment operation
 */
export interface DeploymentResult {
  /** Whether deployment succeeded */
  success: boolean;

  /** Deployment state after operation */
  state: DeploymentState;

  /** Error message if deployment failed */
  error?: string;

  /** Diagnostic logs */
  logs: string[];
}

/**
 * Certificate configuration
 */
export interface CertificateConfig {
  /** Path to certificate file */
  certPath: string;

  /** Path to private key file */
  keyPath: string;

  /** Optional path to CA certificate */
  caPath?: string;

  /** Certificate expiration date */
  expirationDate?: Date;
}

/**
 * Volume configuration for Docker Compose
 */
export interface VolumeConfig {
  /** Volume name */
  name: string;

  /** Volume driver (usually "local") */
  driver: string;

  /** Volume mount path in container */
  mountPath: string;

  /** Volume permissions */
  permissions?: string;
}

/**
 * Container configuration
 */
export interface ContainerConfig {
  /** Container name */
  name: string;

  /** Docker image to use */
  image: string;

  /** Environment variables */
  environment: Record<string, string>;

  /** Volume mounts */
  volumes: VolumeConfig[];

  /** Port mappings (host:container) */
  ports?: string[];

  /** Container dependencies */
  dependsOn?: string[];

  /** Health check configuration */
  healthCheck?: HealthCheckConfig;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Health check command */
  test: string[];

  /** Interval between checks in seconds */
  interval: number;

  /** Timeout for each check in seconds */
  timeout: number;

  /** Number of retries before marking unhealthy */
  retries: number;
}
