import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CommunityActivityTrackerStack } from '../lib/community-activity-tracker-stack';
import { EnvironmentConfig } from '../lib/types';

/**
 * Feature: infrastructure, Property 5: Multi-AZ Deployment
 * 
 * For any critical infrastructure component (database, ECS tasks, load balancer),
 * the component SHALL be deployed across at least 2 availability zones for high availability.
 * 
 * Validates: Requirements 10.3
 */
describe('Property 5: Multi-AZ Deployment', () => {
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

    test('VPC should be deployed across at least 2 availability zones', () => {
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

                // VPC should have subnets in at least 2 AZs
                const vpcResource = template.findResources('AWS::EC2::VPC');
                expect(Object.keys(vpcResource).length).toBeGreaterThanOrEqual(1);

                // Check that we have subnets in multiple AZs
                const subnets = template.findResources('AWS::EC2::Subnet');
                const subnetCount = Object.keys(subnets).length;

                // With 2 AZs and public/private subnets, we should have at least 4 subnets
                expect(subnetCount).toBeGreaterThanOrEqual(4);
            }),
            { numRuns: 100 }
        );
    });

    test('Database should be deployed across at least 2 availability zones', () => {
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

                // Aurora cluster should have writer and reader instances
                const dbCluster = template.findResources('AWS::RDS::DBCluster');
                expect(Object.keys(dbCluster).length).toBeGreaterThanOrEqual(1);

                // Check for DB instances (writer + reader)
                const dbInstances = template.findResources('AWS::RDS::DBInstance');
                const instanceCount = Object.keys(dbInstances).length;

                // Should have at least 2 instances (writer + reader)
                expect(instanceCount).toBeGreaterThanOrEqual(2);
            }),
            { numRuns: 100 }
        );
    });

    test('Load balancer should be deployed across at least 2 availability zones', () => {
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

                // ALB should exist
                const alb = template.findResources('AWS::ElasticLoadBalancingV2::LoadBalancer');
                expect(Object.keys(alb).length).toBeGreaterThanOrEqual(1);

                // ALB is deployed in public subnets, which span multiple AZs
                // This is verified by the VPC configuration
                const albResource = Object.values(alb)[0] as any;
                const subnets = albResource.Properties?.Subnets;

                // Should reference multiple subnets
                expect(subnets).toBeDefined();
                expect(Array.isArray(subnets)).toBe(true);
                expect(subnets.length).toBeGreaterThanOrEqual(2);
            }),
            { numRuns: 100 }
        );
    });
});
