import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CultivateStack } from '../lib/cultivate-stack';
import { EnvironmentConfig } from '../lib/types';
import { getNumRuns } from './test-config';

/**
 * Feature: infrastructure, Property 10: CDK Synthesis Validity
 * 
 * For any environment configuration, running `cdk synth` SHALL produce valid
 * CloudFormation templates without errors and SHALL include all required resources.
 * 
 * Validates: Requirements 1.3, 1.5
 */
describe('Property 10: CDK Synthesis Validity', () => {
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

    test('CDK synthesis should produce valid CloudFormation template', () => {
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

                // Synthesize the stack
                const template = Template.fromStack(stack);
                const cfnTemplate = template.toJSON();

                // Verify CloudFormation template structure
                expect(cfnTemplate).toBeDefined();
                expect(cfnTemplate.Resources).toBeDefined();
                expect(typeof cfnTemplate.Resources).toBe('object');

                // Should have resources
                expect(Object.keys(cfnTemplate.Resources).length).toBeGreaterThan(0);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include VPC resources', () => {
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

                // Should have VPC
                const vpcs = template.findResources('AWS::EC2::VPC');
                expect(Object.keys(vpcs).length).toBeGreaterThanOrEqual(1);

                // Should have subnets
                const subnets = template.findResources('AWS::EC2::Subnet');
                expect(Object.keys(subnets).length).toBeGreaterThanOrEqual(4);

                // Should have security groups
                const securityGroups = template.findResources('AWS::EC2::SecurityGroup');
                expect(Object.keys(securityGroups).length).toBeGreaterThanOrEqual(3);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include database resources', () => {
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

                // Should have database cluster
                const dbClusters = template.findResources('AWS::RDS::DBCluster');
                expect(Object.keys(dbClusters).length).toBeGreaterThanOrEqual(1);

                // Should have database instances
                const dbInstances = template.findResources('AWS::RDS::DBInstance');
                expect(Object.keys(dbInstances).length).toBeGreaterThanOrEqual(2);

                // Should have database subnet group
                const subnetGroups = template.findResources('AWS::RDS::DBSubnetGroup');
                expect(Object.keys(subnetGroups).length).toBeGreaterThanOrEqual(1);

                // Should have database secret
                const secrets = template.findResources('AWS::SecretsManager::Secret');
                expect(Object.keys(secrets).length).toBeGreaterThanOrEqual(1);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include ECS resources', () => {
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

                // Should have ECS cluster
                const ecsClusters = template.findResources('AWS::ECS::Cluster');
                expect(Object.keys(ecsClusters).length).toBeGreaterThanOrEqual(1);

                // Should have ECS task definition
                const taskDefinitions = template.findResources('AWS::ECS::TaskDefinition');
                expect(Object.keys(taskDefinitions).length).toBeGreaterThanOrEqual(1);

                // Should have ECS service
                const services = template.findResources('AWS::ECS::Service');
                expect(Object.keys(services).length).toBeGreaterThanOrEqual(1);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include load balancer resources', () => {
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

                // Should have load balancer
                const albs = template.findResources('AWS::ElasticLoadBalancingV2::LoadBalancer');
                expect(Object.keys(albs).length).toBeGreaterThanOrEqual(1);

                // Should have target group
                const targetGroups = template.findResources('AWS::ElasticLoadBalancingV2::TargetGroup');
                expect(Object.keys(targetGroups).length).toBeGreaterThanOrEqual(1);

                // Should have listener
                const listeners = template.findResources('AWS::ElasticLoadBalancingV2::Listener');
                expect(Object.keys(listeners).length).toBeGreaterThanOrEqual(1);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include S3 and CloudFront resources', () => {
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

                // Should have S3 bucket
                const s3Buckets = template.findResources('AWS::S3::Bucket');
                expect(Object.keys(s3Buckets).length).toBeGreaterThanOrEqual(1);

                // Should have CloudFront distribution
                const distributions = template.findResources('AWS::CloudFront::Distribution');
                expect(Object.keys(distributions).length).toBeGreaterThanOrEqual(1);

                // Note: We use Origin Access Control (OAC) instead of Origin Access Identity (OAI)
                // OAC is created automatically by S3BucketOrigin.withOriginAccessControl()
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include monitoring resources', () => {
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

                // Should have CloudWatch alarms
                const alarms = template.findResources('AWS::CloudWatch::Alarm');
                expect(Object.keys(alarms).length).toBeGreaterThanOrEqual(3);

                // Should have SNS topics
                const topics = template.findResources('AWS::SNS::Topic');
                expect(Object.keys(topics).length).toBeGreaterThanOrEqual(2);

                // Should have CloudWatch dashboard
                const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
                expect(Object.keys(dashboards).length).toBeGreaterThanOrEqual(1);

                // Should have log groups
                const logGroups = template.findResources('AWS::Logs::LogGroup');
                expect(Object.keys(logGroups).length).toBeGreaterThanOrEqual(1);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Synthesized template should include stack outputs', () => {
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
                const cfnTemplate = template.toJSON();

                // Should have outputs
                expect(cfnTemplate.Outputs).toBeDefined();
                expect(typeof cfnTemplate.Outputs).toBe('object');

                // Should have required outputs
                const outputKeys = Object.keys(cfnTemplate.Outputs);
                expect(outputKeys.length).toBeGreaterThanOrEqual(7);

                // Verify specific outputs exist
                const requiredOutputs = [
                    'VpcId',
                    'DatabaseSecretArn',
                    'DatabaseEndpoint',
                    'ApiEndpoint',
                    'FrontendUrl',
                    'FrontendBucketName',
                    'EcsClusterName'
                ];

                for (const requiredOutput of requiredOutputs) {
                    expect(outputKeys).toContain(requiredOutput);
                }
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Template should be valid JSON', () => {
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
                const cfnTemplate = template.toJSON();

                // Should be able to stringify and parse
                const jsonString = JSON.stringify(cfnTemplate);
                expect(jsonString).toBeDefined();

                const parsed = JSON.parse(jsonString);
                expect(parsed).toEqual(cfnTemplate);
            }),
            { numRuns: getNumRuns() }
        );
    });

    test('Template should have valid CloudFormation version', () => {
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
                const cfnTemplate = template.toJSON();

                // CDK templates use Transform instead of AWSTemplateFormatVersion
                // Verify the template has either Transform or AWSTemplateFormatVersion
                const hasTransform = cfnTemplate.Transform !== undefined;
                const hasVersion = cfnTemplate.AWSTemplateFormatVersion !== undefined;

                expect(hasTransform || hasVersion).toBe(true);

                // If it has a version, it should be the standard CloudFormation version
                if (hasVersion) {
                    expect(cfnTemplate.AWSTemplateFormatVersion).toBe('2010-09-09');
                }
            }),
            { numRuns: getNumRuns() }
        );
    });
});
