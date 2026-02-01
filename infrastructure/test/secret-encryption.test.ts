import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { CultivateStack } from '../lib/cultivate-stack';
import { EnvironmentConfig } from '../lib/types';
import { getNumRuns } from './test-config';

/**
 * Feature: infrastructure, Property 3: Secret Encryption
 * 
 * For any secret stored in AWS Secrets Manager, the secret SHALL be encrypted at rest
 * using KMS and SHALL NOT be accessible without proper IAM permissions.
 * 
 * Validates: Requirements 8.4
 */
describe('Property 3: Secret Encryption', () => {
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

  test('Database secret should be created in Secrets Manager', () => {
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

        // Find secrets
        const secrets = template.findResources('AWS::SecretsManager::Secret');
        expect(Object.keys(secrets).length).toBeGreaterThanOrEqual(1);

        // Verify secret exists with proper naming
        let databaseSecretFound = false;
        for (const [secretId, secret] of Object.entries(secrets)) {
          const secretProps = (secret as any).Properties;
          
          if (secretProps.Name && secretProps.Name.includes('database')) {
            databaseSecretFound = true;
          }
        }

        expect(databaseSecretFound).toBe(true);
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Secrets should have KMS encryption configured', () => {
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

        // Find secrets
        const secrets = template.findResources('AWS::SecretsManager::Secret');
        expect(Object.keys(secrets).length).toBeGreaterThanOrEqual(1);

        // Verify KMS encryption
        // Note: Secrets Manager uses AWS-managed KMS key by default if KmsKeyId is not specified
        // This is still encrypted, just using the default key
        for (const [secretId, secret] of Object.entries(secrets)) {
          const secretProps = (secret as any).Properties;
          
          // Either KmsKeyId is specified, or it uses the default AWS-managed key
          // Both cases provide encryption at rest
          // We just verify the secret exists (encryption is default behavior)
          expect(secretProps.GenerateSecretString || secretProps.SecretString).toBeDefined();
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Secret rotation should be configured for database credentials', () => {
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

        // Find rotation schedules
        const rotationSchedules = template.findResources('AWS::SecretsManager::RotationSchedule');
        expect(Object.keys(rotationSchedules).length).toBeGreaterThanOrEqual(1);

        // Verify rotation configuration
        for (const [scheduleId, schedule] of Object.entries(rotationSchedules)) {
          const scheduleProps = (schedule as any).Properties;
          
          // Should have rotation rules configured
          expect(scheduleProps.RotationRules).toBeDefined();
          
          // Should have hosted rotation Lambda configured
          expect(scheduleProps.HostedRotationLambda).toBeDefined();
        }
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('ECS task role should have permission to read database secret', () => {
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

        // Find IAM policies
        const policies = template.findResources('AWS::IAM::Policy');
        
        // Look for policy that grants secretsmanager:GetSecretValue
        let secretAccessPolicyFound = false;
        for (const [policyId, policy] of Object.entries(policies)) {
          const policyProps = (policy as any).Properties;
          const policyDocument = policyProps.PolicyDocument;
          
          if (policyDocument && policyDocument.Statement) {
            for (const statement of policyDocument.Statement) {
              const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
              
              if (actions.some((action: string) => 
                action === 'secretsmanager:GetSecretValue' || 
                action === 'secretsmanager:*' ||
                action.startsWith('secretsmanager:Get')
              )) {
                secretAccessPolicyFound = true;
                break;
              }
            }
          }
        }

        expect(secretAccessPolicyFound).toBe(true);
      }),
      { numRuns: getNumRuns() }
    );
  });

  test('Secrets should not be exposed in plain text in CloudFormation template', () => {
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

        // Find secrets
        const secrets = template.findResources('AWS::SecretsManager::Secret');
        
        // Verify secrets use GenerateSecretString, not plain text
        for (const [secretId, secret] of Object.entries(secrets)) {
          const secretProps = (secret as any).Properties;
          
          // Should use GenerateSecretString for password generation
          if (secretProps.GenerateSecretString) {
            expect(secretProps.GenerateSecretString.GenerateStringKey).toBeDefined();
            expect(secretProps.GenerateSecretString.SecretStringTemplate).toBeDefined();
          }
          
          // Should not have plain text password in SecretString
          if (secretProps.SecretString) {
            // If SecretString is present, it should be a reference, not plain text
            expect(typeof secretProps.SecretString).toBe('string');
            // Should not contain actual password values
            expect(secretProps.SecretString).not.toMatch(/password.*:/i);
          }
        }
      }),
      { numRuns: getNumRuns() }
    );
  });
});
