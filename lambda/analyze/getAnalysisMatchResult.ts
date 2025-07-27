import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.MATCH_ANALYSIS_TABLE_NAME;

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const username = event.requestContext.authorizer?.claims?.username;
    const timestamp = event.queryStringParameters?.timestamp;

    if (!username || !timestamp) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({ message: 'Missing username or timestamp' }),
      };
    }

    const userTimestampKey = `${username}#${timestamp}`;

    const params = {
      TableName: tableName!,
      KeyConditionExpression: '#pk = :key',
      ExpressionAttributeNames: {
        '#pk': 'user_id#timestamp',
      },
      ExpressionAttributeValues: {
        ':key': userTimestampKey,
      },
    };

    const result = await dynamoDB.query(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({
        message: 'Analysis retrieved successfully',
        items: result.Items || [],
      }),
    };
  } catch (error: any) {
    console.error('Error querying analysis table:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message,
      }),
    };
  }
};
