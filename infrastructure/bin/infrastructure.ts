#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CultivateStack } from '../lib/cultivate-stack';
import { EnvironmentConfig } from '../lib/types';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environmentName = app.node.tryGetContext('environment') || 'dev';

// Load environment-specific configuration
const config: EnvironmentConfig = app.node.tryGetContext(environmentName);

if (!config) {
  throw new Error(
    `Configuration not found for environment: ${environmentName}. ` +
    `Available environments: dev, staging, production`
  );
}

// Create stack with environment-specific configuration
new CultivateStack(app, `Cultivate-${environmentName}`, {
  environmentName,
  config,
  env: {
    account: config.account,
    region: config.region,
  },
  description: `Cultivate infrastructure for ${environmentName} environment`,
  tags: {
    Environment: environmentName,
    Application: 'Cultivate',
  },
});

app.synth();
