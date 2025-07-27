import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { isValidStringLength } from '/opt/nodejs/user';

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const userTableName = process.env.USER_TABLE_NAME;
const userPoolId = process.env.USER_POOL_ID;
const userProfileBucketName = process.env.USER_PROFILE_BUCKET_NAME;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
    const body = JSON.parse(event.body || '{}');
    const id = event.requestContext.authorizer?.claims['username'];

    const user = await cognito.adminGetUser({
      UserPoolId: userPoolId!,
      Username: id,
    }).promise();

    const emailAttr = user.UserAttributes?.find(attr => attr.Name === 'email');

    const email = emailAttr?.Value ?? '';

    const userData = {
        id: id,
        email: email,
        username: body.username,
        position: body.position,
        height: body.height,
        weight: body.weight,
        timestamp: new Date().getTime(),
        imagePath: 'profile-photos/' + id + '.' + body.filename.split('.').pop()
    };

    if (!isValidUserData(userData)) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ message: 'Invalid user data (username, email, position, height or weight)' }),
        };
    }

    if (!userPoolId) throw new Error("UserPoolId is not defined in environment variables");

    const emailExists = await isEmailUsedInCognito(userData.email, userPoolId);
    if (!emailExists) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ message: 'Email not found in Cognito' }),
        };
    }

    if (!userTableName) throw new Error("UserTableName is not defined in environment variables");

    const isUsernameTaken = await checkIfUsernameTaken(id, userTableName);
    if (isUsernameTaken) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ message: 'Username is already taken' }),
        };
    }

    try {
        await createUser(userData, userTableName);
        const uploadUrl = await generateUploadUrl(id, body.filename);

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({ message: 'User created successfully', uploadUrl: uploadUrl.url }),
        };
    } catch (error: any) {
        console.error(error);
        return {
            statusCode: 500,
            headers: corsHeaders(),
            body: JSON.stringify({ message: error.message }),
        };
    }
};

// Helpers

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
    };
}

function isValidUserData(userData: any): boolean {
    const validPositions = [
        'Point Guard',
        'Shooting Guard',
        'Small Forward',
        'Power Forward',
        'Center'
    ];

    const isUsernameValid = typeof userData.username === 'string'
        && userData.username.length >= 3
        && userData.username.length <= 24;

    return (
        isUsernameValid &&
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

async function checkIfUsernameTaken(id: string, tableName: string): Promise<boolean> {
    const result = await dynamoDB.get({ TableName: tableName, Key: { id } }).promise();
    return !!result.Item;
}

async function isEmailUsedInCognito(email: string, userPoolId: string): Promise<boolean> {
    const params = {
        UserPoolId: userPoolId,
        Filter: `email = "${email}"`,
    };

    try {
        const response = await cognito.listUsers(params).promise();
        return Array.isArray(response.Users) && response.Users.length > 0;
    } catch (error) {
        console.error('Error checking email in Cognito:', error);
        throw error;
    }
}

async function createUser(userData: any, tableName: string) {
    await dynamoDB.put({
        TableName: tableName,
        Item: userData,
        ConditionExpression: 'attribute_not_exists(id)',
    }).promise();
}

async function generateUploadUrl(username: string, filename: string): Promise<{ url: string; path: string }> {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) throw new Error("Filename must include an extension");

    const contentType = extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
        ? 'image/png'
        : (() => { throw new Error(`Unsupported file type: ${extension}`); })();

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
