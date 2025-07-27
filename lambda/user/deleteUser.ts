import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const userTableName = process.env.USER_TABLE_NAME;
const userPoolId = process.env.USER_POOL_ID;

export const handler: APIGatewayProxyHandler = async (event) => {
    const username = event.requestContext.authorizer?.claims['username'];

    if ( !username || !userTableName || !userPoolId) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
            body: JSON.stringify({ message: 'Missing required information' }),
        };
    }

    try {
        await deleteUserByEmail(username, userTableName);
        await deleteUserFromCognito(username, userPoolId);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
            body: JSON.stringify({ message: 'User successfully deleted' }),
        };
    } catch (error:any) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
            body: JSON.stringify({ message: error.message }),
        };
    }
};

async function deleteUserByEmail(username: string, tableName: string) {

    const deleteParams = {
        TableName: tableName,
        Key: {
            username: username,
        }
    };
    await dynamoDB.delete(deleteParams).promise();
}

async function deleteUserFromCognito(username: string, userPoolId: string) {
    const deleteUserParams = {
        UserPoolId: userPoolId,
        Username: username,
    };
    await cognito.adminDeleteUser(deleteUserParams).promise();
}
