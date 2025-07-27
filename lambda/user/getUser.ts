import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const userTableName = process.env.USER_TABLE_NAME;
const userProfileBucketName = process.env.USER_PROFILE_BUCKET_NAME;

export const handler: APIGatewayProxyHandler = async (event) => {
    const username = event.requestContext.authorizer?.claims['username'];

    if (!username || !userTableName) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing required information' }),
        };
    }

    try {
        const userData = await getUserByUsername(username, userTableName);
        if (username && userData) {
            const imageUrl = s3.getSignedUrl('getObject', {
                Bucket: userProfileBucketName,
                Key: userData.imagePath,
                Expires: 3600
            });
            userData.imageUrl = imageUrl;
        }
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
            body: JSON.stringify(userData),
        };
    } catch (error: any) {
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

async function getUserByUsername(id: string, tableName: string) {
    const params = {
        TableName: tableName,
        Key: {
            id
        }
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item
}