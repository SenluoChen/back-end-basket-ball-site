#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { DataInfraStack } from "../stack/DataInfraStack";
import { LambdaUserStack } from "../stack/LambdaUserStack";
import { UserApiStack } from "../stack/UserApiStack";
import { AuthStack } from "../stack/AuthStack";
import { UserMatchApiStack } from "../stack/UserApiStack/UserMatchApiStack";

dotenv.config({path: ".env"});

const app = new cdk.App();

const deployEnv =  process.env.NODE_ENV || "dev";
const appName = "basket-strategy-back";

const chatgpt_api_key = process.env.CHATGPT_API_KEY ?? 'dev';

const auth = new AuthStack(app, `${deployEnv}-${appName}-AuthStack`, {
    appName: appName,
    deployEnv: deployEnv,
});

const data = new DataInfraStack(app, `${deployEnv}-${appName}-DataInfraStack`, {
    appName: appName,
    deployEnv: deployEnv,
});


const userLambdas = new LambdaUserStack(app, `${deployEnv}-${appName}-LambdaUserStack`, {
    userPool: auth.userPool,
    dynamoTables: data.dynamoTables,
    buckets: data.buckets,
    chatgptKey: chatgpt_api_key
});


// Patient API
const userApiStack = new UserApiStack(app, `${deployEnv}-${appName}-PatientApiStack`, {
    userPool: auth.userPool,
    lambdas: userLambdas,
    deployEnv: deployEnv,
    appName: appName,
    accessLogGroupExternal: data.accessLogGroupExternal
});

new UserMatchApiStack(app, `${deployEnv}-${appName}-UserMatchApiStack`, {
    cognitoUserPoolsAuthorizer: userApiStack.cognitoUserPoolsAuthorizer,
    lambdas: userLambdas,
    resourceV1External: userApiStack.resourceV1External
});
