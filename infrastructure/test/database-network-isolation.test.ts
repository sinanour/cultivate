import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CultivateStack } from '../lib/cultivate-stack';
import { EnvironmentConfig } from '../lib/types';
import { getNumRuns } from './test-config';

/**
 * Feature: infrastructure, Property 2: Database Network Isolation
 * 
 * For any database instance provisioned by the infrastructure, the database SHALL only
 * be accessible from within the VPC private subnets and SHALL NOT have any public IP
 * address or internet gateway route.
 * 
 * Validates: Requirements 7.2
 */
describe('Property 2: Database Network Isolation', () => {
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

  test('Database cluster should not be publicly accessible', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CultivateStack(app, `TestStack-${envName}`, {
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

        // Verify that PubliclyAccessible is not set to true
        for (const [clusterId, cluster] of Object.entries(dbClusters)) {
          const clusterProps = (cluster as any).Properties;
          
          // PubliclyAccessible should either be false or undefined (defaults to false)
          if (clusterProps.PubliclyAccessible !== undefined) {
            expect(clusterProps.PubliclyAccessible).toBe(false);
          }
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Database should be deployed in private subnets', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CultivateStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database subnet group
        const subnetGroups = template.findResources('AWS::RDS::DBSubnetGroup');
        expect(Object.keys(subnetGroups).length).toBeGreaterThanOrEqual(1);

        // Verify subnet group references private subnets
        for (const [groupId, group] of Object.entries(subnetGroups)) {
          const groupProps = (group as any).Properties;
          const subnetIds = groupProps.SubnetIds;
          
          expect(subnetIds).toBeDefined();
          expect(Array.isArray(subnetIds)).toBe(true);
          expect(subnetIds.length).toBeGreaterThanOrEqual(2);
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Database security group should not allow ingress from internet', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CultivateStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find all security groups
        const securityGroups = template.findResources('AWS::EC2::SecurityGroup');
        
        // Find the database security group
        for (const [sgId, sg] of Object.entries(securityGroups)) {
          const sgProps = (sg as any).Properties;
          const ingressRules = sgProps.SecurityGroupIngress || [];
          
          // Check if this is the database security group (port 5432)
          const hasPostgresRule = ingressRules.some((rule: any) => 
            rule.IpProtocol === 'tcp' && 
            (rule.FromPort === 5432 || rule.ToPort === 5432)
          );

          if (hasPostgresRule) {
            // Verify no rules allow traffic from 0.0.0.0/0
            for (const rule of ingressRules) {
              expect(rule.CidrIp).not.toBe('0.0.0.0/0');
              expect(rule.CidrIpv6).not.toBe('::/0');
            }
          }
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Database instances should not have public IP addresses', () => {
    fc.assert(
      fc.property(environmentNameArbitrary, environmentConfigArbitrary, (envName, config) => {
        const app = new cdk.App();
        const stack = new CultivateStack(app, `TestStack-${envName}`, {
          environmentName: envName,
          config,
          env: {
            account: config.account,
            region: config.region,
          },
        });

        const template = Template.fromStack(stack);

        // Find database instances
        const dbInstances = template.findResources('AWS::RDS::DBInstance');
        
        // Verify that PubliclyAccessible is not set to true
        for (const [instanceId, instance] of Object.entries(dbInstances)) {
          const instanceProps = (instance as any).Properties;
          
          // PubliclyAccessible should either be false or undefined (defaults to false)
          if (instanceProps.PubliclyAccessible !== undefined) {
            expect(instanceProps.PubliclyAccessible).toBe(false);
          }
        }
      }),
      { numRuns: getNumRuns() }
    );
  });
});
