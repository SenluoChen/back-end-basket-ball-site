import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const matchTableName = process.env.MATCH_TABLE_NAME;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  try {
    const username = event.requestContext.authorizer?.claims['username'];
    if (!username) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Unauthorized: username missing' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const title = body.title?.trim();

    if (!title) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Missing or empty field: title' }),
      };
    }

    const now = Date.now(); // timestamp in ms
    const item = {
      id: uuidv4(),
      user_id: username,
      title,
      timestamp: now, // For sorting, filtering, etc.
    };

    await dynamoDB.put({
      TableName: matchTableName!,
      Item: item,
    }).promise();

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        message: 'Basket match created successfully',
        match: item,
      }),
    };

  } catch (error: any) {
    console.error('Error creating basket match:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};

// === Helpers ===
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  };
}
