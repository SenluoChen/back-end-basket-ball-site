import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const matchTableName = process.env.MATCH_TABLE_NAME;

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const username = event.requestContext.authorizer?.claims?.username;

    if (!username) {
      return {
        statusCode: 401,
        headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
        body: JSON.stringify({ message: 'Unauthorized: username missing' }),
      };
    }

    const params = {
      TableName: matchTableName!,
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: {
        ':uid': username,
      },
    };

    const result = await dynamoDB.query(params).promise();

    return {
      statusCode: 200,
      headers: {
          'Access-Control-Allow-Origin': '*', // ou ton domaine
          'Access-Control-Allow-Headers': '*',
        },
      body: JSON.stringify({
        message: 'Match list retrieved successfully',
        matches: result.Items || [],
      }),
    };

  } catch (error: any) {
    console.error('Error retrieving matches:', error);
    return {
      statusCode: 500,
      headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message,
      }),
    };
  }
};
