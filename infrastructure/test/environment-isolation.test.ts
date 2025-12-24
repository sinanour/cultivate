import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CommunityActivityTrackerStack } from '../lib/community-activity-tracker-stack';
import { EnvironmentConfig } from '../lib/types';

/**
 * Feature: infrastructure, Property 1: Environment Isolation
 * 
 * For any two different environments (dev, staging, production), the infrastructure
 * resources SHALL be completely isolated with no shared networking or data access
 * between them.
 * 
 * Validates: Requirements 6.3
 */
describe('Property 1: Environment Isolation', () => {
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

    test('Each environment should have its own VPC with unique CIDR blocks', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];
                const vpcCidrs = new Set<string>();

                for (const envName of environments) {
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

                    // Find VPC
                    const vpcs = template.findResources('AWS::EC2::VPC');
                    expect(Object.keys(vpcs).length).toBeGreaterThanOrEqual(1);

                    // Get VPC CIDR
                    for (const [vpcId, vpc] of Object.entries(vpcs)) {
                        const vpcProps = (vpc as any).Properties;
                        const cidr = vpcProps.CidrBlock;

                        expect(cidr).toBeDefined();

                        // CIDR should be unique across environments
                        expect(vpcCidrs.has(cidr)).toBe(false);
                        vpcCidrs.add(cidr);
                    }
                }

                // Should have 3 unique VPC CIDRs (one per environment)
                expect(vpcCidrs.size).toBe(3);
            }),
            { numRuns: 100 }
        );
    });

    test('Each environment should have its own database cluster', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];
                const dbClusterIds = new Set<string>();

                for (const envName of environments) {
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

                    // Each environment should have its own cluster
                    for (const clusterId of Object.keys(dbClusters)) {
                        expect(dbClusterIds.has(clusterId)).toBe(false);
                        dbClusterIds.add(clusterId);
                    }
                }

                // Should have separate database clusters
                expect(dbClusterIds.size).toBeGreaterThanOrEqual(3);
            }),
            { numRuns: 100 }
        );
    });

    test('Each environment should have its own ECS cluster', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];
                const ecsClusterNames = new Set<string>();

                for (const envName of environments) {
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

                    // Find ECS cluster
                    const ecsClusters = template.findResources('AWS::ECS::Cluster');
                    expect(Object.keys(ecsClusters).length).toBeGreaterThanOrEqual(1);

                    // Get cluster name
                    for (const [clusterId, cluster] of Object.entries(ecsClusters)) {
                        const clusterProps = (cluster as any).Properties;
                        const clusterName = clusterProps.ClusterName;

                        expect(clusterName).toBeDefined();
                        expect(clusterName).toContain(envName);

                        // Cluster name should be unique
                        expect(ecsClusterNames.has(clusterName)).toBe(false);
                        ecsClusterNames.add(clusterName);
                    }
                }

                // Should have 3 unique cluster names
                expect(ecsClusterNames.size).toBe(3);
            }),
            { numRuns: 100 }
        );
    });

    test('Each environment should have its own S3 bucket for frontend', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];
                const bucketNames = new Set<string>();

                for (const envName of environments) {
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

                    // Find S3 bucket
                    const s3Buckets = template.findResources('AWS::S3::Bucket');
                    expect(Object.keys(s3Buckets).length).toBeGreaterThanOrEqual(1);

                    // Get bucket name
                    for (const [bucketId, bucket] of Object.entries(s3Buckets)) {
                        const bucketProps = (bucket as any).Properties;
                        const bucketName = bucketProps.BucketName;

                        expect(bucketName).toBeDefined();
                        expect(bucketName).toContain(envName);

                        // Bucket name should be unique
                        expect(bucketNames.has(bucketName)).toBe(false);
                        bucketNames.add(bucketName);
                    }
                }

                // Should have 3 unique bucket names
                expect(bucketNames.size).toBe(3);
            }),
            { numRuns: 100 }
        );
    });

    test('Each environment should have its own secrets in Secrets Manager', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];
                const secretNames = new Set<string>();

                for (const envName of environments) {
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

                    // Find secrets
                    const secrets = template.findResources('AWS::SecretsManager::Secret');
                    expect(Object.keys(secrets).length).toBeGreaterThanOrEqual(1);

                    // Get secret name
                    for (const [secretId, secret] of Object.entries(secrets)) {
                        const secretProps = (secret as any).Properties;
                        const secretName = secretProps.Name;

                        expect(secretName).toBeDefined();
                        expect(secretName).toContain(envName);

                        // Secret name should be unique
                        expect(secretNames.has(secretName)).toBe(false);
                        secretNames.add(secretName);
                    }
                }

                // Should have 3 unique secret names
                expect(secretNames.size).toBe(3);
            }),
            { numRuns: 100 }
        );
    });

    test('Stack names should include environment identifier', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];

                for (const envName of environments) {
                    const app = new cdk.App();
                    const stack = new CommunityActivityTrackerStack(app, `TestStack-${envName}`, {
                        environmentName: envName,
                        config,
                        env: {
                            account: config.account,
                            region: config.region,
                        },
                    });

                    // Stack name should include environment
                    expect(stack.stackName).toContain(envName);
                }
            }),
            { numRuns: 100 }
        );
    });

    test('No VPC peering connections should exist between environments', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];

                for (const envName of environments) {
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

                    // Verify no VPC peering connections exist
                    const peeringConnections = template.findResources('AWS::EC2::VPCPeeringConnection');
                    expect(Object.keys(peeringConnections).length).toBe(0);
                }
            }),
            { numRuns: 100 }
        );
    });

    test('CloudWatch log groups should be environment-specific', () => {
        fc.assert(
            fc.property(environmentConfigArbitrary, (config) => {
                const environments = ['dev', 'staging', 'production'];
                const logGroupNames = new Set<string>();

                for (const envName of environments) {
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

                    // Find log groups
                    const logGroups = template.findResources('AWS::Logs::LogGroup');

                    // Get log group names
                    for (const [logGroupId, logGroup] of Object.entries(logGroups)) {
                        const logGroupProps = (logGroup as any).Properties;
                        const logGroupName = logGroupProps.LogGroupName;

                        expect(logGroupName).toBeDefined();
                        expect(logGroupName).toContain(envName);

                        // Log group name should be unique
                        expect(logGroupNames.has(logGroupName)).toBe(false);
                        logGroupNames.add(logGroupName);
                    }
                }
            }),
            { numRuns: 100 }
        );
    });
});
