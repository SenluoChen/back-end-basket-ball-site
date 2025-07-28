import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const analyzeMatchTableName = process.env.MATCH_ANALYSIS_TABLE_NAME!;
const dynamoDB = new AWS.DynamoDB.DocumentClient();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return unauthorized('Missing user identity');
    }

    const body = JSON.parse(event.body || '{}');
    const { timestamp, shots, turnovers, assists, rebounds, points, phase } = body;

    if (!timestamp || !phase) {
      return badRequest('Missing required fields: timestamp or phase');
    }

    const prompt = `
Tu es un expert en stratégie de basketball.

Voici les données du match (certaines données peuvent être partielles) :

- Tirs (shots) : liste de tirs avec leurs coordonnées (x, y) et s’ils sont réussis ou ratés :
${JSON.stringify(shots ?? [], null, 2)}

- Points par quart-temps : 
${JSON.stringify(points ?? {}, null, 2)}

- Rebonds par quart-temps :
${JSON.stringify(rebounds ?? {}, null, 2)}

- Passes décisives (assists) par quart-temps :
${JSON.stringify(assists ?? {}, null, 2)}

- Balles perdues (turnovers) par quart-temps :
${JSON.stringify(turnovers ?? {}, null, 2)}

Consignes importantes :
- Fais une analyse uniquement basée sur ces données (pas de généralités).
- Identifie les tendances, réussites, faiblesses.
- Donne un **conseil principal** et quelques **conseils secondaires**, en t’appuyant sur ce que le joueur peut améliorer.
- Utilise le format JSON ci-dessous (strict, sans texte autour) :

{
  "mainAdvice": {
    "title": "Titre court",
    "text": "Texte explicatif du conseil principal",
    "comment": "Observation ou justification",
    "tag": ["attaque", "défense", "placement"]
  },
  "secondaryAdvices": [
    {
      "title": "...",
      "text": "...",
      "comment": "...",
      "tag": ["..."]
    }
  ]
}
`.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        { role: 'system', content: 'Tu es un expert stratégique en basketball.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    });

    let content = response.choices?.[0]?.message?.content?.trim() || '';
    content = content.replace(/^```json|```$/gm, '').trim();
    const parsed = JSON.parse(content);

    const item = {
      "user_id#timestamp": `${userId}#${timestamp}`,
      phase,
      timestamp,
      shots,
      turnovers,
      assists,
      rebounds,
      points,
      result: parsed,
    };

    await dynamoDB.put({
      TableName: analyzeMatchTableName,
      Item: item,
    }).promise();

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        code: 'SUCCESS',
        advice: item,
      }),
    };

  } catch (error: any) {
    console.error('Error generating advice:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        code: 'ERROR',
        message: 'Failed to analyze match',
        details: error.message,
      }),
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

function unauthorized(message: string) {
  return {
    statusCode: 401,
    headers: corsHeaders(),
    body: JSON.stringify({ code: 'UNAUTHORIZED', message }),
  };
}

function badRequest(message: string) {
  return {
    statusCode: 400,
    headers: corsHeaders(),
    body: JSON.stringify({ code: 'BAD_REQUEST', message }),
  };
}
