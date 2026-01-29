# Cloud Migration Guide

## Overview

This guide provides detailed migration paths for deploying the Community Activity Tracker application to major cloud platforms. The current Docker Compose-based deployment can be migrated to AWS ECS/Fargate, Google Cloud Run, or Azure Container Instances with minimal code changes.

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [AWS Migration Path](#aws-migration-path)
3. [Google Cloud Migration Path](#google-cloud-migration-path)
4. [Azure Migration Path](#azure-migration-path)
5. [Cloud-Specific Considerations](#cloud-specific-considerations)
6. [Cost Optimization](#cost-optimization)
7. [Migration Testing Strategy](#migration-testing-strategy)

---

## Pre-Migration Checklist

Before migrating to any cloud platform, ensure the following prerequisites are met:

### Application Readiness

- [ ] All containers follow OCI standards
- [ ] Configuration is externalized via environment variables
- [ ] Health check endpoints are implemented and tested
- [ ] Logging outputs to stdout/stderr
- [ ] Graceful shutdown handlers are implemented
- [ ] Application is stateless (state in database only)
- [ ] Database connection supports TCP (not just Unix sockets)

### Infrastructure Preparation

- [ ] Container images are pushed to a container registry
- [ ] Database backup and migration plan is prepared
- [ ] SSL/TLS certificates are available
- [ ] DNS records are ready for update
- [ ] Monitoring and alerting requirements are defined
- [ ] Disaster recovery plan is documented

### Security Requirements

- [ ] IAM roles and policies are defined
- [ ] Network security groups/firewall rules are planned
- [ ] Secrets management strategy is defined
- [ ] Compliance requirements are documented
- [ ] Encryption at rest and in transit is planned

---

## AWS Migration Path

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         AWS Cloud                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    VPC (10.0.0.0/16)                 │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Public Subnet (10.0.1.0/24)                   │ │  │
│  │  │                                                 │ │  │
│  │  │  ┌──────────────────────────────────────────┐  │ │  │
│  │  │  │  Application Load Balancer (ALB)         │  │ │  │
│  │  │  │  - HTTPS Listener (443)                  │  │ │  │
│  │  │  │  - HTTP Listener (80) → Redirect to 443  │  │ │  │
│  │  │  │  - ACM Certificate                       │  │ │  │
│  │  │  └──────────────┬───────────────────────────┘  │ │  │
│  │  └─────────────────┼──────────────────────────────┘ │  │
│  │                    │                                 │  │
│  │  ┌─────────────────▼──────────────────────────────┐ │  │
│  │  │  Private Subnet (10.0.2.0/24)                  │ │  │
│  │  │                                                 │ │  │
│  │  │  ┌──────────────────────────────────────────┐  │ │  │
│  │  │  │  ECS Cluster                             │  │ │  │
│  │  │  │                                          │  │ │  │
│  │  │  │  ┌────────────────────────────────────┐ │  │ │  │
│  │  │  │  │  Frontend Service (Fargate)        │ │  │ │  │
│  │  │  │  │  - Nginx container                 │ │  │ │  │
│  │  │  │  │  - Auto-scaling: 2-10 tasks        │ │  │ │  │
│  │  │  │  └────────────────────────────────────┘ │  │ │  │
│  │  │  │                                          │  │ │  │
│  │  │  │  ┌────────────────────────────────────┐ │  │ │  │
│  │  │  │  │  Backend Service (Fargate)         │ │  │ │  │
│  │  │  │  │  - Node.js/Express container       │ │  │ │  │
│  │  │  │  │  - Auto-scaling: 2-10 tasks        │ │  │ │  │
│  │  │  │  └────────────────────────────────────┘ │  │ │  │
│  │  │  └──────────────────────────────────────────┘  │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Private Subnet (10.0.3.0/24) - Database        │ │  │
│  │  │                                                  │ │  │
│  │  │  ┌────────────────────────────────────────────┐ │ │  │
│  │  │  │  RDS PostgreSQL (Multi-AZ)                 │ │ │  │
│  │  │  │  - db.t3.medium                            │ │ │  │
│  │  │  │  - Automated backups                       │ │ │  │
│  │  │  │  - IAM authentication enabled              │ │ │  │
│  │  │  └────────────────────────────────────────────┘ │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Supporting Services:                                      │
│  - ECR (Container Registry)                                │
│  - Secrets Manager (Database credentials, API keys)        │
│  - CloudWatch (Logs and Metrics)                           │
│  - Route 53 (DNS)                                          │
│  - ACM (SSL/TLS Certificates)                              │
│  - EFS (Optional: Shared file storage)                     │
└─────────────────────────────────────────────────────────────┘
```


### Step-by-Step AWS Migration

#### Step 1: Set Up Container Registry (ECR)

```bash
# Create ECR repositories
aws ecr create-repository --repository-name cat-frontend
aws ecr create-repository --repository-name cat-backend

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push images
docker tag cat-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/cat-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/cat-frontend:latest

docker tag cat-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/cat-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/cat-backend:latest
```

#### Step 2: Create VPC and Networking

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=cat-vpc}]'

# Create subnets
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=cat-public-1a}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.2.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=cat-private-1a}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.3.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=cat-private-1b}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=cat-igw}]'
aws ec2 attach-internet-gateway --vpc-id <vpc-id> --internet-gateway-id <igw-id>

# Create NAT Gateway (for private subnets to access internet)
aws ec2 allocate-address --domain vpc
aws ec2 create-nat-gateway --subnet-id <public-subnet-id> --allocation-id <eip-allocation-id>

# Configure route tables
# (Public subnet routes to IGW, private subnets route to NAT Gateway)
```

#### Step 3: Set Up RDS PostgreSQL

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name cat-db-subnet-group \
  --db-subnet-group-description "Subnet group for Community Tracker DB" \
  --subnet-ids <private-subnet-1-id> <private-subnet-2-id>

# Create security group for RDS
aws ec2 create-security-group \
  --group-name cat-db-sg \
  --description "Security group for Community Tracker database" \
  --vpc-id <vpc-id>

# Allow PostgreSQL access from ECS tasks
aws ec2 authorize-security-group-ingress \
  --group-id <db-sg-id> \
  --protocol tcp \
  --port 5432 \
  --source-group <ecs-sg-id>

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier cat-database \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.3 \
  --master-username dbadmin \
  --master-user-password <secure-password> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids <db-sg-id> \
  --db-subnet-group-name cat-db-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --enable-iam-database-authentication \
  --storage-encrypted
```

#### Step 4: Store Secrets in Secrets Manager

```bash
# Store database credentials
aws secretsmanager create-secret \
  --name cat/database/credentials \
  --description "Database credentials for Community Tracker" \
  --secret-string '{"username":"dbadmin","password":"<secure-password>","host":"<rds-endpoint>","port":"5432","database":"community_tracker"}'

# Store API keys
aws secretsmanager create-secret \
  --name cat/api/keys \
  --description "API keys for Community Tracker" \
  --secret-string '{"api_key":"<your-api-key>"}'
```

#### Step 5: Create ECS Cluster and Task Definitions

**ECS Cluster:**
```bash
aws ecs create-cluster --cluster-name cat-cluster --capacity-providers FARGATE FARGATE_SPOT
```

**Backend Task Definition (backend-task-definition.json):**
```json
{
  "family": "cat-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/cat-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:cat/database/credentials:host::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cat-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

**Frontend Task Definition (frontend-task-definition.json):**
```json
{
  "family": "cat-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/cat-frontend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "BACKEND_URL",
          "value": "http://cat-backend.local:3000"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cat-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:80 || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 30
      }
    }
  ]
}
```

Register task definitions:
```bash
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json
aws ecs register-task-definition --cli-input-json file://frontend-task-definition.json
```

#### Step 6: Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name cat-alb \
  --subnets <public-subnet-1-id> <public-subnet-2-id> \
  --security-groups <alb-sg-id> \
  --scheme internet-facing \
  --type application

# Create target groups
aws elbv2 create-target-group \
  --name cat-frontend-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id <vpc-id> \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 30

aws elbv2 create-target-group \
  --name cat-backend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id <vpc-id> \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Request ACM certificate
aws acm request-certificate \
  --domain-name example.com \
  --subject-alternative-names www.example.com \
  --validation-method DNS

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<acm-certificate-arn> \
  --default-actions Type=forward,TargetGroupArn=<frontend-tg-arn>

# Create HTTP listener (redirect to HTTPS)
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}
```


#### Step 7: Create ECS Services

```bash
# Create backend service
aws ecs create-service \
  --cluster cat-cluster \
  --service-name cat-backend \
  --task-definition cat-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnet-1-id>,<private-subnet-2-id>],securityGroups=[<ecs-sg-id>],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=<backend-tg-arn>,containerName=backend,containerPort=3000 \
  --health-check-grace-period-seconds 60 \
  --enable-execute-command

# Create frontend service
aws ecs create-service \
  --cluster cat-cluster \
  --service-name cat-frontend \
  --task-definition cat-frontend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnet-1-id>,<private-subnet-2-id>],securityGroups=[<ecs-sg-id>],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=<frontend-tg-arn>,containerName=frontend,containerPort=80 \
  --health-check-grace-period-seconds 60 \
  --enable-execute-command
```

#### Step 8: Configure Auto-Scaling

```bash
# Register scalable targets
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/cat-cluster/cat-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy (CPU-based)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/cat-cluster/cat-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cat-backend-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json

# scaling-policy.json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
  },
  "ScaleInCooldown": 300,
  "ScaleOutCooldown": 60
}
```

#### Step 9: Set Up CloudWatch Monitoring

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name cat-monitoring \
  --dashboard-body file://dashboard.json

# Create alarms
aws cloudwatch put-metric-alarm \
  --alarm-name cat-backend-high-cpu \
  --alarm-description "Alert when backend CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ServiceName,Value=cat-backend Name=ClusterName,Value=cat-cluster

aws cloudwatch put-metric-alarm \
  --alarm-name cat-backend-unhealthy-targets \
  --alarm-description "Alert when backend has unhealthy targets" \
  --metric-name UnHealthyHostCount \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2
```

### AWS-Specific Considerations

#### Database Migration from PostgreSQL Container to RDS

**Option 1: pg_dump/pg_restore**
```bash
# Export from on-premise
docker exec cat_database pg_dump -U apiuser -d community_tracker -F c -f /tmp/backup.dump

# Copy backup file
docker cp cat_database:/tmp/backup.dump ./backup.dump

# Import to RDS
pg_restore -h <rds-endpoint> -U dbadmin -d community_tracker -v backup.dump
```

**Option 2: AWS Database Migration Service (DMS)**
- Supports continuous replication for minimal downtime
- Can migrate while on-premise database is still running
- Recommended for production migrations

#### IAM Authentication for RDS

Update application code to use IAM authentication:

```typescript
import { Signer } from '@aws-sdk/rds-signer';

async function getDatabasePassword(): Promise<string> {
  const signer = new Signer({
    hostname: process.env.DB_HOST!,
    port: 5432,
    username: process.env.DB_USER!,
    region: 'us-east-1',
  });
  
  return await signer.getAuthToken();
}

// Use in Prisma connection
const password = await getDatabasePassword();
const databaseUrl = `postgresql://${process.env.DB_USER}:${password}@${process.env.DB_HOST}:5432/community_tracker`;
```

#### ECS Service Discovery

For service-to-service communication, use AWS Cloud Map:

```bash
# Create private DNS namespace
aws servicediscovery create-private-dns-namespace \
  --name cat.local \
  --vpc <vpc-id>

# Update ECS service to register with service discovery
aws ecs update-service \
  --cluster cat-cluster \
  --service cat-backend \
  --service-registries registryArn=<service-registry-arn>
```

Then services can communicate using DNS names like `cat-backend.cat.local`.

#### Cost Optimization for AWS

1. **Use Fargate Spot**: Save up to 70% on compute costs
   ```bash
   --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1,base=0
   ```

2. **Right-size RDS instances**: Start with db.t3.medium, monitor and adjust

3. **Enable RDS storage autoscaling**: Automatically increase storage as needed

4. **Use S3 for static assets**: Offload static content from containers

5. **Enable CloudWatch Logs retention**: Set appropriate retention periods (7-30 days)

---

## Google Cloud Migration Path

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Cloud Load Balancer                  │  │
│  │  - HTTPS (443) with Google-managed certificate      │  │
│  │  - HTTP (80) → Redirect to HTTPS                    │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              Cloud Run Services                      │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Frontend Service                              │ │  │
│  │  │  - Nginx container                             │ │  │
│  │  │  - Auto-scaling: 0-100 instances               │ │  │
│  │  │  - Concurrency: 80 requests/instance           │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Backend Service                               │ │  │
│  │  │  - Node.js/Express container                   │ │  │
│  │  │  - Auto-scaling: 1-100 instances               │ │  │
│  │  │  - Concurrency: 80 requests/instance           │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cloud SQL (PostgreSQL)                  │  │
│  │  - High Availability (HA) configuration              │  │
│  │  - Automated backups                                 │  │
│  │  - Private IP connection                             │  │
│  │  - IAM authentication enabled                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Supporting Services:                                      │
│  - Artifact Registry (Container images)                    │
│  - Secret Manager (Credentials and API keys)               │
│  - Cloud Logging (Centralized logs)                        │
│  - Cloud Monitoring (Metrics and alerts)                   │
│  - Cloud DNS (Domain management)                           │
│  - VPC Connector (Private network access)                  │
└─────────────────────────────────────────────────────────────┘
```


### Step-by-Step Google Cloud Migration

#### Step 1: Set Up Artifact Registry

```bash
# Enable required APIs
gcloud services enable artifactregistry.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create cat-images \
  --repository-format=docker \
  --location=us-central1 \
  --description="Community Activity Tracker container images"

# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev

# Tag and push images
docker tag cat-frontend:latest us-central1-docker.pkg.dev/<project-id>/cat-images/frontend:latest
docker push us-central1-docker.pkg.dev/<project-id>/cat-images/frontend:latest

docker tag cat-backend:latest us-central1-docker.pkg.dev/<project-id>/cat-images/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/cat-images/backend:latest
```

#### Step 2: Create Cloud SQL Instance

```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create cat-database \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --network=default \
  --no-assign-ip \
  --availability-type=regional \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --database-flags=cloudsql.iam_authentication=on

# Create database
gcloud sql databases create community_tracker \
  --instance=cat-database

# Create database user
gcloud sql users create dbadmin \
  --instance=cat-database \
  --password=<secure-password>

# Create IAM database user for Cloud Run
gcloud sql users create <service-account-email> \
  --instance=cat-database \
  --type=CLOUD_IAM_SERVICE_ACCOUNT
```

#### Step 3: Store Secrets in Secret Manager

```bash
# Create secrets
echo -n "<secure-password>" | gcloud secrets create db-password \
  --data-file=- \
  --replication-policy=automatic

echo -n "postgresql://dbadmin:<password>@/<database>?host=/cloudsql/<project>:<region>:<instance>" | \
  gcloud secrets create database-url \
  --data-file=- \
  --replication-policy=automatic

echo -n "<your-api-key>" | gcloud secrets create api-key \
  --data-file=- \
  --replication-policy=automatic

# Grant Cloud Run service account access to secrets
gcloud secrets add-iam-policy-binding db-password \
  --member=serviceAccount:<service-account-email> \
  --role=roles/secretmanager.secretAccessor
```

#### Step 4: Create VPC Connector (for Cloud SQL private IP)

```bash
# Create VPC connector
gcloud compute networks vpc-access connectors create cat-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=10
```

#### Step 5: Deploy Backend Service to Cloud Run

```bash
# Deploy backend service
gcloud run deploy cat-backend \
  --image=us-central1-docker.pkg.dev/<project-id>/cat-images/backend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=100 \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=300 \
  --set-env-vars="NODE_ENV=production,PORT=3000" \
  --set-secrets="DATABASE_URL=database-url:latest,API_KEY=api-key:latest" \
  --add-cloudsql-instances=<project-id>:us-central1:cat-database \
  --vpc-connector=cat-connector \
  --vpc-egress=private-ranges-only

# Get backend service URL
gcloud run services describe cat-backend --region=us-central1 --format='value(status.url)'
```

#### Step 6: Deploy Frontend Service to Cloud Run

```bash
# Deploy frontend service
gcloud run deploy cat-frontend \
  --image=us-central1-docker.pkg.dev/<project-id>/cat-images/frontend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=100 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --timeout=60 \
  --set-env-vars="BACKEND_URL=<backend-service-url>"

# Get frontend service URL
gcloud run services describe cat-frontend --region=us-central1 --format='value(status.url)'
```

#### Step 7: Set Up Load Balancer with Custom Domain

```bash
# Reserve static IP address
gcloud compute addresses create cat-ip \
  --global

# Create backend service for Cloud Run
gcloud compute backend-services create cat-backend-service \
  --global

# Add Cloud Run NEG (Network Endpoint Group)
gcloud compute network-endpoint-groups create cat-frontend-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=cat-frontend

gcloud compute backend-services add-backend cat-backend-service \
  --global \
  --network-endpoint-group=cat-frontend-neg \
  --network-endpoint-group-region=us-central1

# Create URL map
gcloud compute url-maps create cat-url-map \
  --default-service=cat-backend-service

# Create Google-managed SSL certificate
gcloud compute ssl-certificates create cat-ssl-cert \
  --domains=example.com,www.example.com \
  --global

# Create HTTPS proxy
gcloud compute target-https-proxies create cat-https-proxy \
  --url-map=cat-url-map \
  --ssl-certificates=cat-ssl-cert

# Create forwarding rule
gcloud compute forwarding-rules create cat-https-rule \
  --address=cat-ip \
  --global \
  --target-https-proxy=cat-https-proxy \
  --ports=443

# Create HTTP to HTTPS redirect
gcloud compute url-maps import cat-http-redirect \
  --global \
  --source=/dev/stdin <<EOF
kind: compute#urlMap
name: cat-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF

gcloud compute target-http-proxies create cat-http-proxy \
  --url-map=cat-http-redirect

gcloud compute forwarding-rules create cat-http-rule \
  --address=cat-ip \
  --global \
  --target-http-proxy=cat-http-proxy \
  --ports=80
```

#### Step 8: Configure Cloud Monitoring and Logging

```bash
# Create log-based metrics
gcloud logging metrics create backend_errors \
  --description="Count of backend errors" \
  --log-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="cat-backend"
    severity>=ERROR'

# Create alert policy
gcloud alpha monitoring policies create \
  --notification-channels=<channel-id> \
  --display-name="Backend Error Rate" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="logging.googleapis.com/user/backend_errors"
    resource.type="cloud_run_revision"'
```

### Google Cloud-Specific Considerations

#### Cloud Run Concurrency

Cloud Run handles multiple requests per container instance. Configure based on your application:

```bash
# For CPU-intensive workloads
--concurrency=10

# For I/O-intensive workloads (default)
--concurrency=80

# For maximum throughput
--concurrency=1000
```

#### Cold Start Optimization

Minimize cold starts with:

1. **Minimum instances**: Keep at least 1 instance warm
   ```bash
   --min-instances=1
   ```

2. **Startup CPU boost**: Allocate more CPU during startup
   ```bash
   --cpu-boost
   ```

3. **Optimize container size**: Use multi-stage builds and alpine images

#### Cloud SQL Connection Pooling

For Cloud Run, use connection pooling to manage database connections:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration
  log: ['query', 'error', 'warn'],
});

// Set connection pool size based on Cloud Run concurrency
// Rule of thumb: (concurrency * instances) / 2
// For concurrency=80, max_instances=100: ~4000 connections
// PostgreSQL max_connections should be set accordingly
```

#### Cost Optimization for Google Cloud

1. **Use minimum instances wisely**: Balance cold starts vs. cost
   - Development: `--min-instances=0`
   - Production: `--min-instances=1` or `--min-instances=2`

2. **Right-size Cloud SQL**: Start with db-custom-2-7680 (2 vCPU, 7.5 GB RAM)

3. **Enable Cloud SQL automatic storage increase**: Avoid over-provisioning

4. **Use committed use discounts**: Save up to 57% on Cloud Run and Cloud SQL

5. **Set appropriate log retention**: Default is 30 days, adjust based on needs

---

## Azure Migration Path

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Microsoft Azure                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Azure Application Gateway               │  │
│  │  - HTTPS (443) with Azure-managed certificate        │  │
│  │  - HTTP (80) → Redirect to HTTPS                     │  │
│  │  - WAF enabled                                       │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │          Azure Container Instances (ACI)             │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Frontend Container Group                      │ │  │
│  │  │  - Nginx container                             │ │  │
│  │  │  - 1-10 instances                              │ │  │
│  │  │  - 1 vCPU, 1.5 GB memory                       │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Backend Container Group                       │ │  │
│  │  │  - Node.js/Express container                   │ │  │
│  │  │  - 2-10 instances                              │ │  │
│  │  │  - 1 vCPU, 2 GB memory                         │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Azure Database for PostgreSQL (Flexible)        │  │
│  │  - High Availability enabled                         │  │
│  │  - Automated backups                                 │  │
│  │  - Private endpoint connection                       │  │
│  │  - Azure AD authentication enabled                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Supporting Services:                                      │
│  - Azure Container Registry (Container images)             │
│  - Azure Key Vault (Secrets and certificates)              │
│  - Azure Monitor (Logs and metrics)                        │
│  - Azure DNS (Domain management)                           │
│  - Virtual Network (Private networking)                    │
└─────────────────────────────────────────────────────────────┘
```


### Step-by-Step Azure Migration

#### Step 1: Set Up Azure Container Registry

```bash
# Create resource group
az group create --name cat-rg --location eastus

# Create container registry
az acr create \
  --resource-group cat-rg \
  --name catregistry \
  --sku Standard \
  --admin-enabled true

# Login to ACR
az acr login --name catregistry

# Tag and push images
docker tag cat-frontend:latest catregistry.azurecr.io/frontend:latest
docker push catregistry.azurecr.io/frontend:latest

docker tag cat-backend:latest catregistry.azurecr.io/backend:latest
docker push catregistry.azurecr.io/backend:latest
```

#### Step 2: Create Virtual Network

```bash
# Create virtual network
az network vnet create \
  --resource-group cat-rg \
  --name cat-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name cat-subnet \
  --subnet-prefix 10.0.1.0/24

# Create subnet for database
az network vnet subnet create \
  --resource-group cat-rg \
  --vnet-name cat-vnet \
  --name db-subnet \
  --address-prefix 10.0.2.0/24 \
  --service-endpoints Microsoft.Sql
```

#### Step 3: Create Azure Database for PostgreSQL

```bash
# Create PostgreSQL flexible server
az postgres flexible-server create \
  --resource-group cat-rg \
  --name cat-database \
  --location eastus \
  --admin-user dbadmin \
  --admin-password <secure-password> \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose \
  --version 15 \
  --storage-size 128 \
  --backup-retention 7 \
  --high-availability Enabled \
  --zone 1 \
  --standby-zone 2 \
  --vnet cat-vnet \
  --subnet db-subnet \
  --private-dns-zone cat-database.private.postgres.database.azure.com

# Create database
az postgres flexible-server db create \
  --resource-group cat-rg \
  --server-name cat-database \
  --database-name community_tracker

# Configure firewall (allow Azure services)
az postgres flexible-server firewall-rule create \
  --resource-group cat-rg \
  --name cat-database \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

#### Step 4: Set Up Azure Key Vault

```bash
# Create Key Vault
az keyvault create \
  --resource-group cat-rg \
  --name cat-keyvault \
  --location eastus \
  --enable-rbac-authorization false

# Store secrets
az keyvault secret set \
  --vault-name cat-keyvault \
  --name db-password \
  --value "<secure-password>"

az keyvault secret set \
  --vault-name cat-keyvault \
  --name database-url \
  --value "postgresql://dbadmin:<password>@cat-database.postgres.database.azure.com:5432/community_tracker?sslmode=require"

az keyvault secret set \
  --vault-name cat-keyvault \
  --name api-key \
  --value "<your-api-key>"

# Create managed identity for container instances
az identity create \
  --resource-group cat-rg \
  --name cat-identity

# Grant identity access to Key Vault
az keyvault set-policy \
  --name cat-keyvault \
  --object-id <identity-principal-id> \
  --secret-permissions get list
```

#### Step 5: Deploy Backend Container Instances

```bash
# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name catregistry --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name catregistry --query passwords[0].value -o tsv)

# Create backend container group
az container create \
  --resource-group cat-rg \
  --name cat-backend \
  --image catregistry.azurecr.io/backend:latest \
  --registry-login-server catregistry.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --cpu 1 \
  --memory 2 \
  --ports 3000 \
  --protocol TCP \
  --ip-address Private \
  --vnet cat-vnet \
  --subnet cat-subnet \
  --environment-variables \
    NODE_ENV=production \
    PORT=3000 \
  --secure-environment-variables \
    DATABASE_URL=@Microsoft.KeyVault(SecretUri=https://cat-keyvault.vault.azure.net/secrets/database-url/) \
    API_KEY=@Microsoft.KeyVault(SecretUri=https://cat-keyvault.vault.azure.net/secrets/api-key/) \
  --assign-identity <identity-resource-id> \
  --restart-policy Always

# Get backend private IP
az container show \
  --resource-group cat-rg \
  --name cat-backend \
  --query ipAddress.ip -o tsv
```

#### Step 6: Deploy Frontend Container Instances

```bash
# Create frontend container group
az container create \
  --resource-group cat-rg \
  --name cat-frontend \
  --image catregistry.azurecr.io/frontend:latest \
  --registry-login-server catregistry.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --cpu 1 \
  --memory 1.5 \
  --ports 80 443 \
  --protocol TCP \
  --ip-address Private \
  --vnet cat-vnet \
  --subnet cat-subnet \
  --environment-variables \
    BACKEND_URL=http://<backend-private-ip>:3000 \
  --restart-policy Always

# Get frontend private IP
az container show \
  --resource-group cat-rg \
  --name cat-frontend \
  --query ipAddress.ip -o tsv
```

#### Step 7: Set Up Application Gateway

```bash
# Create public IP for Application Gateway
az network public-ip create \
  --resource-group cat-rg \
  --name cat-appgw-ip \
  --allocation-method Static \
  --sku Standard

# Create subnet for Application Gateway
az network vnet subnet create \
  --resource-group cat-rg \
  --vnet-name cat-vnet \
  --name appgw-subnet \
  --address-prefix 10.0.3.0/24

# Create Application Gateway
az network application-gateway create \
  --resource-group cat-rg \
  --name cat-appgw \
  --location eastus \
  --vnet-name cat-vnet \
  --subnet appgw-subnet \
  --capacity 2 \
  --sku Standard_v2 \
  --public-ip-address cat-appgw-ip \
  --frontend-port 80 \
  --http-settings-cookie-based-affinity Disabled \
  --http-settings-port 80 \
  --http-settings-protocol Http \
  --servers <frontend-private-ip>

# Add HTTPS listener with certificate
az network application-gateway ssl-cert create \
  --resource-group cat-rg \
  --gateway-name cat-appgw \
  --name cat-ssl-cert \
  --cert-file /path/to/certificate.pfx \
  --cert-password <cert-password>

az network application-gateway frontend-port create \
  --resource-group cat-rg \
  --gateway-name cat-appgw \
  --name https-port \
  --port 443

az network application-gateway http-listener create \
  --resource-group cat-rg \
  --gateway-name cat-appgw \
  --name https-listener \
  --frontend-port https-port \
  --ssl-cert cat-ssl-cert

# Create redirect configuration for HTTP to HTTPS
az network application-gateway redirect-config create \
  --resource-group cat-rg \
  --gateway-name cat-appgw \
  --name http-to-https \
  --type Permanent \
  --target-listener https-listener \
  --include-path true \
  --include-query-string true

az network application-gateway rule create \
  --resource-group cat-rg \
  --gateway-name cat-appgw \
  --name http-redirect-rule \
  --http-listener appGatewayHttpListener \
  --rule-type Basic \
  --redirect-config http-to-https
```

#### Step 8: Configure Azure Monitor

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group cat-rg \
  --workspace-name cat-logs \
  --location eastus

# Enable container insights
az container create \
  --resource-group cat-rg \
  --name cat-backend \
  --log-analytics-workspace <workspace-id> \
  --log-analytics-workspace-key <workspace-key>

# Create alert rules
az monitor metrics alert create \
  --resource-group cat-rg \
  --name backend-high-cpu \
  --description "Alert when backend CPU exceeds 80%" \
  --scopes /subscriptions/<subscription-id>/resourceGroups/cat-rg/providers/Microsoft.ContainerInstance/containerGroups/cat-backend \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m

az monitor metrics alert create \
  --resource-group cat-rg \
  --name backend-high-memory \
  --description "Alert when backend memory exceeds 80%" \
  --scopes /subscriptions/<subscription-id>/resourceGroups/cat-rg/providers/Microsoft.ContainerInstance/containerGroups/cat-backend \
  --condition "avg Memory Usage > 1600000000" \
  --window-size 5m \
  --evaluation-frequency 1m
```

### Azure-Specific Considerations

#### Container Instance Limitations

Azure Container Instances has some limitations compared to other platforms:

1. **No built-in auto-scaling**: Must implement custom scaling logic or use Azure Container Apps
2. **No load balancing**: Requires Application Gateway or Azure Load Balancer
3. **Limited networking**: Basic VNet integration, no service mesh
4. **Restart policies**: Only `Always`, `OnFailure`, or `Never`

**Alternative: Azure Container Apps**

For production workloads, consider Azure Container Apps (built on Kubernetes):

```bash
# Create Container Apps environment
az containerapp env create \
  --resource-group cat-rg \
  --name cat-env \
  --location eastus

# Deploy backend app
az containerapp create \
  --resource-group cat-rg \
  --name cat-backend \
  --environment cat-env \
  --image catregistry.azurecr.io/backend:latest \
  --target-port 3000 \
  --ingress internal \
  --min-replicas 2 \
  --max-replicas 10 \
  --cpu 1 \
  --memory 2Gi \
  --env-vars NODE_ENV=production PORT=3000 \
  --secrets database-url=<connection-string> \
  --registry-server catregistry.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD
```

#### Azure AD Authentication for PostgreSQL

Enable Azure AD authentication for enhanced security:

```bash
# Enable Azure AD authentication
az postgres flexible-server ad-admin create \
  --resource-group cat-rg \
  --server-name cat-database \
  --display-name "DB Admin" \
  --object-id <azure-ad-user-object-id>

# Update application to use Azure AD tokens
```

Application code:
```typescript
import { DefaultAzureCredential } from '@azure/identity';

async function getDatabaseToken(): Promise<string> {
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
  return token.token;
}

// Use in connection string
const token = await getDatabaseToken();
const connectionString = `postgresql://user@cat-database:${token}@cat-database.postgres.database.azure.com/community_tracker`;
```

#### Cost Optimization for Azure

1. **Use Azure Reservations**: Save up to 65% on Container Instances with 1 or 3-year commitments

2. **Right-size database**: Start with Standard_D2s_v3, monitor and adjust

3. **Use Azure Hybrid Benefit**: If you have existing licenses

4. **Enable auto-shutdown**: For non-production environments

5. **Use Azure Cost Management**: Set budgets and alerts

---


## Cloud-Specific Considerations

### Authentication and Authorization

#### On-Premise (Current)
- PostgreSQL peer authentication via Unix sockets
- No network-based authentication
- OS user mapping to database user

#### Cloud Platforms

**AWS:**
- IAM database authentication for RDS
- Secrets Manager for credentials
- IAM roles for ECS tasks
- Security groups for network access control

**Google Cloud:**
- Cloud SQL IAM authentication
- Secret Manager for credentials
- Service accounts for Cloud Run
- VPC firewall rules for network access control

**Azure:**
- Azure AD authentication for PostgreSQL
- Key Vault for credentials
- Managed identities for Container Instances
- Network security groups for access control

### Networking and Service Discovery

#### On-Premise (Current)
- Docker Compose DNS (service names resolve to container IPs)
- Single-host networking
- Direct container-to-container communication

#### Cloud Platforms

**AWS:**
- AWS Cloud Map for service discovery
- ECS Service Discovery (Route 53 private hosted zones)
- VPC networking with security groups
- Application Load Balancer for external access

**Google Cloud:**
- Cloud Run service URLs for HTTP communication
- VPC Connector for private network access
- Cloud Load Balancing for external access
- Internal HTTP(S) Load Balancer for service-to-service

**Azure:**
- Virtual Network for private networking
- Application Gateway for external access
- Azure DNS for service discovery
- Private endpoints for secure connections

### Storage and Persistence

#### On-Premise (Current)
- Docker volumes for database persistence
- Local filesystem for logs and temporary files
- Shared volumes for Unix sockets

#### Cloud Platforms

**AWS:**
- EBS volumes for persistent storage (not recommended for Fargate)
- EFS for shared file storage across tasks
- S3 for object storage (logs, backups, static assets)
- RDS automated backups and snapshots

**Google Cloud:**
- Cloud Storage for object storage
- Persistent Disks (not available for Cloud Run)
- Cloud SQL automated backups
- Cloud Filestore for shared file storage (if needed)

**Azure:**
- Azure Files for shared file storage
- Azure Blob Storage for object storage
- Azure Database for PostgreSQL automated backups
- Managed disks for Container Apps

### Logging and Monitoring

#### On-Premise (Current)
- Container logs to stdout/stderr
- Docker log drivers (json-file)
- Winston for structured logging
- Local log files

#### Cloud Platforms

**AWS:**
- CloudWatch Logs (automatic from ECS)
- CloudWatch Metrics for performance monitoring
- X-Ray for distributed tracing
- CloudWatch Alarms for alerting

**Google Cloud:**
- Cloud Logging (automatic from Cloud Run)
- Cloud Monitoring for metrics
- Cloud Trace for distributed tracing
- Cloud Alerting for notifications

**Azure:**
- Azure Monitor Logs (Log Analytics)
- Azure Monitor Metrics
- Application Insights for APM
- Azure Alerts for notifications

### Secrets Management

#### On-Premise (Current)
- Environment variables from .env file
- File-based certificates
- No rotation or versioning

#### Cloud Platforms

**AWS:**
- AWS Secrets Manager (automatic rotation, versioning)
- AWS Systems Manager Parameter Store
- ACM for certificate management
- KMS for encryption keys

**Google Cloud:**
- Secret Manager (versioning, automatic rotation)
- Cloud KMS for encryption keys
- Certificate Manager for SSL/TLS certificates

**Azure:**
- Azure Key Vault (versioning, automatic rotation)
- Azure Key Vault Certificates
- Azure Managed Identities for passwordless authentication

### High Availability and Disaster Recovery

#### On-Premise (Current)
- Single-host deployment
- Manual backup and restore
- No automatic failover

#### Cloud Platforms

**AWS:**
- Multi-AZ deployment for RDS (automatic failover)
- ECS tasks across multiple availability zones
- Automated backups with point-in-time recovery
- Cross-region replication for disaster recovery

**Google Cloud:**
- Regional Cloud SQL (automatic failover)
- Cloud Run across multiple zones
- Automated backups with point-in-time recovery
- Multi-region deployment for disaster recovery

**Azure:**
- Zone-redundant PostgreSQL (automatic failover)
- Container Instances across availability zones
- Automated backups with point-in-time recovery
- Geo-replication for disaster recovery

### Security Best Practices

#### Network Security

**AWS:**
- Use private subnets for application and database
- Security groups with least-privilege rules
- VPC endpoints for AWS services (avoid internet gateway)
- Enable VPC Flow Logs for network monitoring

**Google Cloud:**
- Use VPC with private IP addresses
- Firewall rules with least-privilege access
- Private Google Access for API calls
- VPC Flow Logs for network monitoring

**Azure:**
- Use Virtual Network with private subnets
- Network Security Groups with least-privilege rules
- Private endpoints for Azure services
- NSG Flow Logs for network monitoring

#### Data Encryption

**All Platforms:**
- Enable encryption at rest for databases
- Use TLS/SSL for data in transit
- Encrypt backups and snapshots
- Use managed encryption keys or bring your own keys (BYOK)

#### Access Control

**All Platforms:**
- Use IAM roles/service accounts (not access keys)
- Implement least-privilege access
- Enable MFA for administrative access
- Regular access reviews and audits

---

## Cost Optimization

### General Principles

1. **Right-size resources**: Start small, monitor, and scale up as needed
2. **Use auto-scaling**: Scale down during low-traffic periods
3. **Leverage spot/preemptible instances**: For non-critical workloads
4. **Use reserved capacity**: For predictable workloads (1-3 year commitments)
5. **Optimize storage**: Use appropriate storage tiers, enable lifecycle policies
6. **Monitor and optimize**: Regular cost reviews and optimization

### Platform-Specific Cost Optimization

#### AWS Cost Optimization

**Compute:**
- Use Fargate Spot for up to 70% savings on non-critical tasks
- Consider EC2 with Savings Plans for predictable workloads
- Use smaller task sizes (0.25 vCPU, 0.5 GB) for lightweight services

**Database:**
- Use RDS Reserved Instances for 40-60% savings
- Enable storage autoscaling to avoid over-provisioning
- Use read replicas for read-heavy workloads
- Consider Aurora Serverless for variable workloads

**Storage:**
- Use S3 Intelligent-Tiering for automatic cost optimization
- Enable S3 lifecycle policies to move old data to cheaper tiers
- Use EFS Infrequent Access for rarely accessed files

**Networking:**
- Minimize data transfer between regions
- Use VPC endpoints to avoid NAT Gateway costs
- Enable CloudFront for static content delivery

**Estimated Monthly Costs (Production):**
- ECS Fargate (2 tasks, 0.5 vCPU, 1 GB): ~$30
- RDS PostgreSQL (db.t3.medium, Multi-AZ): ~$120
- Application Load Balancer: ~$25
- Data transfer and storage: ~$25
- **Total: ~$200/month**

#### Google Cloud Cost Optimization

**Compute:**
- Use minimum instances = 0 for development (pay only when running)
- Use minimum instances = 1 for production (balance cost vs. cold starts)
- Set appropriate concurrency (80-100 for most workloads)
- Use CPU allocation = "CPU is only allocated during request processing"

**Database:**
- Use Cloud SQL shared-core instances for development
- Enable automatic storage increase to avoid over-provisioning
- Use read replicas for read-heavy workloads
- Consider Cloud SQL Enterprise Plus for mission-critical workloads

**Storage:**
- Use Cloud Storage Standard for frequently accessed data
- Use Nearline/Coldline for backups and archives
- Enable object lifecycle management

**Networking:**
- Use Cloud CDN for static content
- Minimize egress traffic (most expensive component)
- Use Premium Tier only when needed (Standard Tier is cheaper)

**Estimated Monthly Costs (Production):**
- Cloud Run (2 instances, 1 vCPU, 1 GB, 1M requests): ~$50
- Cloud SQL (db-custom-2-7680, HA): ~$200
- Cloud Load Balancing: ~$20
- Data transfer and storage: ~$30
- **Total: ~$300/month**

#### Azure Cost Optimization

**Compute:**
- Use Azure Container Apps instead of Container Instances for better scaling
- Use consumption plan for variable workloads
- Consider Azure Reservations for 1-3 year commitments (up to 65% savings)
- Use Azure Spot Instances for non-critical workloads

**Database:**
- Use Burstable tier (B-series) for development
- Use General Purpose tier for production
- Enable automatic storage growth
- Consider Azure Hybrid Benefit if you have SQL Server licenses

**Storage:**
- Use appropriate storage tiers (Hot, Cool, Archive)
- Enable lifecycle management policies
- Use Azure CDN for static content

**Networking:**
- Minimize data transfer between regions
- Use Azure Front Door for global load balancing
- Use Private Endpoints to avoid egress charges

**Estimated Monthly Costs (Production):**
- Container Instances (2 instances, 1 vCPU, 2 GB): ~$75
- Azure Database for PostgreSQL (Standard_D2s_v3, HA): ~$250
- Application Gateway: ~$150
- Data transfer and storage: ~$25
- **Total: ~$500/month**

### Cost Monitoring and Alerts

**AWS:**
```bash
# Set up billing alerts
aws budgets create-budget \
  --account-id <account-id> \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**Google Cloud:**
```bash
# Set up budget alerts
gcloud billing budgets create \
  --billing-account=<billing-account-id> \
  --display-name="Monthly Budget" \
  --budget-amount=500 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

**Azure:**
```bash
# Set up cost alerts
az consumption budget create \
  --resource-group cat-rg \
  --budget-name monthly-budget \
  --amount 500 \
  --time-grain Monthly \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --threshold 50 90 100
```

---

## Migration Testing Strategy

### Pre-Migration Testing

#### 1. Container Compatibility Testing

Test containers locally with cloud-like configurations:

```bash
# Test with environment variables (no .env file)
docker run -e DATABASE_URL=postgresql://... -e NODE_ENV=production cat-backend:latest

# Test with TCP database connection (not Unix socket)
docker run -e DATABASE_URL=postgresql://user:pass@host:5432/db cat-backend:latest

# Test health check endpoints
curl http://localhost:3000/health

# Test graceful shutdown
docker stop --time=30 cat-backend
```

#### 2. Load Testing

Test application performance under load:

```bash
# Install Apache Bench or similar tool
apt-get install apache2-utils

# Run load test
ab -n 10000 -c 100 http://localhost:3000/api/endpoint

# Or use k6 for more advanced testing
k6 run load-test.js
```

#### 3. Database Migration Testing

Test database migration process:

```bash
# Export from on-premise
pg_dump -h localhost -U apiuser -d community_tracker -F c -f backup.dump

# Import to test cloud database
pg_restore -h <cloud-db-host> -U dbadmin -d community_tracker backup.dump

# Verify data integrity
psql -h <cloud-db-host> -U dbadmin -d community_tracker -c "SELECT COUNT(*) FROM users;"
```

### Migration Execution

#### Phase 1: Parallel Deployment (Recommended)

1. **Deploy to cloud** while keeping on-premise running
2. **Configure database replication** from on-premise to cloud
3. **Test cloud deployment** with read-only traffic
4. **Gradually shift traffic** to cloud (10% → 50% → 100%)
5. **Monitor for issues** and rollback if needed
6. **Decommission on-premise** after successful migration

#### Phase 2: Blue-Green Deployment

1. **Deploy cloud environment** (green)
2. **Keep on-premise running** (blue)
3. **Switch DNS** to cloud environment
4. **Monitor for issues**
5. **Keep blue environment** for quick rollback
6. **Decommission blue** after stability period

#### Phase 3: Cutover Migration (Fastest, Higher Risk)

1. **Schedule maintenance window**
2. **Stop on-premise services**
3. **Export database**
4. **Deploy to cloud**
5. **Import database**
6. **Start cloud services**
7. **Update DNS**
8. **Verify functionality**

### Post-Migration Validation

#### 1. Functional Testing

```bash
# Test all critical endpoints
curl https://example.com/health
curl https://example.com/api/users
curl https://example.com/api/activities

# Test authentication
curl -X POST https://example.com/api/login -d '{"username":"test","password":"test"}'

# Test database operations
curl -X POST https://example.com/api/activities -d '{"title":"Test","description":"Test"}'
```

#### 2. Performance Testing

- Monitor response times
- Check database query performance
- Verify auto-scaling behavior
- Test under peak load

#### 3. Security Testing

- Verify HTTPS is enforced
- Test authentication and authorization
- Check network security groups/firewall rules
- Verify secrets are not exposed in logs

#### 4. Disaster Recovery Testing

- Test database backup and restore
- Verify automatic failover (if configured)
- Test rollback procedures
- Verify monitoring and alerting

### Rollback Plan

If migration fails, have a rollback plan:

1. **Keep on-premise environment running** for at least 7 days after migration
2. **Document rollback steps** before migration
3. **Test rollback procedure** in staging environment
4. **Have DNS TTL set low** (5 minutes) for quick switchback
5. **Keep database backups** from before migration

**Rollback Steps:**
1. Stop cloud services
2. Switch DNS back to on-premise
3. Verify on-premise services are running
4. Restore database from backup if needed
5. Investigate and fix issues before retry

---

## Conclusion

Migrating the Community Activity Tracker to cloud platforms is straightforward due to the cloud-compatible architecture. The key steps are:

1. **Choose your platform** based on requirements, cost, and expertise
2. **Follow the platform-specific migration guide** in this document
3. **Test thoroughly** before production migration
4. **Use parallel deployment** for minimal risk
5. **Monitor closely** after migration
6. **Optimize costs** based on actual usage patterns

### Platform Comparison Summary

| Feature | AWS ECS/Fargate | Google Cloud Run | Azure Container Instances |
|---------|----------------|------------------|---------------------------|
| **Ease of Setup** | Medium | Easy | Medium |
| **Auto-Scaling** | Yes | Yes | Limited (use Container Apps) |
| **Cold Starts** | Minimal | Possible | Minimal |
| **Pricing Model** | Per-second | Per-request | Per-second |
| **Managed Database** | RDS | Cloud SQL | Azure Database |
| **Secrets Management** | Secrets Manager | Secret Manager | Key Vault |
| **Load Balancing** | ALB | Cloud Load Balancing | Application Gateway |
| **Monitoring** | CloudWatch | Cloud Monitoring | Azure Monitor |
| **Estimated Cost** | ~$200/month | ~$300/month | ~$500/month |

### Recommended Platform by Use Case

- **AWS**: Best for enterprises already using AWS, need advanced features
- **Google Cloud**: Best for simplicity, serverless-first approach, cost-effective
- **Azure**: Best for enterprises using Microsoft stack, hybrid cloud scenarios

### Next Steps

1. Review [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) for design principles
2. Choose your target cloud platform
3. Set up a test environment following this guide
4. Perform load testing and validation
5. Plan your migration timeline
6. Execute migration with rollback plan ready
7. Monitor and optimize post-migration

For questions or issues during migration, refer to the platform-specific documentation:
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Azure Container Instances Documentation](https://docs.microsoft.com/azure/container-instances/)
