import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Duration } from "aws-cdk-lib";
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

interface LambdaUserStackProps extends cdk.StackProps {
  userPool: UserPool;
  dynamoTables: { [key: string]: Table };
  buckets: { [key: string]: Bucket | IBucket };
  chatgptKey: string;
}

export class LambdaUserStack extends cdk.Stack {
    public readonly postUser: lambda.Function;
    public readonly putUser: lambda.Function;
    public readonly getUser: lambda.Function;
    public readonly deleteUser: lambda.Function;
    public readonly postMatch: lambda.Function;
    public readonly getMatches: lambda.Function;
    public readonly putMatch: lambda.Function;
    public readonly deleteMatch: lambda.Function;
    public readonly postAnalyzeMatchResult: lambda.Function;
    public readonly getAnalysisMatchResult: lambda.Function;

    constructor(scope: Construct, id: string, props: LambdaUserStackProps) {
        super(scope, id, props);

        const {
            userPool,
            dynamoTables,
            buckets,
        } = props;

        const OPENAI_API_KEY = props.chatgptKey

        const userLayer = new lambda.LayerVersion(this, 'user-layer', {
              compatibleRuntimes: [
                lambda.Runtime.NODEJS_18_X,
              ],
              code: lambda.Code.fromAsset('layers/user'),
            });

    const postUser = new NodejsFunction(this, 'postUser', {
      entry: './lambda/user/postUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: dynamoTables.userTable.tableName,
        USER_PROFILE_BUCKET_NAME: buckets.userProfilePictureBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
      },
    })

    dynamoTables.userTable.grantReadWriteData(postUser);
    buckets.userProfilePictureBucket.grantReadWrite(postUser);

    postUser.addToRolePolicy(new iam.PolicyStatement({
        resources: [userPool.userPoolArn],
        effect: iam.Effect.ALLOW,
        actions: [
            "cognito-idp:*",
        ]
    }));

    const putUser = new NodejsFunction(this, 'putUser', {
      entry: './lambda/user/putUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: dynamoTables.userTable.tableName,
        USER_PROFILE_BUCKET_NAME: buckets.userProfilePictureBucket.bucketName,
      },
    })

    dynamoTables.userTable.grantReadWriteData(putUser);
    buckets.userProfilePictureBucket.grantReadWrite(putUser);

    const getUser = new NodejsFunction(this, 'getUser', {
      entry: './lambda/user/getUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: dynamoTables.userTable.tableName,
        USER_PROFILE_BUCKET_NAME: buckets.userProfilePictureBucket.bucketName,
      },
    })

    dynamoTables.userTable.grantReadWriteData(getUser);
    buckets.userProfilePictureBucket.grantRead(getUser);

    const deleteUser = new NodejsFunction(this, 'deleteUser', {
      entry: './lambda/user/deleteUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: dynamoTables.userTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    })

    dynamoTables.userTable.grantReadWriteData(deleteUser);

    deleteUser.addToRolePolicy(new iam.PolicyStatement({
        resources: [userPool.userPoolArn],
        effect: iam.Effect.ALLOW,
        actions: [
            "cognito-idp:*",
        ]
    }));

    const postMatch = new NodejsFunction(this, 'postMatch', {
      entry: './lambda/match/postMatch.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        MATCH_TABLE_NAME: dynamoTables.matchTable.tableName,
      },
    });
    dynamoTables.matchTable.grantReadWriteData(postMatch);

    // MATCH - GET ALL by user_id
    const getMatches = new NodejsFunction(this, 'getMatches', {
      entry: './lambda/match/getMatches.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        MATCH_TABLE_NAME: dynamoTables.matchTable.tableName,
      },
    });
    dynamoTables.matchTable.grantReadData(getMatches);

    // MATCH - UPDATE
    const putMatch = new NodejsFunction(this, 'putMatch', {
      entry: './lambda/match/putMatch.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        MATCH_TABLE_NAME: dynamoTables.matchTable.tableName,
      },
    });
    dynamoTables.matchTable.grantReadWriteData(putMatch);

    // MATCH - DELETE
    const deleteMatch = new NodejsFunction(this, 'deleteMatch', {
      entry: './lambda/match/deleteMatch.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        MATCH_TABLE_NAME: dynamoTables.matchTable.tableName,
      },
    });
    dynamoTables.matchTable.grantReadWriteData(deleteMatch);

    const postAnalyzeMatchResult = new NodejsFunction(this, 'postAnalyzeMatchResult', {
      entry: './lambda/analyze/postAnalyzeMatchResult.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        MATCH_ANALYSIS_TABLE_NAME: dynamoTables.analyzeMatchResultTable.tableName,
        OPENAI_API_KEY: OPENAI_API_KEY,
      },
    });

    dynamoTables.analyzeMatchResultTable.grantReadWriteData(postAnalyzeMatchResult);

    const getAnalysisMatchResult = new NodejsFunction(this, 'getAnalysisMatchResult', {
      entry: './lambda/analyze/getAnalysisMatchResult.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        MATCH_ANALYSIS_TABLE_NAME: dynamoTables.analyzeMatchResultTable.tableName,
      },
    });

    dynamoTables.analyzeMatchResultTable.grantReadData(getAnalysisMatchResult);

        this.postUser = postUser;
        this.putUser = putUser;
        this.getUser = getUser;
        this.deleteUser = deleteUser;
        this.postMatch = postMatch;
        this.putMatch = putMatch;
        this.getMatches = getMatches;
        this.deleteMatch = deleteMatch;
        this.postAnalyzeMatchResult = postAnalyzeMatchResult;
        this.getAnalysisMatchResult = getAnalysisMatchResult;
    }
}