import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { IQueue, Queue } from "aws-cdk-lib/aws-sqs";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

export interface DataInfraStackProps extends cdk.StackProps {
  deployEnv: string;
  appName: string;
}

export class DataInfraStack extends cdk.Stack {
    public readonly dynamoTables: { [key: string]: Table };
    public readonly buckets: { [key: string]: Bucket | IBucket};
    public readonly queues: { [key: string]: Queue | IQueue };
    public readonly accessLogGroupExternal: LogGroup;

    constructor(scope: Construct, id: string, props: DataInfraStackProps) {
        super(scope, id, props);

        const { deployEnv, appName } = props;

        this.accessLogGroupExternal = new LogGroup(this, `${props.deployEnv}-${props.appName}-api-access-log-loggroup`, {
            retention: RetentionDays.FOUR_MONTHS,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        // 🗃️ DynamoDB Tables
        this.dynamoTables = {
            userTable: new dynamodb.Table(this, 'userTable', {
                  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
                  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                  removalPolicy: deployEnv === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
              }),
            matchTable: new dynamodb.Table(this, 'matchTable', {
                 partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
                 sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
                 billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                 removalPolicy: deployEnv === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
             }),
            analyzeMatchResultTable: new dynamodb.Table(this, 'analyzeMatchResultTable', {
                 partitionKey: { name: 'user_id#timestamp', type: dynamodb.AttributeType.STRING },
                 sortKey: { name: 'phase', type: dynamodb.AttributeType.STRING },
                 billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                 removalPolicy: deployEnv === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
             }),
        };

        // 🪣 S3 Buckets
        this.buckets = {
            userProfilePictureBucket : new s3.Bucket(this, 'userProfilePictureBucket', {}),
        };

        // 📬 SQS Queues
        this.queues = {};
    }
}