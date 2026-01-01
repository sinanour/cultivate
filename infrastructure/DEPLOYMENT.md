# Deployment Guide

This guide provides step-by-step instructions for deploying the Cultivate infrastructure to AWS.

## Prerequisites

1. **AWS Account**: You need an AWS account with appropriate permissions
2. **AWS CLI**: Install and configure AWS CLI with credentials
   ```bash
   aws configure
   ```
3. **Node.js**: Version 20 or higher
4. **AWS CDK CLI**: Install globally
   ```bash
   npm install -g aws-cdk
   ```

## Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Bootstrap CDK** (first time only per account/region)
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

## Configuration

Before deploying, update the account numbers in `cdk.json`:

```json
"dev": {
  "account": "YOUR-AWS-ACCOUNT-ID",
  "region": "us-east-1",
  ...
}
```

## Deployment Steps

### 1. Deploy to Development Environment

```bash
# Synthesize CloudFormation template
npm run synth -- -c environment=dev

# Review changes
npm run diff -- -c environment=dev

# Deploy
npm run deploy -- -c environment=dev
```

### 2. Verify Deployment

After deployment completes, verify the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name CommunityActivityTracker-dev \
  --query 'Stacks[0].Outputs'
```

Expected outputs:
- VpcId
- DatabaseSecretArn
- DatabaseEndpoint
- ApiEndpoint
- FrontendUrl
- FrontendBucketName
- EcsClusterName

### 3. Test Database Connectivity

```bash
# Get database credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id dev/community-tracker/database \
  --query SecretString \
  --output text

# Connect to database (from within VPC or via bastion host)
psql -h <DatabaseEndpoint> -U dbadmin -d communitytracker
```

### 4. Deploy API Container

The infrastructure creates an ECS cluster and service, but you need to build and push the API container image:

```bash
# Build API container (from backend-api directory)
docker build -t community-tracker-api .

# Tag for ECR
docker tag community-tracker-api:latest \
  ACCOUNT-ID.dkr.ecr.REGION.amazonaws.com/community-tracker-api:latest

# Push to ECR
docker push ACCOUNT-ID.dkr.ecr.REGION.amazonaws.com/community-tracker-api:latest

# Update ECS service to use new image
aws ecs update-service \
  --cluster dev-community-tracker \
  --service ApiService \
  --force-new-deployment
```

### 5. Deploy Frontend Assets

```bash
# Build frontend (from web-frontend directory)
npm run build

# Sync to S3
aws s3 sync dist/ s3://FRONTEND-BUCKET-NAME/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION-ID \
  --paths "/*"
```

## Deploy to Staging

```bash
npm run deploy -- -c environment=staging
```

Follow the same verification and deployment steps as development.

## Deploy to Production

```bash
npm run deploy -- -c environment=production
```

**Important**: Production deployments should:
1. Be reviewed by multiple team members
2. Have all tests passing
3. Be deployed during maintenance windows
4. Have rollback plan ready

## Monitoring

After deployment, configure CloudWatch alarm notifications:

```bash
# Subscribe to critical alarms
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:dev-community-tracker-critical-alarms \
  --protocol email \
  --notification-endpoint your-email@example.com

# Subscribe to warning alarms
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:dev-community-tracker-warning-alarms \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Rollback

If deployment fails or issues are detected:

```bash
# Rollback to previous version
aws cloudformation rollback-stack \
  --stack-name CommunityActivityTracker-dev
```

## Cleanup

To remove all infrastructure:

```bash
npm run destroy -- -c environment=dev
```

**Warning**: This will delete all resources including databases and S3 buckets. Ensure you have backups before destroying production environments.

## Troubleshooting

### Deployment Fails

1. Check CloudFormation events:
   ```bash
   aws cloudformation describe-stack-events \
     --stack-name CommunityActivityTracker-dev
   ```

2. Review CDK synthesis output for errors:
   ```bash
   npm run synth -- -c environment=dev
   ```

### Database Connection Issues

1. Verify security groups allow traffic from API
2. Check database is in AVAILABLE state
3. Verify credentials in Secrets Manager

### API Not Responding

1. Check ECS task status:
   ```bash
   aws ecs list-tasks --cluster dev-community-tracker
   ```

2. View container logs:
   ```bash
   aws logs tail /ecs/dev/community-tracker-api --follow
   ```

3. Verify ALB target health:
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn TARGET-GROUP-ARN
   ```

## Cost Estimation

Approximate monthly costs for each environment:

- **Development**: $50-100/month
  - Aurora Serverless v2: $20-40
  - ECS Fargate: $15-30
  - CloudFront: $5-10
  - Other services: $10-20

- **Staging**: $100-200/month
- **Production**: $300-500/month (depends on traffic)

Use AWS Cost Explorer to monitor actual costs and set up billing alarms.
