import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig, ResourceTags } from './types';

export interface CommunityActivityTrackerStackProps extends cdk.StackProps {
  environmentName: string;
  config: EnvironmentConfig;
}

export class CommunityActivityTrackerStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseCluster;
  public readonly databaseSecret: secretsmanager.Secret;
  public readonly ecsCluster: ecs.Cluster;
  public readonly apiService: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly frontendBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CommunityActivityTrackerStackProps) {
    super(scope, id, props);

    const { environmentName, config } = props;

    // Create VPC with public and private subnets across 2 AZs
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
      flowLogs: {
        'vpc-flow-logs': {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
        },
      },
    });

    // Security Groups
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora database',
      allowAllOutbound: false,
    });

    const apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for API containers',
      allowAllOutbound: true,
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Allow HTTPS from internet to ALB
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet'
    );

    // Allow traffic from ALB to API
    apiSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB'
    );

    // Allow PostgreSQL from API to database
    databaseSecurityGroup.addIngressRule(
      apiSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from API'
    );

    // Create database credentials in Secrets Manager
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `${environmentName}/community-tracker/database`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbadmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create Aurora Serverless v2 cluster
    this.database = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3,
      }),
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      writer: rds.ClusterInstance.serverlessV2('writer', {
        autoMinorVersionUpgrade: true,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2('reader', {
          scaleWithWriter: true,
        }),
      ],
      serverlessV2MinCapacity: config.databaseMinCapacity,
      serverlessV2MaxCapacity: config.databaseMaxCapacity,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [databaseSecurityGroup],
      defaultDatabaseName: 'communitytracker',
      backup: {
        retention: cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      storageEncrypted: true,
      deletionProtection: environmentName === 'production',
    });

    // Enable automatic secret rotation
    this.databaseSecret.addRotationSchedule('RotationSchedule', {
      automaticallyAfter: cdk.Duration.days(30),
      hostedRotation: secretsmanager.HostedRotation.postgreSqlSingleUser(),
    });

    // Create ECS Cluster
    this.ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: this.vpc,
      clusterName: `${environmentName}-community-tracker`,
      containerInsights: true,
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Create log group for API
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/${environmentName}/community-tracker-api`,
      retention: config.logRetentionDays as logs.RetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Fargate task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
      memoryLimitMiB: config.apiMemory,
      cpu: config.apiCpu,
    });

    // Grant task access to database secret
    this.databaseSecret.grantRead(taskDefinition.taskRole);

    // Add container to task definition
    const container = taskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'), // Placeholder
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        NODE_ENV: environmentName,
        PORT: '3000',
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(this.databaseSecret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create Fargate service
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.ecsCluster,
      taskDefinition,
      desiredCount: config.apiMinTasks,
      securityGroups: [apiSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Configure auto-scaling
    const scaling = this.apiService.autoScaleTaskCount({
      minCapacity: config.apiMinTasks,
      maxCapacity: config.apiMaxTasks,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Add target group and listener
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc: this.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    this.apiService.attachToApplicationTargetGroup(targetGroup);

    // Note: In production, you would configure HTTPS with ACM certificate
    // For now, using HTTP listener
    this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // Create S3 bucket for frontend
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${environmentName}-community-tracker-frontend-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // Create CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${environmentName} frontend`,
    });

    this.frontendBucket.grantRead(originAccessIdentity);

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Create SNS topics for alarms
    const criticalAlarmTopic = new sns.Topic(this, 'CriticalAlarmTopic', {
      displayName: `${environmentName} Critical Alarms`,
      topicName: `${environmentName}-community-tracker-critical-alarms`,
    });

    const warningAlarmTopic = new sns.Topic(this, 'WarningAlarmTopic', {
      displayName: `${environmentName} Warning Alarms`,
      topicName: `${environmentName}-community-tracker-warning-alarms`,
    });

    // Create CloudWatch alarms
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      metric: targetGroup.metricTargetResponseTime({
        statistic: 'p95',
      }),
      threshold: 2000, // 2 seconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'API latency exceeds 2 seconds (p95)',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    apiLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(criticalAlarmTopic));

    const apiErrorRateAlarm = new cloudwatch.Alarm(this, 'ApiErrorRateAlarm', {
      metric: targetGroup.metricHttpCodeTarget(
        elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
        {
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }
      ),
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'API error rate exceeds threshold',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    apiErrorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(criticalAlarmTopic));

    const databaseConnectionAlarm = new cloudwatch.Alarm(this, 'DatabaseConnectionAlarm', {
      metric: this.database.metricDatabaseConnections({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'Database connection failures detected',
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    databaseConnectionAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(criticalAlarmTopic));

    const ecsTaskCountAlarm = new cloudwatch.Alarm(this, 'EcsTaskCountAlarm', {
      metric: this.apiService.metricCpuUtilization(),
      threshold: config.apiMinTasks,
      evaluationPeriods: 2,
      alarmDescription: 'ECS task count below minimum',
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    ecsTaskCountAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(warningAlarmTopic));

    // Create CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${environmentName}-community-tracker`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [targetGroup.metricTargetResponseTime()],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Error Rate',
        left: [
          targetGroup.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Database Connections',
        left: [this.database.metricDatabaseConnections()],
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS CPU Utilization',
        left: [this.apiService.metricCpuUtilization()],
      })
    );

    // Stack outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${environmentName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'Database secret ARN',
      exportName: `${environmentName}-DatabaseSecretArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.clusterEndpoint.hostname,
      description: 'Database endpoint',
      exportName: `${environmentName}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'API endpoint',
      exportName: `${environmentName}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: this.distribution.distributionDomainName,
      description: 'Frontend CloudFront URL',
      exportName: `${environmentName}-FrontendUrl`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'Frontend S3 bucket name',
      exportName: `${environmentName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: this.ecsCluster.clusterName,
      description: 'ECS cluster name',
      exportName: `${environmentName}-EcsClusterName`,
    });

    // Apply tags to all resources
    this.applyTags(environmentName);
  }

  private applyTags(environmentName: string): void {
    const tags: ResourceTags = {
      Environment: environmentName,
      Application: 'CommunityActivityTracker',
      CostCenter: 'Engineering',
      Owner: 'DevOps',
      ManagedBy: 'CDK',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
