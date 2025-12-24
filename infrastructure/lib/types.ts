/**
 * Environment-specific configuration interface
 */
export interface EnvironmentConfig {
  account: string;
  region: string;
  vpcCidr: string;
  databaseMinCapacity: number;
  databaseMaxCapacity: number;
  apiMinTasks: number;
  apiMaxTasks: number;
  apiCpu: number;
  apiMemory: number;
  logRetentionDays: number;
  domainName: string;
}

/**
 * Standard resource tags
 */
export interface ResourceTags {
  Environment: string;
  Application: string;
  CostCenter: string;
  Owner: string;
  ManagedBy: string;
}
