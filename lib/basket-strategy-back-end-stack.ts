import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb';

export class BadmintonStrategyBackEndStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    let env = 'dev';

    // LAYER

    const userLayer = new lambda.LayerVersion(this, 'user-layer', {
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X,
      ],
      code: lambda.Code.fromAsset('layers/user'),
    });

    // COGNITO

    const userPool = new cognito.UserPool(this, 'badmintonStrategyUserPool', {
      userPoolName: 'badmintonStrategyUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        username: true,
        email: true,
      },
      userVerification: {
        emailSubject: 'Verify your email for our app!',
        emailBody: 'Thanks for signing up to our app! Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      autoVerify: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Création du Client User Pool Cognito
    const userPoolClient = new cognito.UserPoolClient(this, 'badmintonStrategyUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.COGNITO_ADMIN,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['https://google.com'], // Remplacez par votre URL de callback
      },
      generateSecret: false,
      accessTokenValidity: Duration.minutes(15),
      refreshTokenValidity: Duration.days(90),
    });

    // DYNAMO

    const userTable = new dynamodb.Table(this, 'userTable', {
          partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
          billingMode: BillingMode.PAY_PER_REQUEST,
          removalPolicy: env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
      });

    // S3

    const userProfilePictureBucket = new s3.Bucket(this, 'userProfilePictureBucket', {
    });

    const postUser = new NodejsFunction(this, 'postUser', {
      entry: './lambda/user/postUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: userTable.tableName,
        USER_PROFILE_BUCKET_NAME: userProfilePictureBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
      },
    })

    userTable.grantReadWriteData(postUser);
    userProfilePictureBucket.grantReadWrite(postUser);

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
        USER_TABLE_NAME: userTable.tableName,
        USER_PROFILE_BUCKET_NAME: userProfilePictureBucket.bucketName,
      },
    })

    userTable.grantReadWriteData(putUser);
    userProfilePictureBucket.grantReadWrite(putUser);

    const getUser = new NodejsFunction(this, 'getUser', {
      entry: './lambda/user/getUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: userTable.tableName,
        USER_PROFILE_BUCKET_NAME: userProfilePictureBucket.bucketName,
      },
    })

    userTable.grantReadWriteData(getUser);
    userProfilePictureBucket.grantRead(getUser);

    const getUserByUsername = new NodejsFunction(this, 'getUserByUsername', {
      entry: './lambda/user/getUserByUsername.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: userTable.tableName,
        USER_PROFILE_BUCKET_NAME: userProfilePictureBucket.bucketName,
      },
    })

    userTable.grantReadWriteData(getUserByUsername);
    userProfilePictureBucket.grantRead(getUserByUsername);

    const deleteUser = new NodejsFunction(this, 'deleteUser', {
      entry: './lambda/user/deleteUser.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      layers: [userLayer],
      environment: {
        USER_TABLE_NAME: userTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    })

    userTable.grantReadWriteData(deleteUser);

    deleteUser.addToRolePolicy(new iam.PolicyStatement({
        resources: [userPool.userPoolArn],
        effect: iam.Effect.ALLOW,
        actions: [
            "cognito-idp:*",
        ]
    }));


    // API

    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/aws/apigateway/myApi',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool]
    });

    const api = new apigateway.RestApi(this, 'api', {
      restApiName: 'apibadmintonStrategy',
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
            // Spécifiez les champs souhaités
            caller: true,
            httpMethod: true,
            ip: true,
            protocol: true,
            requestTime: true,
            resourcePath: true,
            responseLength: true,
            status: true,
            user: true
        }),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    authorizer._attachToApi(api);

    const customerPlan = api.addUsagePlan("usagePlan-customer", {
      name:"CustomerPlan"
    });
    customerPlan.addApiStage({
        api: api,
        stage: api.deploymentStage
    });

    const v1Resource = api.root.addResource('v1', {
      defaultMethodOptions: {
          authorizer: authorizer,
    }});
    
    const userV1Resource = v1Resource.addResource('user');
    userV1Resource.addMethod('POST', new apigateway.LambdaIntegration(postUser));
    userV1Resource.addMethod('PUT', new apigateway.LambdaIntegration(putUser));
    userV1Resource.addMethod('GET', new apigateway.LambdaIntegration(getUser));
    userV1Resource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteUser));
  }
}
