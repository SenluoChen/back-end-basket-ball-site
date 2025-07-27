import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { Stack } from "aws-cdk-lib";
import { OAuthScope } from "aws-cdk-lib/aws-cognito";
import { SubUserApiStackProps } from "stack/UserApiStack";

export class UserMatchApiStack extends Stack {
    constructor(scope: Construct, id: string, props: SubUserApiStackProps) {
        super(scope, id, props);
        
        const matchResource = props.resourceV1External.addResource('match');

        matchResource.addMethod("GET", new LambdaIntegration(props.lambdas.getMatches), {
            authorizer: props.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });

        matchResource.addMethod("POST", new LambdaIntegration(props.lambdas.postMatch), {
            authorizer: props.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });

        matchResource.addMethod("PUT", new LambdaIntegration(props.lambdas.putMatch), {
            authorizer: props.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });

        matchResource.addMethod("DELETE", new LambdaIntegration(props.lambdas.deleteMatch), {
            authorizer: props.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });

        const matchAnalyzeResource = props.resourceV1External.addResource('analyze');

        matchAnalyzeResource.addMethod("POST", new LambdaIntegration(props.lambdas.postAnalyzeMatchResult), {
            authorizer: props.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ]
        });

        matchAnalyzeResource.addMethod("GET", new LambdaIntegration(props.lambdas.getAnalysisMatchResult), {
            authorizer: props.cognitoUserPoolsAuthorizer,
            authorizationScopes: [
                OAuthScope.PHONE.scopeName,
                OAuthScope.EMAIL.scopeName,
                OAuthScope.OPENID.scopeName,
                OAuthScope.COGNITO_ADMIN.scopeName
            ],
            requestParameters: {
              'method.request.querystring.timestamp': true, // rend obligatoire le paramètre timestamp
            },
        });
    }
}