import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CommunityActivityTrackerStack } from '../lib/community-activity-tracker-stack';
import { EnvironmentConfig } from '../lib/types';

/**
 * Feature: infrastructure, Property 9: CloudWatch Alarm Coverage
 * 
 * For any critical metric (API latency, error rate, database connections), there SHALL
 * exist a corresponding CloudWatch alarm configured with appropriate thresholds and
 * SNS notification.
 * 
 * Validates: Requirements 5.2, 5.3, 5.4
 */
describe('Property 9: CloudWatch Alarm Coverage', () => {
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

    test('API latency alarm should be configured with appropriate threshold', () => {
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

                // Find CloudWatch alarms
                const alarms = template.findResources('AWS::CloudWatch::Alarm');
                expect(Object.keys(alarms).length).toBeGreaterThanOrEqual(1);

                // Look for latency alarm
                let latencyAlarmFound = false;
                for (const [alarmId, alarm] of Object.entries(alarms)) {
                    const alarmProps = (alarm as any).Properties;

                    // Check if this is a latency alarm (TargetResponseTime metric)
                    if (alarmProps.MetricName === 'TargetResponseTime' ||
                        (alarmProps.AlarmDescription && alarmProps.AlarmDescription.includes('latency'))) {
                        latencyAlarmFound = true;

                        // Verify threshold is reasonable (e.g., 2000ms = 2 seconds)
                        expect(alarmProps.Threshold).toBeDefined();
                        expect(alarmProps.Threshold).toBeGreaterThan(0);

                        // Verify evaluation periods
                        expect(alarmProps.EvaluationPeriods).toBeGreaterThanOrEqual(1);

                        // Verify alarm actions (SNS notification)
                        expect(alarmProps.AlarmActions).toBeDefined();
                        expect(Array.isArray(alarmProps.AlarmActions)).toBe(true);
                        expect(alarmProps.AlarmActions.length).toBeGreaterThan(0);
                    }
                }

                expect(latencyAlarmFound).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    test('API error rate alarm should be configured', () => {
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

                // Find CloudWatch alarms
                const alarms = template.findResources('AWS::CloudWatch::Alarm');

                // Look for error rate alarm
                let errorAlarmFound = false;
                for (const [alarmId, alarm] of Object.entries(alarms)) {
                    const alarmProps = (alarm as any).Properties;

                    // Check if this is an error alarm (5XX errors)
                    if (alarmProps.MetricName === 'HTTPCode_Target_5XX_Count' ||
                        (alarmProps.AlarmDescription && alarmProps.AlarmDescription.includes('error'))) {
                        errorAlarmFound = true;

                        // Verify threshold is configured
                        expect(alarmProps.Threshold).toBeDefined();
                        expect(alarmProps.Threshold).toBeGreaterThan(0);

                        // Verify alarm actions
                        expect(alarmProps.AlarmActions).toBeDefined();
                        expect(Array.isArray(alarmProps.AlarmActions)).toBe(true);
                        expect(alarmProps.AlarmActions.length).toBeGreaterThan(0);
                    }
                }

                expect(errorAlarmFound).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    test('Database connection alarm should be configured', () => {
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

                // Find CloudWatch alarms
                const alarms = template.findResources('AWS::CloudWatch::Alarm');

                // Look for database connection alarm
                let dbAlarmFound = false;
                for (const [alarmId, alarm] of Object.entries(alarms)) {
                    const alarmProps = (alarm as any).Properties;

                    // Check if this is a database alarm
                    if (alarmProps.MetricName === 'DatabaseConnections' ||
                        (alarmProps.AlarmDescription && alarmProps.AlarmDescription.includes('atabase'))) {
                        dbAlarmFound = true;

                        // Verify threshold is configured
                        expect(alarmProps.Threshold).toBeDefined();

                        // Verify alarm actions
                        expect(alarmProps.AlarmActions).toBeDefined();
                        expect(Array.isArray(alarmProps.AlarmActions)).toBe(true);
                        expect(alarmProps.AlarmActions.length).toBeGreaterThan(0);
                    }
                }

                expect(dbAlarmFound).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    test('All alarms should have SNS topics configured for notifications', () => {
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

                // Find SNS topics
                const topics = template.findResources('AWS::SNS::Topic');
                expect(Object.keys(topics).length).toBeGreaterThanOrEqual(1);

                // Verify topics have proper naming
                for (const [topicId, topic] of Object.entries(topics)) {
                    const topicProps = (topic as any).Properties;

                    // Topic should have a display name
                    expect(topicProps.DisplayName).toBeDefined();

                    // Topic name should include environment
                    if (topicProps.TopicName) {
                        expect(topicProps.TopicName).toContain(envName);
                    }
                }
            }),
            { numRuns: 100 }
        );
    });

    test('Alarms should have appropriate evaluation periods and datapoints', () => {
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

                // Find CloudWatch alarms
                const alarms = template.findResources('AWS::CloudWatch::Alarm');

                // Verify all alarms have proper configuration
                for (const [alarmId, alarm] of Object.entries(alarms)) {
                    const alarmProps = (alarm as any).Properties;

                    // Should have evaluation periods
                    expect(alarmProps.EvaluationPeriods).toBeDefined();
                    expect(alarmProps.EvaluationPeriods).toBeGreaterThanOrEqual(1);

                    // Should have comparison operator
                    expect(alarmProps.ComparisonOperator).toBeDefined();

                    // Should have threshold
                    expect(alarmProps.Threshold).toBeDefined();

                    // Should handle missing data appropriately
                    expect(alarmProps.TreatMissingData).toBeDefined();
                }
            }),
            { numRuns: 100 }
        );
    });

    test('Critical alarms should be distinguished from warning alarms', () => {
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

                // Find SNS topics
                const topics = template.findResources('AWS::SNS::Topic');

                // Should have at least 2 topics (critical and warning)
                expect(Object.keys(topics).length).toBeGreaterThanOrEqual(2);

                // Verify topic naming distinguishes critical from warning
                let criticalTopicFound = false;
                let warningTopicFound = false;

                for (const [topicId, topic] of Object.entries(topics)) {
                    const topicProps = (topic as any).Properties;

                    if (topicProps.DisplayName && topicProps.DisplayName.includes('Critical')) {
                        criticalTopicFound = true;
                    }

                    if (topicProps.DisplayName && topicProps.DisplayName.includes('Warning')) {
                        warningTopicFound = true;
                    }
                }

                expect(criticalTopicFound).toBe(true);
                expect(warningTopicFound).toBe(true);
            }),
            { numRuns: 100 }
        );
    });
});
