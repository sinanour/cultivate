/**
 * Finch Network Configuration Module
 * 
 * Handles Lima VM network configuration for Finch on macOS
 * to enable public port accessibility.
 * 
 * Issue: Finch's Lima VM only forwards ports to localhost (127.0.0.1) by default,
 * even when docker-compose specifies 0.0.0.0. This module helps configure
 * Lima to forward ports to all interfaces.
 */

import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Port forwarding configuration
 */
export interface PortForwardConfig {
    /** Guest port (inside VM) */
    guestPort: number;
    /** Host IP to bind to (0.0.0.0 for all interfaces) */
    hostIP: string;
    /** Host port (on macOS host) */
    hostPort: number;
}

/**
 * Result of network configuration check
 */
export interface NetworkConfigResult {
    /** Whether port forwarding is configured correctly */
    configured: boolean;
    /** Whether VM restart is needed */
    needsRestart: boolean;
    /** Configuration file path */
    configPath: string;
    /** Error message if check failed */
    error?: string;
}

/**
 * FinchNetworkConfig class for managing Finch VM network configuration
 */
export class FinchNetworkConfig {
    private sshClient: SSHClient;

    constructor(sshClient: SSHClient) {
        this.sshClient = sshClient;
    }

    /**
     * Checks if Finch port forwarding is configured for public access
     * 
     * @param ports - Ports to check
     * @returns Promise that resolves with configuration status
     */
    async checkPortForwarding(ports: PortForwardConfig[]): Promise<NetworkConfigResult> {
        logger.info('Checking Finch port forwarding configuration...');

        try {
            // Get the Finch config file path
            const configPath = await this.getFinchConfigPath();

            // Check if config file exists
            const checkResult = await this.sshClient.executeCommand(`test -f ${configPath} && echo "exists" || echo "missing"`);
            const configExists = checkResult.stdout.trim() === 'exists';

            if (!configExists) {
                logger.warn(`Finch config file not found at ${configPath}`);
                return {
                    configured: false,
                    needsRestart: false,
                    configPath,
                    error: 'Finch configuration file not found'
                };
            }

            // Read the config file
            const catResult = await this.sshClient.executeCommand(`cat ${configPath}`);
            if (catResult.exitCode !== 0) {
                return {
                    configured: false,
                    needsRestart: false,
                    configPath,
                    error: 'Failed to read Finch configuration'
                };
            }

            const configContent = catResult.stdout;

            // Check if port forwards are configured
            const hasPortForwards = configContent.includes('portForwards:');
            const allPortsConfigured = ports.every(port => {
                const portConfig = `guestPort: ${port.guestPort}`;
                const hostIPConfig = `hostIP: "${port.hostIP}"`;
                return configContent.includes(portConfig) && configContent.includes(hostIPConfig);
            });

            if (!hasPortForwards || !allPortsConfigured) {
                logger.warn('Port forwarding not configured for public access');
                return {
                    configured: false,
                    needsRestart: true,
                    configPath,
                    error: 'Port forwarding not configured for 0.0.0.0'
                };
            }

            logger.info('Port forwarding is configured correctly');
            return {
                configured: true,
                needsRestart: false,
                configPath
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to check port forwarding: ${errorMessage}`);
            return {
                configured: false,
                needsRestart: false,
                configPath: '~/.finch/finch.yaml',
                error: errorMessage
            };
        }
    }

    /**
     * Generates Finch configuration with port forwarding
     * 
     * @param ports - Ports to forward
     * @param existingConfig - Existing configuration content (optional)
     * @returns Generated configuration content
     */
    generateFinchConfig(ports: PortForwardConfig[], existingConfig?: string): string {
        logger.info('Generating Finch configuration with port forwarding...');

        // Parse existing config or start with default
        let config = existingConfig || this.getDefaultFinchConfig();

        // Check if portForwards section exists
        if (!config.includes('portForwards:')) {
            // Add portForwards section
            config += '\n# Port forwarding configuration\nportForwards:\n';
            config += '  - guestSocket: /var/run/docker.sock\n';
            config += '    hostSocket: /Users/{{.User}}/.finch/finch.sock\n';
        }

        // Add port forwards for each port
        for (const port of ports) {
            const portForward = `  - guestPort: ${port.guestPort}\n    hostIP: "${port.hostIP}"\n    hostPort: ${port.hostPort}\n`;

            // Check if this port forward already exists
            if (!config.includes(`guestPort: ${port.guestPort}`)) {
                config += portForward;
            }
        }

        return config;
    }

    /**
     * Provides instructions for manual configuration
     * 
     * @param ports - Ports to configure
     * @returns Instructions as string
     */
    getConfigurationInstructions(ports: PortForwardConfig[]): string {
        const configPath = '~/.finch/finch.yaml';

        let instructions = `
╔════════════════════════════════════════════════════════════════════════════╗
║  Finch Port Forwarding Configuration Required                              ║
╚════════════════════════════════════════════════════════════════════════════╝

The application is deployed but only accessible on localhost (127.0.0.1).
To make it accessible from external machines, configure Finch port forwarding.

ISSUE:
  Finch's Lima VM only forwards ports to localhost by default, even when
  docker-compose specifies 0.0.0.0. This is a Lima network configuration issue.

SOLUTION:
  Configure Lima to forward ports to all network interfaces (0.0.0.0).

STEPS:

1. Edit the Finch configuration file on the macOS host:
   
   vim ${configPath}

2. Add or modify the portForwards section:

   portForwards:
     - guestSocket: /var/run/docker.sock
       hostSocket: /Users/{{.User}}/.finch/finch.sock
`;

        for (const port of ports) {
            instructions += `     - guestPort: ${port.guestPort}\n`;
            instructions += `       hostIP: "${port.hostIP}"\n`;
            instructions += `       hostPort: ${port.hostPort}\n`;
        }

        instructions += `
3. Restart the Finch VM:
   
   finch vm stop
   finch vm start

4. Verify the application is accessible:
   
   curl http://$(hostname):${ports[0].hostPort}

ALTERNATIVE:
  If you cannot modify Lima configuration, use SSH port forwarding:
  
  ssh -L ${ports[0].hostPort}:localhost:${ports[0].hostPort} user@macos-host

For more information, see: deployment/docs/MACOS_DEPLOYMENT.md

`;

        return instructions;
    }

    /**
     * Gets the path to the Finch configuration file
     * 
     * @returns Promise that resolves with config file path
     */
    private async getFinchConfigPath(): Promise<string> {
        // Try to get the actual home directory
        const homeResult = await this.sshClient.executeCommand('echo $HOME');
        const homeDir = homeResult.stdout.trim() || '/Users/$(whoami)';

        return `${homeDir}/.finch/finch.yaml`;
    }

    /**
     * Gets default Finch configuration
     * 
     * @returns Default configuration content
     */
    private getDefaultFinchConfig(): string {
        return `# Finch configuration file
# See: https://github.com/runfinch/finch/blob/main/finch.yaml

# VM configuration
cpus: 4
memory: 4GiB

# Port forwarding configuration
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
`;
    }
}
