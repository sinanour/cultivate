# Cultivate Infrastructure

AWS CDK infrastructure for the Cultivate system.

## Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## Installation

```bash
npm install
```

## Configuration

Environment-specific configuration is defined in `cdk.json` under the `context` section. Three environments are supported:

- **dev**: Development environment with minimal resources
- **staging**: Staging environment for testing
- **production**: Production environment with high availability

## Deployment

### Deploy to Development

```bash
npm run cdk deploy -- -c environment=dev
```

### Deploy to Staging

```bash
npm run cdk deploy -- -c environment=staging
```

### Deploy to Production

```bash
npm run cdk deploy -- -c environment=production
```

## Stack Outputs

After deployment, the following outputs are available:

- **VpcId**: VPC identifier
- **DatabaseSecretArn**: ARN of the database credentials secret
- **DatabaseEndpoint**: Aurora database endpoint
- **ApiEndpoint**: Application Load Balancer DNS name
- **FrontendUrl**: CloudFront distribution domain name
- **FrontendBucketName**: S3 bucket name for frontend assets
- **EcsClusterName**: ECS cluster name

## Architecture

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public and private subnets
- **Aurora Serverless v2**: PostgreSQL database with auto-scaling
- **ECS Fargate**: Container orchestration for the API
- **Application Load Balancer**: HTTPS load balancer for the API
- **S3 + CloudFront**: Static hosting for the web frontend
- **CloudWatch**: Monitoring, logging, and alarms
- **Secrets Manager**: Secure credential storage

## Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm run test` - Run unit tests
- `npm run cdk synth` - Synthesize CloudFormation template
- `npm run cdk diff` - Compare deployed stack with current state
- `npm run cdk deploy` - Deploy stack to AWS
- `npm run cdk destroy` - Remove stack from AWS

## Security

- Database is deployed in private subnets with no internet access
- Security groups follow least-privilege principles
- All data is encrypted at rest and in transit
- Secrets are managed via AWS Secrets Manager with automatic rotation
- VPC Flow Logs enabled for network monitoring

## Cost Optimization

- Aurora Serverless v2 scales down to minimum capacity when idle
- CloudFront caching reduces origin requests
- S3 lifecycle policies archive old logs
- Resource tagging enables cost allocation tracking

## Disaster Recovery

- Automated database backups with 7-day retention
- Point-in-time recovery enabled
- S3 versioning for frontend assets
- Multi-AZ deployment for high availability
