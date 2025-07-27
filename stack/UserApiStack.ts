import { Construct } from "constructs";
import {
    RestApi,
    CognitoUserPoolsAuthorizer,
    Cors,
    CfnMethod,
    LambdaIntegration,
    Resource,
    LogGroupLogDestination,
    AccessLogFormat,
    MethodLoggingLevel,
} from "aws-cdk-lib/aws-apigateway";
import { OAuthScope, UserPool } from "aws-cdk-lib/aws-cognito";
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { LambdaUserStack } from "./LambdaUserStack";
import { Stack, StackProps } from "aws-cdk-lib";
import { LogGroup } from "aws-cdk-lib/aws-logs";


export interface UserApiStackProps extends StackProps {
  userPool: UserPool;
  lambdas: LambdaUserStack;
  accessLogGroupExternal: LogGroup;
  appName: string;
  deployEnv: string;
}

export interface SubUserApiStackProps extends StackProps {
  cognitoUserPoolsAuthorizer: CognitoUserPoolsAuthorizer;
  lambdas: LambdaUserStack;
  resourceV1External: Resource;
}

export class UserApiStack extends Stack {
    public readonly patientApi: RestApi;
    public readonly cognitoUserPoolsAuthorizer: CognitoUserPoolsAuthorizer;
    public readonly resourceV1External: Resource;

    constructor(scope: Construct, id: string, props: UserApiStackProps) {
        super(scope, id, props);

        const { userPool, lambdas, accessLogGroupExternal, appName, deployEnv } = props;

        this.cognitoUserPoolsAuthorizer = new CognitoUserPoolsAuthorizer(this, "PatientAuthorizer", {
            cognitoUserPools: [userPool],
        });


        this.patientApi = new RestApi(this, `${deployEnv}-${appName}-patient-api`, {
            restApiName: `${deployEnv}-${appName}-patient-api`,
            cloudWatchRole: true,
            deploy: true,
            deployOptions: {
                stageName: deployEnv,
                accessLogDestination: new LogGroupLogDestination(accessLogGroupExternal),
                accessLogFormat: AccessLogFormat.jsonWithStandardFields({
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
                loggingLevel: MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS,
            },
        });
        
        const patientCustomerPlan = this.patientApi.addUsagePlan(`${deployEnv}-${appName}-patient-usage-plan`, {
            name: `${deployEnv}-${appName}-patient-usage-plan`
        });
        patientCustomerPlan.addApiStage({
            api: this.patientApi,
            stage: this.patientApi.deploymentStage
        });

        this.resourceV1External = this.patientApi.root.addResource("v1", {
            defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
        });

        const resourceUserExternal = this.resourceV1External.addResource("user");
        
        resourceUserExternal.addMethod("GET", new LambdaIntegration(lambdas.getUser), {
            authorizer: this.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });
        resourceUserExternal.addMethod("PUT", new LambdaIntegration(lambdas.putUser), {
            authorizer: this.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });
        resourceUserExternal.addMethod("DELETE", new LambdaIntegration(lambdas.deleteUser), {
            authorizer: this.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });
        resourceUserExternal.addMethod("POST", new LambdaIntegration(lambdas.postUser), {
            authorizer: this.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });
        
        const apiExternalCorsMethods = this.patientApi.methods.filter(
            (method) => method.httpMethod === "OPTIONS"
        );

        apiExternalCorsMethods.forEach((method) => {
            const cfnMethod = method.node.defaultChild as CfnMethod;
            cfnMethod.addPropertyOverride("ApiKeyRequired", false);
            cfnMethod.addPropertyOverride("AuthorizationType", "NONE");
            cfnMethod.addPropertyDeletionOverride("AuthorizerId");
            cfnMethod.addPropertyDeletionOverride("AuthorizationScopes");
            cfnMethod.addPropertyDeletionOverride("RequestParameters");
        });
    }
}