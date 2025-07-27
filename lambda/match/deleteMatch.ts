import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const matchTableName = process.env.MATCH_TABLE_NAME;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  try {
    const username = event.requestContext.authorizer?.claims['username'];
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

    const body = JSON.parse(event.body || '{}');
    const timestamp = body.timestamp;

    if (!timestamp) {
      return {
        statusCode: 400,
        headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
        body: JSON.stringify({ message: 'Missing timestamp in request body' }),
      };
    }

    // Vérification de l'existence du match
    const getParams = {
      TableName: matchTableName!,
      Key: {
        user_id: username,
        timestamp: timestamp,
      },
    };

    const result = await dynamoDB.get(getParams).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
        body: JSON.stringify({ message: 'Match not found' }),
      };
    }

    // Suppression
    const deleteParams = {
      TableName: matchTableName!,
      Key: {
        user_id: username,
        timestamp: timestamp,
      },
    };

    await dynamoDB.delete(deleteParams).promise();

    return {
      statusCode: 200,
      headers: {
          'Access-Control-Allow-Origin': '*', // ou ton domaine
          'Access-Control-Allow-Headers': '*',
        },
      body: JSON.stringify({ message: 'Match deleted successfully' }),
    };

  } catch (error: any) {
    console.error('Error deleting match:', error);
    return {
      statusCode: 500,
      headers: {
                'Access-Control-Allow-Origin': '*', // ou ton domaine
                'Access-Control-Allow-Headers': '*',
              },
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};
