import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { isValidStringLength } from '/opt/nodejs/user';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const userTableName = process.env.USER_TABLE_NAME;
const userProfileBucketName = process.env.USER_PROFILE_BUCKET_NAME;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
    const body = JSON.parse(event.body || '{}');
    const username = event.requestContext.authorizer?.claims['username'];
    const filename = body.filename;

    const updateData = {
        email: body.email,
        username,
        position: body.position,
        height: body.height,
        weight: body.weight,
    };

    if (!isValidUpdateData(updateData)) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ message: 'Invalid update data' }),
        };
    }

    if (!userTableName) {
        throw new Error("UserTableName is not defined in environment variables");
    }

    await updateUser(username, updateData, userTableName);

    if (filename) {
        const uploadUrl = await generateUploadUrl(username, filename);
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({ message: 'User updated successfully', uploadUrl: uploadUrl.url }),
        };
    }

    return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'User updated successfully' }),
    };
};

// === Helpers ===

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
    };
}

async function updateUser(username: string, updateData: any, tableName: string) {
    const params = {
        TableName: tableName,
        Key: { id: username }, // 👈 attention ici : le champ clé est "id" (si tu as suivi la même structure que dans create)
        UpdateExpression: 'set email = :e, position = :p, height = :h, weight = :w',
        ExpressionAttributeValues: {
            ':e': updateData.email,
            ':p': updateData.position,
            ':h': updateData.height,
            ':w': updateData.weight,
        },
        ReturnValues: 'UPDATED_NEW',
    };
    await dynamoDB.update(params).promise();
}

function isValidUpdateData(userData: any): boolean {
    const validPositions = [
        'Point Guard',
        'Shooting Guard',
        'Small Forward',
        'Power Forward',
        'Center'
    ];

    return (
        isValidStringLength(userData.email) &&
        validPositions.includes(userData.position) &&
        typeof userData.height === 'number' &&
        userData.height >= 90 &&
        userData.height <= 300 &&
        typeof userData.weight === 'number' &&
        userData.weight >= 25 &&
        userData.weight <= 300
    );
}

async function generateUploadUrl(username: string, filename: string): Promise<{ url: string; path: string }> {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) {
        throw new Error("Filename must include an extension.");
    }

    let contentType = '';
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            contentType = 'image/jpeg';
            break;
        case 'png':
            contentType = 'image/png';
            break;
        default:
            throw new Error(`Unsupported file type: ${extension}`);
    }

    const key = `profile-photos/${username}.${extension}`;
    const url = await s3.getSignedUrlPromise('putObject', {
        Bucket: userProfileBucketName,
        Key: key,
        ContentEncoding: 'base64',
        ContentType: contentType,
        Expires: 60,
    });

    return { url, path: key };
}
