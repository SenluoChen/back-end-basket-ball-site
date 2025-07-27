import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const matchTableName = process.env.MATCH_TABLE_NAME;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  try {
    const username = event.requestContext.authorizer?.claims?.['username'];
    if (!username) return unauthorizedResponse('Unauthorized: username missing');

    const body = JSON.parse(event.body || '{}');
    const timestamp = body.timestamp;

    if (!timestamp) return badRequest('Missing timestamp in request body');

    const allowedFields = [
      'title',
      'date',
      'shots',
      'turnovers',
      'assists',
      'rebounds',
      'points',
    ];

    const fieldsToUpdate: Record<string, any> = {};

    for (const field of allowedFields) {
      if (field in body) {
        if (!isValidField(field, body[field])) {
          return badRequest(`Invalid format for field "${field}"`);
        }
        fieldsToUpdate[field] = body[field];
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return badRequest('No valid fields provided to update');
    }

    const UpdateExpression = 'set ' + Object.keys(fieldsToUpdate)
      .map((key, idx) => `#f${idx} = :v${idx}`)
      .join(', ');

    const ExpressionAttributeNames = Object.keys(fieldsToUpdate).reduce((acc, key, idx) => {
      acc[`#f${idx}`] = key;
      return acc;
    }, {} as Record<string, string>);

    const ExpressionAttributeValues = Object.values(fieldsToUpdate).reduce((acc, val, idx) => {
      acc[`:v${idx}`] = val;
      return acc;
    }, {} as Record<string, any>);

    const params = {
      TableName: matchTableName!,
      Key: {
        user_id: username,
        timestamp: timestamp,
      },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'UPDATED_NEW',
    };

    const result = await dynamoDB.update(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        message: 'Match updated successfully',
        updatedFields: result.Attributes,
      }),
    };

  } catch (error: any) {
    console.error('Error updating match:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};

// === Validations ===

function isValidField(field: string, value: any): boolean {
  switch (field) {
    case 'title':
      return typeof value === 'string' && value.trim().length > 0;
    case 'date':
      return typeof value === 'number';
    case 'shots':
      return Array.isArray(value) && value.every(
        (s: any) =>
          typeof s === 'object' &&
          typeof s.x === 'number' &&
          typeof s.y === 'number' &&
          (s.type === 'success' || s.type === 'failed')
      );
    case 'turnovers':
    case 'assists':
    case 'rebounds':
    case 'points':
      return isValidQuarterStatObject(value);
    default:
      return false;
  }
}

function isValidQuarterStatObject(obj: any): boolean {
  const quarters = ['q1', 'q2', 'q3', 'q4'];
  if (typeof obj !== 'object' || obj === null) return false;
  return quarters.every(q => typeof obj[q] === 'number');
}

// === Helpers ===

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  };
}

function unauthorizedResponse(message: string) {
  return {
    statusCode: 401,
    headers: corsHeaders(),
    body: JSON.stringify({ message }),
  };
}

function badRequest(message: string) {
  return {
    statusCode: 400,
    headers: corsHeaders(),
    body: JSON.stringify({ message }),
  };
}
