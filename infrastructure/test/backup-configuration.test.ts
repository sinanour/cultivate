import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CommunityActivityTrackerStack } from '../lib/community-activity-tracker-stack';
import { EnvironmentConfig } from '../lib/types';
import { getNumRuns } from './test-config';

/**
 * Feature: infrastructure, Property 7: Backup Configuration
 * 
 * For any Aurora database cluster, automated backups SHALL be enabled with a retention
 * period of at least 7 days and point-in-time recovery SHALL be enabled.
 * 
 * Validates: Requirements 2.4, 10.1, 10.2
 */
describe('Property 7: Backup Configuration', () => {
  // Generator for valid environment configurations
  const environmentConfigArbitrary = fc.record({
    account: fc.constant('123456789012'),
    region: fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1'),
    vpcCidr: fc.constantFrom('10.0.0.0/16', '10.1.0.0/16', '10.2.0.0/16'),
    databaseMinCapacity: fc.double({ min: 0.5, max: 2 }),
    databaseMaxCapacity: fc.double({ min: 2, max: 16 }),
    apiMinTasks: fc.integer({ min: 1, max: 5 }),
    apiMaxTasks: fc.integer({ min: 2, max: 20 }),
    apiCpu: fc.constantFrom(256, 512, 1024, 2048),
    apiMemory: fc.constantFrom(512, 1024, 2048, 4096),
    logRetentionDays: fc.constantFrom(7, 14, 30, 90),
    domainName: fc.constantFrom(
      'dev.example.com',
      'staging.example.com',
      'prod.example.com'
    ),
  }).filter(config => config.databaseMaxCapacity >= config.databaseMinCapacity)
    .filter(config => config.apiMaxTasks >= config.apiMinTasks)
    .filter(config => config.apiMemory >= config.apiCpu / 2);

  const environmentNameArbitrary = fc.constantFrom('dev', 'staging', 'production');

  test('Database cluster should have automated backups enabled with at least 7 days retention', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CommunityActivityTrackerStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database cluster
        const dbClusters = template.findResources('AWS::RDS::DBCluster');
        expect(Object.keys(dbClusters).length).toBeGreaterThanOrEqual(1);

        // Verify backup retention period
        for (const [clusterId, cluster] of Object.entries(dbClusters)) {
          const clusterProps = (cluster as any).Properties;
          
          // BackupRetentionPeriod should be at least 7 days
          expect(clusterProps.BackupRetentionPeriod).toBeDefined();
          expect(clusterProps.BackupRetentionPeriod).toBeGreaterThanOrEqual(7);
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Database cluster should have a preferred backup window configured', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CommunityActivityTrackerStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database cluster
        const dbClusters = template.findResources('AWS::RDS::DBCluster');
        expect(Object.keys(dbClusters).length).toBeGreaterThanOrEqual(1);

        // Verify preferred backup window is configured
        for (const [clusterId, cluster] of Object.entries(dbClusters)) {
          const clusterProps = (cluster as any).Properties;
          
          // PreferredBackupWindow should be defined
          expect(clusterProps.PreferredBackupWindow).toBeDefined();
          expect(typeof clusterProps.PreferredBackupWindow).toBe('string');
          
          // Should be in format HH:MM-HH:MM
          expect(clusterProps.PreferredBackupWindow).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Database cluster should have storage encryption enabled', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CommunityActivityTrackerStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database cluster
        const dbClusters = template.findResources('AWS::RDS::DBCluster');
        expect(Object.keys(dbClusters).length).toBeGreaterThanOrEqual(1);

        // Verify storage encryption
        for (const [clusterId, cluster] of Object.entries(dbClusters)) {
          const clusterProps = (cluster as any).Properties;
          
          // StorageEncrypted should be true
          expect(clusterProps.StorageEncrypted).toBe(true);
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Point-in-time recovery should be implicitly enabled through backup retention', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CommunityActivityTrackerStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database cluster
        const dbClusters = template.findResources('AWS::RDS::DBCluster');
        expect(Object.keys(dbClusters).length).toBeGreaterThanOrEqual(1);

        // Point-in-time recovery is automatically enabled when BackupRetentionPeriod > 0
        for (const [clusterId, cluster] of Object.entries(dbClusters)) {
          const clusterProps = (cluster as any).Properties;
          
          // BackupRetentionPeriod > 0 enables point-in-time recovery
          expect(clusterProps.BackupRetentionPeriod).toBeGreaterThan(0);
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Production database should have deletion protection enabled', () => {
    fc.assert(
      fc.property(environmentConfigArbitrary, (config) => {
        const app = new cdk.App();
        const stack = new CommunityActivityTrackerStack(app, 'TestStack-production', {
          environmentName: 'production',
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database cluster
        const dbClusters = template.findResources('AWS::RDS::DBCluster');
        expect(Object.keys(dbClusters).length).toBeGreaterThanOrEqual(1);

        // Verify deletion protection for production
        for (const [clusterId, cluster] of Object.entries(dbClusters)) {
          const clusterProps = (cluster as any).Properties;
          
          // DeletionProtection should be true for production
          expect(clusterProps.DeletionProtection).toBe(true);
        }
      }),
      { numRuns: getNumRuns() }
    );
  });
});
